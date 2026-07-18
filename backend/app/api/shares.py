"""Case sharing + status + audit routes.

Only owners can share/unshare or delete. Owners and analysts can change status.
Everyone with access can read the audit log.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Literal
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, ConfigDict
from app.api.auth import current_user
from app.core.db import get_db, cases_coll
from app.services import rbac, audit
from app.services.broadcaster import broadcaster

router = APIRouter(prefix="/cases/{case_id}", tags=["sharing"])


class ShareIn(BaseModel):
    email: EmailStr
    role: Literal["analyst", "viewer"] = "analyst"


class Share(BaseModel):
    model_config = ConfigDict(extra="ignore")
    share_id: str
    case_id: str
    user_id: str
    email: str
    name: str | None = None
    role: str
    granted_by_email: str
    granted_at: str


class StatusIn(BaseModel):
    status: Literal["open", "frozen", "closed"]


@router.get("/shares", response_model=List[Share])
async def list_shares(case_id: str, user: dict = Depends(current_user)):
    await rbac.load_case_with_role(case_id, user, "viewer")
    db = get_db()
    docs = await db.case_shares.find({"case_id": case_id}, {"_id": 0}).to_list(500)
    return [Share(**d) for d in docs]


@router.post("/shares", response_model=Share)
async def add_share(case_id: str, payload: ShareIn, user: dict = Depends(current_user)):
    await rbac.load_case_with_role(case_id, user, "owner")
    invitee = await rbac.resolve_user_by_email(payload.email)
    if not invitee:
        raise HTTPException(404, "No TraceRoot user with that email — they must sign in first.")
    if invitee["user_id"] == user["user_id"]:
        raise HTTPException(400, "You already own this case.")

    db = get_db()
    existing = await db.case_shares.find_one(
        {"case_id": case_id, "user_id": invitee["user_id"]}, {"_id": 0}
    )
    if existing:
        # update role
        await db.case_shares.update_one(
            {"share_id": existing["share_id"]},
            {"$set": {"role": payload.role}},
        )
        doc = {**existing, "role": payload.role}
    else:
        doc = {
            "share_id": f"shr_{uuid.uuid4().hex[:12]}",
            "case_id": case_id,
            "user_id": invitee["user_id"],
            "email": invitee["email"],
            "name": invitee.get("name"),
            "role": payload.role,
            "granted_by_email": user["email"],
            "granted_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.case_shares.insert_one(doc)
    await audit.record(case_id, user, "case_shared", {"email": payload.email, "role": payload.role})
    return Share(**doc)


@router.delete("/shares/{share_id}")
async def remove_share(case_id: str, share_id: str, user: dict = Depends(current_user)):
    await rbac.load_case_with_role(case_id, user, "owner")
    db = get_db()
    doc = await db.case_shares.find_one({"share_id": share_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Share not found")
    await db.case_shares.delete_one({"share_id": share_id})
    await audit.record(case_id, user, "case_unshared", {"email": doc["email"]})
    await broadcaster.broadcast(case_id, "case_unshared", {"email": doc["email"]})
    return {"ok": True}


@router.patch("/status")
async def change_status(case_id: str, payload: StatusIn, user: dict = Depends(current_user)):
    case, _ = await rbac.load_case_with_role(case_id, user, "analyst")
    prev = case.get("status", "open")
    if prev == payload.status:
        return {"ok": True, "status": payload.status}
    await cases_coll().update_one({"case_id": case_id}, {"$set": {"status": payload.status}})
    await audit.record(case_id, user, "status_changed", {"from": prev, "to": payload.status})
    await broadcaster.broadcast(case_id, "status_changed", {"from": prev, "to": payload.status})
    return {"ok": True, "status": payload.status}


@router.get("/audit")
async def get_audit(case_id: str, user: dict = Depends(current_user)):
    await rbac.load_case_with_role(case_id, user, "viewer")
    return await audit.list_for_case(case_id)


@router.get("/audit/export")
async def export_audit(
    case_id: str,
    format: str = "json",
    user: dict = Depends(current_user),
):
    """format=csv or format=json (signed, tamper-evident)."""
    from fastapi.responses import Response
    from app.services import audit_export
    await rbac.load_case_with_role(case_id, user, "viewer")
    entries = await audit.list_for_case(case_id, limit=10000)

    if format == "csv":
        body = audit_export.to_csv(entries)
        await audit.record(case_id, user, "audit_exported", {"format": "csv"})
        return Response(
            content=body, media_type="text/csv",
            headers={"Content-Disposition":
                     f'attachment; filename="TraceRoot_audit_{case_id}.csv"'},
        )

    envelope = audit_export.signed_json(case_id, entries)
    import json as _json
    body = _json.dumps(envelope, indent=2, ensure_ascii=False).encode("utf-8")
    await audit.record(case_id, user, "audit_exported",
                       {"format": "json_signed", "algorithm": "HMAC-SHA256"})
    return Response(
        content=body, media_type="application/json",
        headers={"Content-Disposition":
                 f'attachment; filename="TraceRoot_audit_{case_id}.signed.json"'},
    )
