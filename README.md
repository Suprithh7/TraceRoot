# TraceRoot

AI-assisted fraud investigation platform for cybercrime investigators.

## Stack
- **Backend:** FastAPI (Python 3.11+), MongoDB (via `motor`), NetworkX,
  ReportLab, Emergent LLM key → Gemini 3 Flash (Gemma-family model, hosted).
  Interface designed so it can be swapped for local Ollama Gemma.
- **Frontend:** React 19 + JSX + Tailwind + Framer Motion + Cytoscape.js + Recharts.
- **Auth:** Emergent-managed Google OAuth + mocked 6-digit OTP screen.
- **Async jobs:** FastAPI `BackgroundTasks` (no Redis needed for this deploy).

## Layout
```
backend/
  server.py                       # FastAPI entry, mounts routers under /api
  app/
    api/                          # routers: auth, cases, case_detail, seed
    core/                         # config, db
    services/                     # ingestion, risk_scoring, graph_builder,
                                  # gemma_orchestrator, recommendation, report_generator
    repositories/                 # GraphRepository abstract + NetworkX impl
    schemas.py                    # Pydantic v2 schemas
    seed.py                       # demo cases seed
  tests/                          # pytest (risk, graph, api smoke)
frontend/
  src/
    features/{auth,dashboard,graph,copilot,reports,timeline}
    components/ui/                # shadcn primitives
    lib/                          # api client, print helper
```

## Environment
Everything is env-driven (`backend/.env`, `frontend/.env`) — never hardcoded.
- `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `EMERGENT_LLM_KEY` (backend)
- `REACT_APP_BACKEND_URL` (frontend)

## Run locally
```bash
# backend
cd backend && pip install -r requirements.txt
# frontend
cd frontend && yarn install
# both are supervisor-managed in this environment (hot reload)

# tests
cd backend && pytest -q
```

## Seed demo data
After signing in, click **Seed demo cases** on the dashboard (or `POST /api/seed`)
to load 3 realistic mock fraud cases.

## Verifying an audit export

The `Signed JSON` export endpoint (`GET /api/cases/{id}/audit/export?format=json`)
returns an envelope like this:

```json
{
  "case_id": "case_...",
  "generated_at": "2026-02-...Z",
  "algorithm": "HMAC-SHA256",
  "entries": [ ... audit entries, sorted by created_at asc ... ],
  "content_hash": "sha256:<hex>",
  "signature":    "hmac-sha256:<hex>",
  "verification": {
    "canonical_json_algorithm":
      "json.dumps(sort_keys=True, separators=(',',':'), ensure_ascii=False)",
    "how_to_verify": "See README section 'Verifying an audit export'."
  }
}
```

To verify tamper-evidence, an investigator (or reviewing court) computes:

```python
import json, hmac, hashlib

with open("TraceRoot_audit_<case>.signed.json") as f:
    envelope = json.load(f)

canonical = json.dumps(
    envelope["entries"], sort_keys=True,
    separators=(",", ":"), ensure_ascii=False,
).encode("utf-8")

# 1) Content hash — no shared secret required
expected_hash = "sha256:" + hashlib.sha256(canonical).hexdigest()
assert expected_hash == envelope["content_hash"]

# 2) Signature — needs the AUDIT_HMAC_KEY that signed it
AUDIT_HMAC_KEY = "..."  # shared out-of-band with the reviewer
expected_sig = "hmac-sha256:" + hmac.new(
    AUDIT_HMAC_KEY.encode("utf-8"), canonical, hashlib.sha256,
).hexdigest()
assert expected_sig == envelope["signature"]
```

Any change to any entry — reordering, editing metadata, adding a fake row —
invalidates both hash and signature. The key is loaded from `AUDIT_HMAC_KEY`
in the backend `.env`; rotate it by exporting a fresh signed JSON before the
old key is retired.

## Swapping to local Gemma
Replace `_call_llm` inside `app/services/gemma_orchestrator.py` with an Ollama
HTTP call. No other file needs to change — the orchestrator is the only place
the app talks to a model.
