"""Cases: create, list, get, delete + CSV upload."""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from app.api.auth import current_user
from app.core.db import cases_coll, transactions_coll, risk_coll, get_db
from app.schemas import Case, CaseCreate, IngestResponse, Transaction
from app.services import ingestion, risk_scoring, rbac, audit
import uuid

router = APIRouter(prefix="/cases", tags=["cases"])


def _uid() -> str:
    return f"case_{uuid.uuid4().hex[:12]}"


async def _rescore_case(case_id: str) -> None:
    """Recompute risk factors + total + bucket, persist, and update Case."""
    txs = await transactions_coll().find({"case_id": case_id}, {"_id": 0}).to_list(10000)
    factors = risk_scoring.score(txs)
    total = risk_scoring.total_points(factors)
    bucket = risk_scoring.bucket(total)
    now = datetime.now(timezone.utc).isoformat()
    await risk_coll().update_one(
        {"case_id": case_id},
        {"$set": {
            "case_id": case_id, "total": total, "risk": bucket,
            "factors": [f.model_dump() for f in factors], "computed_at": now,
        }},
        upsert=True,
    )
    amount = sum(float(t["amount"]) for t in txs)
    await cases_coll().update_one(
        {"case_id": case_id},
        {"$set": {
            "risk_score": total, "risk": bucket,
            "amount": amount, "tx_count": len(txs),
        }},
    )


@router.post("", response_model=Case)
async def create_case(
    payload: CaseCreate,
    background: BackgroundTasks,
    user: dict = Depends(current_user),
):
    case_id = _uid()
    now = datetime.now(timezone.utc)
    case = {
        "case_id": case_id,
        "subject": payload.subject,
        "channel": payload.channel,
        "country": payload.country,
        "reported_at": now.isoformat(),
        "owner_id": user["user_id"],
        "status": "open",
        "amount": 0.0,
        "currency": "USD",
        "risk": "safe",
        "risk_score": 0,
        "tx_count": 0,
    }
    await cases_coll().insert_one(case)
    await audit.record(case_id, user, "case_created", {"subject": payload.subject})
    if payload.transactions:
        await ingestion.ingest(case_id, payload.transactions)
        background.add_task(_rescore_case, case_id)
    return Case(**{**case, "reported_at": now})


@router.get("", response_model=List[Case])
async def list_cases(user: dict = Depends(current_user)):
    # Owned + shared cases
    shared_ids = await rbac.list_accessible_case_ids(user["user_id"])
    q = {"$or": [{"owner_id": user["user_id"]}, {"case_id": {"$in": shared_ids}}]}
    docs = await cases_coll().find(q, {"_id": 0}).sort("reported_at", -1).to_list(500)
    out = []
    for d in docs:
        if isinstance(d.get("reported_at"), str):
            d["reported_at"] = datetime.fromisoformat(d["reported_at"])
        out.append(Case(**d))
    return out


@router.get("/{case_id}", response_model=Case)
async def get_case(case_id: str, user: dict = Depends(current_user)):
    d, _role = await rbac.load_case_with_role(case_id, user, "viewer")
    if isinstance(d.get("reported_at"), str):
        d["reported_at"] = datetime.fromisoformat(d["reported_at"])
    return Case(**d)


@router.delete("/{case_id}")
async def delete_case(case_id: str, user: dict = Depends(current_user)):
    # Only owner can delete
    await rbac.load_case_with_role(case_id, user, "owner")
    await cases_coll().delete_one({"case_id": case_id})
    await transactions_coll().delete_many({"case_id": case_id})
    await risk_coll().delete_one({"case_id": case_id})
    db = get_db()
    await db.case_shares.delete_many({"case_id": case_id})
    await audit.record(case_id, user, "case_deleted")
    return {"ok": True}


@router.post("/{case_id}/upload", response_model=IngestResponse)
async def upload_csv(
    case_id: str,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
):
    await rbac.load_case_with_role(case_id, user, "analyst")
    raw = await file.read()
    rows, errors = ingestion.parse_csv(raw)
    resp = await ingestion.ingest(case_id, rows)
    background.add_task(_rescore_case, case_id)
    await audit.record(case_id, user, "csv_uploaded",
                       {"filename": file.filename, "accepted": resp.accepted, "rejected": len(errors)})
    return IngestResponse(
        case_id=case_id, accepted=resp.accepted,
        rejected=len(errors), errors=errors[:10],
    )


@router.get("/{case_id}/transactions", response_model=List[Transaction])
async def list_transactions(case_id: str, user: dict = Depends(current_user)):
    await rbac.load_case_with_role(case_id, user, "viewer")
    txs = await transactions_coll().find({"case_id": case_id}, {"_id": 0}) \
        .sort("date", 1).to_list(10000)
    return [Transaction(**t) for t in txs]
