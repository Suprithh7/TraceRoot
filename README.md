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

## Swapping to local Gemma
Replace `_call_llm` inside `app/services/gemma_orchestrator.py` with an Ollama
HTTP call. No other file needs to change — the orchestrator is the only place
the app talks to a model.
