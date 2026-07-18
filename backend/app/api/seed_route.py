"""Seed endpoint — creates demo cases for the logged-in user (idempotent)."""
from fastapi import APIRouter, Depends
from app.api.auth import current_user
from app.seed import seed_for_user

router = APIRouter(tags=["seed"])


@router.post("/seed")
async def seed(user: dict = Depends(current_user)):
    created = await seed_for_user(user["user_id"])
    return {"created": created, "count": len(created)}
