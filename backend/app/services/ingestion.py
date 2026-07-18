"""Ingestion service — validates + normalizes transaction rows,
persists them, and returns counts.

Accepts either JSON list (from API) or CSV bytes.
"""
from __future__ import annotations
import csv
import io
from typing import List, Tuple
from datetime import datetime, timezone
from app.schemas import TransactionIn, Transaction, IngestResponse
from app.core.db import transactions_coll


CSV_REQUIRED = {"date", "sender", "receiver", "amount"}


def parse_csv(raw: bytes) -> Tuple[List[TransactionIn], List[str]]:
    """Return (rows, errors). Never raises on bad rows — reports them."""
    txt = raw.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(txt))
    if not reader.fieldnames or not CSV_REQUIRED.issubset({f.lower() for f in reader.fieldnames}):
        return [], [f"CSV missing required columns. Need: {sorted(CSV_REQUIRED)}"]

    rows: List[TransactionIn] = []
    errors: List[str] = []
    # Normalize field lookup case-insensitively
    for i, r in enumerate(reader, start=2):
        rr = {k.lower(): (v or "").strip() for k, v in r.items() if k}
        try:
            rows.append(TransactionIn(
                date=rr["date"],
                sender=rr["sender"],
                receiver=rr["receiver"],
                amount=float(rr["amount"]),
                currency=rr.get("currency") or "USD",
                description=rr.get("description") or "",
            ))
        except Exception as e:  # noqa: BLE001
            errors.append(f"row {i}: {e}")
    return rows, errors


async def ingest(case_id: str, rows: List[TransactionIn]) -> IngestResponse:
    """Persist txs for a case. Returns counts."""
    if not rows:
        return IngestResponse(case_id=case_id, accepted=0, rejected=0)
    docs = [Transaction(case_id=case_id, **r.model_dump()).model_dump() for r in rows]
    await transactions_coll().insert_many(docs)
    return IngestResponse(case_id=case_id, accepted=len(docs), rejected=0)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
