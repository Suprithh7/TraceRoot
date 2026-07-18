"""Recommendation Engine — per-account Freeze / Monitor / Safe with a reason.

Consumes graph nodes + risk factors. Human always makes the final call.
"""
from __future__ import annotations
from typing import List, Dict, Any
from app.schemas import Recommendation, GraphNode, RiskFactor


def recommend(nodes: List[GraphNode], factors: List[RiskFactor]) -> List[Recommendation]:
    factor_keys = {f.key for f in factors}
    out: List[Recommendation] = []
    for n in nodes:
        verdict, reason = _decide(n, factor_keys)
        out.append(Recommendation(
            account_id=n.id, label=n.label, verdict=verdict, reason=reason,
        ))
    return out


def _decide(n: GraphNode, factor_keys: set) -> tuple[str, str]:
    if n.role == "victim":
        return "safe", "Origin of funds; treat as victim, protect and monitor for further outflows."
    if n.risk == "freeze" or n.role == "mule" and ("known_mule" in factor_keys or "flash_drain" in factor_keys):
        return "freeze", (
            "Matches mule watchlist or participated in a flash-drain pattern. "
            "Recommend immediate freeze under 314(b) safe-harbor; human review required."
        )
    if n.role == "cashout":
        return "freeze", "Terminal node in the chain; freeze to prevent asset dissipation."
    if n.role == "mule":
        return "monitor", "Behavioral match for money-mule role; monitor for 14 days and elevate on any new outflow."
    return "safe", "No risk signals matched. Continue passive monitoring."
