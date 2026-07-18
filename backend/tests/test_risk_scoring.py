"""Unit tests for the risk scoring engine (pure functions, no DB)."""
from datetime import datetime, timedelta, timezone
from app.services import risk_scoring


def _iso(dt): return dt.isoformat()


def _tx(sender, receiver, amount, minutes=0, description=""):
    base = datetime(2026, 2, 15, 10, 0, tzinfo=timezone.utc)
    return {
        "date": _iso(base + timedelta(minutes=minutes)),
        "sender": sender, "receiver": receiver, "amount": amount,
        "currency": "USD", "description": description,
    }


def test_flash_drain_fires():
    txs = [
        _tx("x", "victim", 10000, minutes=0),
        _tx("victim", "y", 9000, minutes=2),
    ]
    fs = risk_scoring.score(txs)
    assert any(f.key == "flash_drain" for f in fs)


def test_structuring_fires():
    txs = [_tx("a", "b", 9800, minutes=i) for i in range(4)]
    fs = risk_scoring.score(txs)
    assert any(f.key == "structuring" for f in fs)


def test_known_mule_fires():
    txs = [_tx("x", "acct_mule_9033", 500)]
    fs = risk_scoring.score(txs)
    assert any(f.key == "known_mule" for f in fs)


def test_safe_case_returns_no_high_signals():
    txs = [_tx("card_1", "merchant_1", 42.50, minutes=0, description="coffee")]
    fs = risk_scoring.score(txs)
    total = risk_scoring.total_points(fs)
    assert risk_scoring.bucket(total) == "safe"


def test_bucket_thresholds():
    assert risk_scoring.bucket(80) == "freeze"
    assert risk_scoring.bucket(50) == "monitor"
    assert risk_scoring.bucket(10) == "safe"
