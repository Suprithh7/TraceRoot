"""Risk scores + graph + recommendations + copilot + report routes."""
import json
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from app.api.auth import current_user
from app.core.db import cases_coll, transactions_coll, risk_coll, copilot_coll
from app.schemas import (
    RiskScore, GraphPayload, CopilotRequest, CopilotResponse,
    Recommendation, AccountAssessmentRequest, AccountAssessmentResponse,
)
from app.services import (
    risk_scoring, graph_builder, gemma_orchestrator, recommendation,
    report_generator, rbac, audit, audit_export,
)
from app.services.broadcaster import broadcaster

router = APIRouter(prefix="/cases/{case_id}", tags=["case-detail"])


async def _build_ctx(case: dict, case_id: str) -> dict:
    txs = await transactions_coll().find({"case_id": case_id}, {"_id": 0}).to_list(10000)
    graph = graph_builder.build_graph(txs)
    factors = risk_scoring.score(txs)
    total = risk_scoring.total_points(factors)
    bucket = risk_scoring.bucket(total)
    return {
        "txs": txs,
        "graph": graph,
        "factors": factors,
        "total": total,
        "bucket": bucket,
        "prompt_ctx": {
            "case_id": case_id,
            "subject": case["subject"],
            "channel": case["channel"],
            "country": case["country"],
            "amount": case.get("amount", 0.0),
            "currency": case.get("currency", "USD"),
            "risk": bucket,
            "risk_score": total,
            "tx_count": len(txs),
            "chain": [n.model_dump() for n in graph.nodes],
            "factors": [f.model_dump() for f in factors],
        },
    }


@router.get("/risk-scores", response_model=RiskScore)
async def get_risk(case_id: str, user: dict = Depends(current_user)):
    await rbac.load_case_with_role(case_id, user, "viewer")
    doc = await risk_coll().find_one({"case_id": case_id}, {"_id": 0})
    if not doc:
        txs = await transactions_coll().find({"case_id": case_id}, {"_id": 0}).to_list(10000)
        factors = risk_scoring.score(txs)
        total = risk_scoring.total_points(factors)
        bucket = risk_scoring.bucket(total)
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "case_id": case_id, "total": total, "risk": bucket,
            "factors": [f.model_dump() for f in factors], "computed_at": now,
        }
        await risk_coll().update_one({"case_id": case_id}, {"$set": doc}, upsert=True)
    if isinstance(doc.get("computed_at"), str):
        doc["computed_at"] = datetime.fromisoformat(doc["computed_at"])
    return RiskScore(**doc)


@router.get("/graph", response_model=GraphPayload)
async def get_graph(case_id: str, user: dict = Depends(current_user)):
    await rbac.load_case_with_role(case_id, user, "viewer")
    txs = await transactions_coll().find({"case_id": case_id}, {"_id": 0}).to_list(10000)
    return graph_builder.build_graph(txs)


def _account_assessment_context(account_id: str, txs: list[dict], graph) -> dict:
    """Build an account-specific, reproducible score and the evidence Gemma sees."""
    history = [t for t in txs if t["sender"] == account_id or t["receiver"] == account_id]
    node = next((n for n in graph.nodes if n.id == account_id), None)
    if node is None:
        raise HTTPException(404, "Account is not present in this case graph")
    incoming = [t for t in history if t["receiver"] == account_id]
    outgoing = [t for t in history if t["sender"] == account_id]
    evidence: list[str] = [f"{len(history)} case transaction(s) involve this account."]
    score = 0
    if account_id in risk_scoring.KNOWN_MULE_ACCOUNTS:
        score += 35; evidence.append("Account matches the configured mule-account watchlist (+35).")
    if incoming and outgoing:
        score += 20; evidence.append("Account both receives and forwards funds in this case (+20).")
    in_total = sum(float(t["amount"]) for t in incoming)
    out_total = sum(float(t["amount"]) for t in outgoing)
    if in_total and out_total >= 0.7 * in_total:
        score += 20; evidence.append("At least 70% of received value is forwarded onward (+20).")
    if len(history) >= 4:
        score += 15; evidence.append("High activity: four or more linked transactions (+15).")
    if node.risk in {"monitor", "freeze"}:
        score += 10; evidence.append(f"Graph role/risk is marked {node.risk} (+10).")
    score = min(100, score)
    risk = risk_scoring.bucket(score)
    connections = [
        {"counterparty": e.target if e.source == account_id else e.source,
         "direction": "out" if e.source == account_id else "in",
         "amount": e.amount, "tx_count": e.tx_count,
         "first_seen": e.first_seen, "last_seen": e.last_seen}
        for e in graph.edges if e.source == account_id or e.target == account_id
    ]
    history_for_prompt = [
        {"date": t["date"], "direction": "out" if t["sender"] == account_id else "in",
         "counterparty": t["receiver"] if t["sender"] == account_id else t["sender"],
         "amount": t["amount"], "description": t.get("description", "")}
        for t in history
    ]
    return {"account_id": account_id, "score": score, "risk": risk, "evidence": evidence,
            "transactions": history_for_prompt, "connections": connections}


@router.post("/account-assessment", response_model=AccountAssessmentResponse)
async def account_assessment(
    case_id: str, req: AccountAssessmentRequest, user: dict = Depends(current_user),
):
    """Generate a draft explanation for a graph-selected account, never an action."""
    await rbac.load_case_with_role(case_id, user, "viewer")
    txs = await transactions_coll().find({"case_id": case_id}, {"_id": 0}).to_list(10000)
    graph = graph_builder.build_graph(txs)
    assessment_ctx = _account_assessment_context(req.account_id, txs, graph)
    result = await gemma_orchestrator.assess_account(assessment_ctx, req.language)
    await audit.record(case_id, user, "account_assessed", {
        "account_id": req.account_id, "score": result["score"], "source": result["source"],
    })
    return AccountAssessmentResponse(**result)


@router.get("/recommendations", response_model=List[Recommendation])
async def get_recs(case_id: str, user: dict = Depends(current_user)):
    await rbac.load_case_with_role(case_id, user, "viewer")
    txs = await transactions_coll().find({"case_id": case_id}, {"_id": 0}).to_list(10000)
    graph = graph_builder.build_graph(txs)
    factors = risk_scoring.score(txs)
    return recommendation.recommend(graph.nodes, factors)


@router.post("/copilot", response_model=CopilotResponse)
async def copilot(case_id: str, req: CopilotRequest, user: dict = Depends(current_user)):
    case, _ = await rbac.load_case_with_role(case_id, user, "analyst")
    ctx = await _build_ctx(case, case_id)
    result = await gemma_orchestrator.generate(req.kind, ctx["prompt_ctx"], req.language)
    await copilot_coll().update_one(
        {"case_id": case_id, "kind": req.kind, "language": req.language},
        {"$set": {**result, "case_id": case_id,
                  "generated_at": result["generated_at"].isoformat()}},
        upsert=True,
    )
    await audit.record(case_id, user, "copilot_generated",
                       {"kind": req.kind, "language": req.language, "stream": False})
    return CopilotResponse(**result)


@router.post("/copilot/stream")
async def copilot_stream(case_id: str, req: CopilotRequest, user: dict = Depends(current_user)):
    """SSE stream of copilot tokens. Persists the full result + audits on completion."""
    case, _ = await rbac.load_case_with_role(case_id, user, "analyst")
    ctx = await _build_ctx(case, case_id)
    await broadcaster.broadcast(case_id, "copilot_started",
                                {"kind": req.kind, "language": req.language, "by": user["email"], "stream": True})

    async def event_gen():
        collected: list[str] = []
        try:
            async for delta in gemma_orchestrator.generate_stream(
                req.kind, ctx["prompt_ctx"], req.language,
            ):
                collected.append(delta)
                yield f"data: {json.dumps({'delta': delta})}\n\n"
        except Exception as e:  # noqa: BLE001
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            return

        full_text = "".join(collected).strip()
        now = datetime.now(timezone.utc)
        await copilot_coll().update_one(
            {"case_id": case_id, "kind": req.kind, "language": req.language},
            {"$set": {
                "case_id": case_id, "kind": req.kind, "language": req.language,
                "text": full_text, "generated_at": now.isoformat(),
            }},
            upsert=True,
        )
        await audit.record(case_id, user, "copilot_generated",
                           {"kind": req.kind, "language": req.language, "stream": True})
        await broadcaster.broadcast(case_id, "copilot_finished",
                                    {"kind": req.kind, "language": req.language, "stream": True})
        yield f"event: done\ndata: {json.dumps({'text': full_text})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get("/copilot/{kind}", response_model=CopilotResponse)
async def get_cached_copilot(
    case_id: str, kind: str, language: str = "en",
    user: dict = Depends(current_user),
):
    await rbac.load_case_with_role(case_id, user, "viewer")
    doc = await copilot_coll().find_one(
        {"case_id": case_id, "kind": kind, "language": language}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Not generated yet")
    if isinstance(doc.get("generated_at"), str):
        doc["generated_at"] = datetime.fromisoformat(doc["generated_at"])
    return CopilotResponse(**doc)


@router.get("/report")
async def generate_report(case_id: str, user: dict = Depends(current_user)):
    case, _ = await rbac.load_case_with_role(case_id, user, "viewer")
    ctx = await _build_ctx(case, case_id)
    graph = ctx["graph"]; factors = ctx["factors"]
    total = ctx["total"]; bucket = ctx["bucket"]
    recs = recommendation.recommend(graph.nodes, factors)

    cached = await copilot_coll().find_one(
        {"case_id": case_id, "kind": "summary", "language": "en"}, {"_id": 0}
    )
    narrative = cached["text"] if cached else _fallback_narrative(case, factors, bucket, total)

    pdf_ctx = {
        "case": {**case, "risk_score": total, "risk": bucket, "tx_count": len(ctx["txs"])},
        "risk_label": {"freeze": "Freeze Immediately", "monitor": "Monitor", "safe": "Safe"}[bucket],
        "factors": [f.model_dump() for f in factors],
        "chain": [n.model_dump() for n in graph.nodes],
        "recommendations": [r.model_dump() for r in recs],
        "narrative": narrative,
    }
    pdf_bytes = report_generator.build_pdf(pdf_ctx)
    await audit.record(case_id, user, "report_downloaded", {"bytes": len(pdf_bytes)})
    await broadcaster.broadcast(case_id, "report_downloaded", {"by": user["email"]})
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="TraceRoot_{case_id}.pdf"'},
    )


def _fallback_narrative(case, factors, bucket, total) -> str:
    if not factors:
        return "No risk signals fired for this case. No action recommended at this time."
    joined = "; ".join(f"{f.label} (+{f.points})" for f in factors)
    return (
        f"{case['subject']} shows a total risk score of {total}/100 ({bucket}). "
        f"Contributing signals: {joined}. This is a draft narrative — an investigator "
        f"should verify the underlying transactions before taking action."
    )
