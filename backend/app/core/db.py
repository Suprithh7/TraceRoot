"""Async Mongo client + collection accessors."""
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import MONGO_URL, DB_NAME

_client = AsyncIOMotorClient(MONGO_URL)
_db = _client[DB_NAME]


def get_db():
    return _db


def close_db():
    _client.close()


# Collection accessors (typed helpers)
def users_coll():        return _db.users
def sessions_coll():     return _db.user_sessions
def cases_coll():        return _db.cases
def accounts_coll():     return _db.accounts
def transactions_coll(): return _db.transactions
def risk_coll():         return _db.risk_scores
def reports_coll():      return _db.reports
def copilot_coll():      return _db.copilot_outputs
