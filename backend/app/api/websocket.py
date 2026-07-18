"""WebSocket endpoint: /api/ws/cases/{case_id}

Auth: reads `session_token` from a cookie OR the `token` query param
(so the browser WebSocket API can send it — cookies work same-origin but
some proxies strip them, so `?token=...` is the reliable path).
"""
from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.db import sessions_coll, users_coll
from app.core.db import cases_coll
from app.services.broadcaster import broadcaster

router = APIRouter(tags=["websocket"])


async def _authenticate(session_token: str | None) -> dict | None:
    if not session_token:
        return None
    session = await sessions_coll().find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        return None
    exp = session.get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < datetime.now(timezone.utc):
        return None
    user = await users_coll().find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


async def _user_has_case_access(case_id: str, user: dict) -> bool:
    doc = await cases_coll().find_one({"case_id": case_id}, {"_id": 0, "owner_id": 1})
    if not doc:
        return False
    if doc["owner_id"] == user["user_id"]:
        return True
    from app.core.db import get_db
    share = await get_db().case_shares.find_one(
        {"case_id": case_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return share is not None


@router.websocket("/ws/cases/{case_id}")
async def case_ws(websocket: WebSocket, case_id: str, token: str | None = Query(default=None)):
    # Try query param first, fall back to cookie
    session_token = token or websocket.cookies.get("session_token")
    user = await _authenticate(session_token)
    if not user:
        await websocket.close(code=4401)
        return
    if not await _user_has_case_access(case_id, user):
        await websocket.close(code=4403)
        return

    await broadcaster.connect(case_id, websocket)
    # Send hello so the client knows the handshake was accepted
    try:
        await websocket.send_json({
            "event": "connected",
            "payload": {"user": user["email"]},
            "at": datetime.now(timezone.utc).isoformat(),
        })
        while True:
            # Consume client pings/messages (we don't process them, just keep alive)
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await broadcaster.disconnect(case_id, websocket)
