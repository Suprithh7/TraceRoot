"""Seed script — creates 3 realistic mock fraud cases for a given user.
Called by /api/seed (idempotent per user)."""
from datetime import datetime, timezone, timedelta
from typing import List
import uuid
from app.core.db import cases_coll, transactions_coll
from app.schemas import TransactionIn
from app.services import ingestion


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _case(subject: str, channel: str, country: str) -> dict:
    return {
        "case_id": f"case_{uuid.uuid4().hex[:12]}",
        "subject": subject,
        "channel": channel,
        "country": country,
        "reported_at": datetime.now(timezone.utc).isoformat(),
        "status": "open",
        "amount": 0.0,
        "currency": "USD",
        "risk": "safe",
        "risk_score": 0,
        "tx_count": 0,
    }


def _flash_drain_case() -> tuple[dict, List[TransactionIn]]:
    c = _case("Anonymous complainant #4471", "Wire + P2P", "US → PH")
    t0 = datetime.now(timezone.utc) - timedelta(hours=4)
    txs = [
        TransactionIn(date=_iso(t0), sender="acct_victim_4471", receiver="acct_victim_4471",
                      amount=48900.0, currency="USD", description="Deposit — brokerage int'l wire"),
        TransactionIn(date=_iso(t0 + timedelta(minutes=3)), sender="acct_victim_4471",
                      receiver="acct_mule_9033", amount=9850.0, description="P2P"),
        TransactionIn(date=_iso(t0 + timedelta(minutes=4)), sender="acct_victim_4471",
                      receiver="acct_mule_9033", amount=9820.0, description="P2P"),
        TransactionIn(date=_iso(t0 + timedelta(minutes=6)), sender="acct_victim_4471",
                      receiver="acct_mule_9033", amount=9800.0, description="P2P"),
        TransactionIn(date=_iso(t0 + timedelta(minutes=8)), sender="acct_mule_9033",
                      receiver="acct_mule_2210", amount=9600.0, description="P2P"),
        TransactionIn(date=_iso(t0 + timedelta(minutes=10)), sender="acct_mule_9033",
                      receiver="acct_mule_2210", amount=9600.0, description="P2P"),
        TransactionIn(date=_iso(t0 + timedelta(minutes=12)), sender="acct_mule_9033",
                      receiver="acct_mule_2210", amount=9600.0, description="P2P"),
        TransactionIn(date=_iso(t0 + timedelta(minutes=14)), sender="acct_mule_2210",
                      receiver="wallet_0x7af2", amount=28500.0, description="Crypto off-ramp — cross-border"),
    ]
    return c, txs


def _elder_case() -> tuple[dict, List[TransactionIn]]:
    c = _case("Elderly complainant #2033", "Wire", "US → HK")
    t0 = datetime.now(timezone.utc) - timedelta(days=1, hours=2)
    txs = [
        TransactionIn(date=_iso(t0), sender="acct_victim_2033", receiver="acct_mule_7761",
                      amount=112500.0, currency="USD", description="Int'l wire — SWIFT"),
        TransactionIn(date=_iso(t0 + timedelta(hours=6)), sender="acct_mule_7761",
                      receiver="acct_mule_3390", amount=110200.0, description="Int'l wire"),
        TransactionIn(date=_iso(t0 + timedelta(hours=12)), sender="acct_mule_3390",
                      receiver="wallet_0x1b9c", amount=108900.0, description="OTC crypto — cross-border"),
    ]
    return c, txs


def _safe_case() -> tuple[dict, List[TransactionIn]]:
    c = _case("Retail — card-not-present", "Card", "US → US")
    t0 = datetime.now(timezone.utc) - timedelta(hours=6)
    txs = [
        TransactionIn(date=_iso(t0), sender="card_0912", receiver="merchant_44201",
                      amount=2140.0, description="Online purchase"),
    ]
    return c, txs


async def seed_for_user(user_id: str) -> List[str]:
    """Idempotent: does nothing if user already has cases."""
    existing = await cases_coll().count_documents({"owner_id": user_id})
    if existing > 0:
        return []
    created: List[str] = []
    for factory in (_flash_drain_case, _elder_case, _safe_case):
        case_doc, txs = factory()
        case_doc["owner_id"] = user_id
        await cases_coll().insert_one(case_doc)
        await ingestion.ingest(case_doc["case_id"], txs)
        # score inline
        from app.api.cases import _rescore_case
        await _rescore_case(case_doc["case_id"])
        created.append(case_doc["case_id"])
    return created
