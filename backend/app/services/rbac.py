"""RBAC — role checks + case-sharing helpers.

Roles (ascending permission):
  viewer   – read-only (case, graph, risk, copilot cache, audit log)
  analyst  – viewer + generate copilot + upload txs + change status
  owner    – analyst + share/unshare + delete

Access resolution order:
  1. owner_id on the case
  2. entry in `case_shares` with matching user_id
"""
from __future__ import annotations
from typing import Literal, Optional
from datetime import datetime, timezone
from fastapi import HTTPException
from app.core.db import cases_coll, sessions_coll, users_coll

Role = Literal["owner", "analyst", "viewer"]
_ORDER = {"viewer": 0, "analyst": 1, "owner": 2}


def has_role(role: Role, min_role: Role) -> bool:
    return _ORDER[role] >= _ORDER[min_role]


async def load_case_with_role(case_id: str, user: dict, min_role: Role = "viewer") -> tuple[dict, Role]:
    """Fetch the case if the user is owner or a share member with sufficient role."""
    from app.core.db import get_db
    db = get_db()
    doc = await cases_coll().find_one({"case_id": case_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Case not found")

    if doc["owner_id"] == user["user_id"]:
        return doc, "owner"

    share = await db.case_shares.find_one(
        {"case_id": case_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not share:
        raise HTTPException(403, "You do not have access to this case")

    role: Role = share["role"]
    if not has_role(role, min_role):
        raise HTTPException(403, f"Requires role >= {min_role}")
    return doc, role


async def resolve_user_by_email(email: str) -> Optional[dict]:
    return await users_coll().find_one({"email": email.lower().strip()}, {"_id": 0})


async def list_accessible_case_ids(user_id: str) -> list[str]:
    """Cases the user owns OR has been shared on."""
    from app.core.db import get_db
    db = get_db()
    shared = await db.case_shares.find({"user_id": user_id}, {"_id": 0, "case_id": 1}) \
        .to_list(1000)
    return [s["case_id"] for s in shared]
