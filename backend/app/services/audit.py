"""Audit log — every meaningful action on a case is recorded here.

Actions used:
  case_created, csv_uploaded, copilot_generated, report_downloaded,
  status_changed, case_shared, case_unshared, case_deleted
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict
import uuid
from app.core.db import get_db


async def record(case_id: str, actor: Dict[str, Any], action: str, meta: Dict[str, Any] | None = None) -> None:
    """Fire-and-forget audit write."""
    db = get_db()
    await db.audit_logs.insert_one({
        "entry_id": f"aud_{uuid.uuid4().hex[:12]}",
        "case_id": case_id,
        "actor_user_id": actor.get("user_id"),
        "actor_email": actor.get("email"),
        "actor_name": actor.get("name"),
        "action": action,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def list_for_case(case_id: str, limit: int = 200) -> list[dict]:
    db = get_db()
    docs = await db.audit_logs.find({"case_id": case_id}, {"_id": 0}) \
        .sort("created_at", -1).to_list(limit)
    return docs
