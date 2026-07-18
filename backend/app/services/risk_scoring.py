"""Rule-based, fully explainable risk scoring engine.

Every factor is additive and returns a `RiskFactor` describing WHY it fired.
No opaque numeric aggregation — the frontend/UI shows the same breakdown.
"""
from __future__ import annotations
from datetime import datetime
from typing import List, Iterable
from collections import defaultdict
from app.schemas import RiskFactor
from app.core.config import (
    RISK_WEIGHTS, FLASH_DRAIN_WINDOW_MIN, STRUCTURING_THRESHOLD,
    STRUCTURING_BUFFER, RAPID_TX_MIN_COUNT, RAPID_TX_WINDOW_HOURS,
    KNOWN_MULE_ACCOUNTS,
)


def _parse(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def score(transactions: Iterable[dict]) -> List[RiskFactor]:
    """Return list of firing risk factors given a case's transactions."""
    txs = sorted(transactions, key=lambda t: t["date"])
    factors: List[RiskFactor] = []
    if not txs:
        return factors

    _flash_drain(txs, factors)
    _structuring(txs, factors)
    _known_mule(txs, factors)
    _rapid_transfers(txs, factors)
    _cross_border(txs, factors)
    _off_hours(txs, factors)
    _round_dollar(txs, factors)
    return factors


def total_points(factors: List[RiskFactor]) -> int:
    return min(100, sum(f.points for f in factors))


def bucket(total: int) -> str:
    if total >= 75:
        return "freeze"
    if total >= 40:
        return "monitor"
    return "safe"


# ---- individual rules -------------------------------------------------------

def _flash_drain(txs: List[dict], out: List[RiskFactor]) -> None:
    """Balance drained shortly after a large deposit."""
    by_acct = defaultdict(list)
    for t in txs:
        by_acct[t["receiver"]].append(("in", t))
        by_acct[t["sender"]].append(("out", t))
    for acct, events in by_acct.items():
        # find first significant "in" and see if a big "out" happens within window
        events.sort(key=lambda e: e[1]["date"])
        inflows = [e[1] for e in events if e[0] == "in"]
        outflows = [e[1] for e in events if e[0] == "out"]
        for inflow in inflows:
            t0 = _parse(inflow["date"])
            drained = 0.0
            for o in outflows:
                dt = (_parse(o["date"]) - t0).total_seconds() / 60.0
                if 0 <= dt <= FLASH_DRAIN_WINDOW_MIN:
                    drained += float(o["amount"])
            if drained >= 0.7 * float(inflow["amount"]) and drained > 0:
                pct = int(min(100, 100 * drained / float(inflow["amount"])))
                out.append(RiskFactor(
                    key="flash_drain",
                    label="Flash Drain",
                    points=RISK_WEIGHTS["flash_drain"],
                    meta=f"{pct}% of ${float(inflow['amount']):,.0f} inflow drained within {FLASH_DRAIN_WINDOW_MIN}m",
                ))
                return  # fire once


def _structuring(txs: List[dict], out: List[RiskFactor]) -> None:
    just_under = [
        t for t in txs
        if STRUCTURING_THRESHOLD - STRUCTURING_BUFFER <= float(t["amount"]) < STRUCTURING_THRESHOLD
    ]
    if len(just_under) >= 3:
        out.append(RiskFactor(
            key="structuring",
            label="Structuring",
            points=RISK_WEIGHTS["structuring"],
            meta=f"{len(just_under)} tx just under ${STRUCTURING_THRESHOLD:,} CTR threshold",
        ))


def _known_mule(txs: List[dict], out: List[RiskFactor]) -> None:
    hits = {t["receiver"] for t in txs if t["receiver"] in KNOWN_MULE_ACCOUNTS}
    hits |= {t["sender"] for t in txs if t["sender"] in KNOWN_MULE_ACCOUNTS}
    if hits:
        out.append(RiskFactor(
            key="known_mule",
            label="Known Mule Endpoint",
            points=RISK_WEIGHTS["known_mule"],
            meta=f"{len(hits)} account(s) match mule watchlist",
        ))


def _rapid_transfers(txs: List[dict], out: List[RiskFactor]) -> None:
    if len(txs) < RAPID_TX_MIN_COUNT:
        return
    first = _parse(txs[0]["date"])
    last = _parse(txs[-1]["date"])
    hours = max((last - first).total_seconds() / 3600.0, 0.01)
    if hours <= RAPID_TX_WINDOW_HOURS and len(txs) >= RAPID_TX_MIN_COUNT:
        rate = len(txs) / hours
        if rate >= 0.4:  # >~10/day
            out.append(RiskFactor(
                key="rapid_transfers",
                label="Velocity Spike",
                points=RISK_WEIGHTS["rapid_transfers"],
                meta=f"{len(txs)} tx in {hours:.1f}h ({rate:.1f} tx/h)",
            ))


def _cross_border(txs: List[dict], out: List[RiskFactor]) -> None:
    for t in txs:
        desc = (t.get("description") or "").lower()
        if "int'l" in desc or "swift" in desc or "cross-border" in desc:
            out.append(RiskFactor(
                key="cross_border",
                label="Cross-border Escalation",
                points=RISK_WEIGHTS["cross_border"],
                meta="At least one international wire in this chain",
            ))
            return


def _off_hours(txs: List[dict], out: List[RiskFactor]) -> None:
    off = [t for t in txs if _parse(t["date"]).hour in (0, 1, 2, 3, 4)]
    if len(off) >= 2:
        out.append(RiskFactor(
            key="off_hours",
            label="Off-hours Transfers",
            points=RISK_WEIGHTS["off_hours"],
            meta=f"{len(off)} tx between 00:00–04:59",
        ))


def _round_dollar(txs: List[dict], out: List[RiskFactor]) -> None:
    rd = [t for t in txs if float(t["amount"]).is_integer() and float(t["amount"]) >= 500]
    if len(rd) >= max(3, len(txs) // 2):
        out.append(RiskFactor(
            key="round_dollar",
            label="Round-Dollar Pattern",
            points=RISK_WEIGHTS["round_dollar"],
            meta=f"{len(rd)}/{len(txs)} tx are round amounts",
        ))
