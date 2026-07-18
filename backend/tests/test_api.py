"""Smoke test — unauthenticated /api/health returns 200."""
from fastapi.testclient import TestClient
from server import app


def test_health():
    client = TestClient(app)
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_protected_route_requires_auth():
    client = TestClient(app)
    r = client.get("/api/cases")
    assert r.status_code == 401
