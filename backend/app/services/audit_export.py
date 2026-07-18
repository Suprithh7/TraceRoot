"""Audit export — CSV + tamper-evident signed JSON.

Signed JSON format:
{
  "case_id": "...",
  "generated_at": "...ISO...",
  "algorithm": "HMAC-SHA256",
  "entries": [ ... audit entries, sorted by created_at asc ... ],
  "content_hash": "sha256:<hex>",   # SHA-256 over canonical JSON of `entries`
  "signature":     "hmac-sha256:<hex>",  # HMAC-SHA256(key, canonical_bytes)
  "verification": {
    "canonical_json_algorithm": "json.dumps(sort_keys=True, separators=(',',':'), ensure_ascii=False)",
    "how_to_verify": "See README ('Verifying an audit export')."
  }
}
"""
from __future__ import annotations
import csv
import hashlib
import hmac
import io
import json
import os
from datetime import datetime, timezone
from typing import Iterable

_ALG = "HMAC-SHA256"
_CANONICAL_NOTE = "json.dumps(sort_keys=True, separators=(',',':'), ensure_ascii=False)"


def _canonical(entries: Iterable[dict]) -> bytes:
    return json.dumps(list(entries), sort_keys=True,
                      separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def signed_json(case_id: str, entries: list[dict]) -> dict:
    """Return the signed-JSON envelope for a case's audit trail."""
    ordered = sorted(entries, key=lambda e: e.get("created_at", ""))
    canonical = _canonical(ordered)
    content_hash = hashlib.sha256(canonical).hexdigest()

    key = os.environ.get("AUDIT_HMAC_KEY", "")
    if not key:
        raise RuntimeError("AUDIT_HMAC_KEY not configured")
    sig = hmac.new(key.encode("utf-8"), canonical, hashlib.sha256).hexdigest()

    return {
        "case_id": case_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": _ALG,
        "entries": ordered,
        "content_hash": f"sha256:{content_hash}",
        "signature": f"hmac-sha256:{sig}",
        "verification": {
            "canonical_json_algorithm": _CANONICAL_NOTE,
            "how_to_verify": "See README section 'Verifying an audit export'.",
        },
    }


def to_csv(entries: list[dict]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["created_at", "actor_email", "actor_name", "action", "meta"])
    for e in sorted(entries, key=lambda e: e.get("created_at", "")):
        writer.writerow([
            e.get("created_at", ""),
            e.get("actor_email", ""),
            e.get("actor_name", ""),
            e.get("action", ""),
            json.dumps(e.get("meta", {}), sort_keys=True, ensure_ascii=False),
        ])
    return buf.getvalue().encode("utf-8")
