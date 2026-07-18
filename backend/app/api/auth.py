"""Auth: Emergent-managed Google OAuth session exchange + /me + logout."""
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import httpx
from fastapi import APIRouter, HTTPException, Response, Request, Cookie
from pydantic import BaseModel
from app.core.db import users_coll, sessions_coll

router = APIRouter(prefix="/auth", tags=["auth"])

_EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class SessionExchange(BaseModel):
    session_id: str


@router.post("/session")
async def exchange_session(payload: SessionExchange, response: Response):
    """Frontend calls this with the session_id from the URL fragment.
    Backend fetches user data from Emergent, stores session, sets cookie."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            _EMERGENT_SESSION_URL,
            headers={"X-Session-ID": payload.session_id},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = r.json()

    email = data["email"]
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data["session_token"]

    # Upsert user (by email)
    existing = await users_coll().find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await users_coll().update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await users_coll().insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await sessions_coll().insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(
        key="session_token", value=session_token,
        max_age=7 * 24 * 60 * 60, httponly=True,
        secure=True, samesite="none", path="/",
    )
    return {"user_id": user_id, "email": email, "name": name, "picture": picture}


@router.get("/me")
async def me(request: Request, session_token: Optional[str] = Cookie(default=None)):
    token = session_token
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await sessions_coll().find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await users_coll().find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # created_at may be datetime; serialize
    if isinstance(user.get("created_at"), datetime):
        user["created_at"] = user["created_at"].isoformat()
    return user


@router.post("/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(default=None)):
    if session_token:
        await sessions_coll().delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}


async def current_user(
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
):
    """Dependency for protected routes."""
    token = session_token
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await sessions_coll().find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await users_coll().find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
