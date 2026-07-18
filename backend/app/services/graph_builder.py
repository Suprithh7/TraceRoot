"""Graph builder — thin service over GraphRepository.

Enriches nodes with role/risk classification for the frontend.
"""
from __future__ import annotations
from typing import Iterable, List
from app.schemas import GraphNode, GraphEdge, GraphPayload
from app.repositories.graph_repository import NetworkxGraphRepository, GraphRepository
from app.core.config import KNOWN_MULE_ACCOUNTS


def build_graph(transactions: Iterable[dict], repo: GraphRepository | None = None) -> GraphPayload:
    repo = repo or NetworkxGraphRepository()
    txs = list(transactions)
    repo.build(txs)

    nodes_out: List[GraphNode] = []
    for n in repo.nodes():
        role = _classify_role(n["id"], n["total_in"], n["total_out"])
        risk = "freeze" if n["id"] in KNOWN_MULE_ACCOUNTS else _risk_from_role(role)
        nodes_out.append(GraphNode(
            id=n["id"],
            label=_pretty_label(n["id"]),
            role=role,
            risk=risk,
            total_in=round(n["total_in"], 2),
            total_out=round(n["total_out"], 2),
        ))

    edges_out = [
        GraphEdge(
            source=e["source"], target=e["target"],
            amount=round(e["amount"], 2), tx_count=e["tx_count"],
            first_seen=e["first_seen"], last_seen=e["last_seen"],
        )
        for e in repo.edges()
    ]
    return GraphPayload(nodes=nodes_out, edges=edges_out)


def _classify_role(acct: str, tin: float, tout: float) -> str:
    if acct in KNOWN_MULE_ACCOUNTS:
        return "mule"
    if tout > 0 and tin == 0:
        return "victim"
    if tin > 0 and tout == 0:
        return "cashout"
    if tin > 0 and tout > 0 and tout >= 0.7 * tin:
        return "mule"
    return "unknown"


def _risk_from_role(role: str) -> str:
    return {"victim": "safe", "mule": "monitor", "cashout": "monitor",
            "merchant": "safe", "unknown": "safe"}.get(role, "safe")


def _pretty_label(acct: str) -> str:
    # e.g. "acct_mule_9033" -> "acct •• 9033"
    parts = acct.split("_")
    if len(parts) >= 2 and parts[-1].isdigit():
        return f"{parts[0]} •• {parts[-1]}"
    return acct
