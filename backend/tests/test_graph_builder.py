"""Unit tests for the graph builder + repository."""
from app.services import graph_builder
from app.repositories.graph_repository import NetworkxGraphRepository


def _tx(s, r, a, d="2026-02-15T10:00:00+00:00"):
    return {"date": d, "sender": s, "receiver": r, "amount": a,
            "currency": "USD", "description": ""}


def test_build_graph_shape():
    txs = [_tx("v", "m1", 100), _tx("m1", "m2", 90), _tx("m2", "cash", 80)]
    payload = graph_builder.build_graph(txs)
    ids = {n.id for n in payload.nodes}
    assert ids == {"v", "m1", "m2", "cash"}
    assert len(payload.edges) == 3


def test_role_classification():
    txs = [_tx("v", "m1", 100), _tx("m1", "cash", 90)]
    payload = graph_builder.build_graph(txs)
    roles = {n.id: n.role for n in payload.nodes}
    assert roles["v"] == "victim"
    assert roles["cash"] == "cashout"


def test_repository_flows():
    repo = NetworkxGraphRepository()
    repo.build([_tx("a", "b", 10), _tx("a", "b", 20), _tx("b", "c", 25)])
    assert repo.out_flow("a") == 30
    assert repo.in_flow("b") == 30
    assert repo.out_flow("b") == 25
