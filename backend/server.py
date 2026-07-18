"""TraceRoot FastAPI entry point — mounts all routers under /api."""
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import logging

from app.core.config import CORS_ORIGINS
from app.core.db import close_db
from app.api import auth as auth_api
from app.api import cases as cases_api
from app.api import case_detail as case_detail_api
from app.api import shares as shares_api
from app.api import seed_route

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="TraceRoot API", version="0.5.0")

# All API routes live under /api
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "traceroot", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"ok": True}


api_router.include_router(auth_api.router)
api_router.include_router(cases_api.router)
api_router.include_router(case_detail_api.router)
api_router.include_router(shares_api.router)
api_router.include_router(seed_route.router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    close_db()
