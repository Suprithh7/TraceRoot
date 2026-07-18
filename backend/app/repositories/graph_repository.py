"""Abstract graph repository — NetworkX today, Neo4j swap tomorrow.

The rest of the app depends only on this interface. Never import networkx
outside this file.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Iterable, List, Dict
import networkx as nx


class GraphRepository(ABC):
    @abstractmethod
    def build(self, transactions: Iterable[dict]) -> None: ...

    @abstractmethod
    def nodes(self) -> List[dict]: ...

    @abstractmethod
    def edges(self) -> List[dict]: ...

    @abstractmethod
    def in_flow(self, account_id: str) -> float: ...

    @abstractmethod
    def out_flow(self, account_id: str) -> float: ...

    @abstractmethod
    def paths_from(self, source: str, max_depth: int = 5) -> List[List[str]]: ...


class NetworkxGraphRepository(GraphRepository):
    """In-memory NetworkX MultiDiGraph. One instance per case."""

    def __init__(self) -> None:
        self._g: nx.MultiDiGraph = nx.MultiDiGraph()

    def build(self, transactions: Iterable[dict]) -> None:
        self._g.clear()
        edge_agg: Dict[tuple, dict] = {}
        for tx in transactions:
            s, r = tx["sender"], tx["receiver"]
            self._g.add_node(s)
            self._g.add_node(r)
            key = (s, r)
            agg = edge_agg.setdefault(
                key,
                {"amount": 0.0, "tx_count": 0, "first_seen": tx["date"], "last_seen": tx["date"]},
            )
            agg["amount"] += float(tx["amount"])
            agg["tx_count"] += 1
            if tx["date"] < agg["first_seen"]:
                agg["first_seen"] = tx["date"]
            if tx["date"] > agg["last_seen"]:
                agg["last_seen"] = tx["date"]
        for (s, r), agg in edge_agg.items():
            self._g.add_edge(s, r, **agg)

    def nodes(self) -> List[dict]:
        out = []
        for n in self._g.nodes():
            out.append({
                "id": n,
                "total_out": sum(d["amount"] for _, _, d in self._g.out_edges(n, data=True)),
                "total_in": sum(d["amount"] for _, _, d in self._g.in_edges(n, data=True)),
            })
        return out

    def edges(self) -> List[dict]:
        return [
            {"source": s, "target": r, **d}
            for s, r, d in self._g.edges(data=True)
        ]

    def in_flow(self, account_id: str) -> float:
        if account_id not in self._g:
            return 0.0
        return sum(d["amount"] for _, _, d in self._g.in_edges(account_id, data=True))

    def out_flow(self, account_id: str) -> float:
        if account_id not in self._g:
            return 0.0
        return sum(d["amount"] for _, _, d in self._g.out_edges(account_id, data=True))

    def paths_from(self, source: str, max_depth: int = 5) -> List[List[str]]:
        if source not in self._g:
            return []
        # simple DFS over unique successor chains
        results: List[List[str]] = []
        stack = [(source, [source])]
        while stack:
            node, path = stack.pop()
            successors = list(self._g.successors(node))
            if not successors or len(path) >= max_depth:
                results.append(path)
                continue
            for nxt in successors:
                if nxt in path:  # avoid cycles
                    continue
                stack.append((nxt, path + [nxt]))
        return results
