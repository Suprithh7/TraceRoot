# TraceRoot — AI Fraud Investigation Platform

## Original Problem Statement
Production-grade full-stack fraud investigation platform for cybercrime investigators,
built as a real modular application (ingestion → risk scoring → graph builder →
Gemma orchestrator → recommendation engine → PDF report generator), following the
exact architecture and folder structure in the brief.

## User Personas
- Cybercrime / fraud investigator at a financial institution or law-enforcement agency
- Financial compliance officer reviewing SAR-worthy cases and freeze recommendations

## Adaptations for Emergent Platform
- **DB**: MongoDB (`motor`) instead of Postgres. Alembic migrations not applicable.
- **Async jobs**: FastAPI `BackgroundTasks` instead of Redis queue.
- **LLM**: Gemini 3 Flash via Emergent LLM key (closest hosted Gemma-family model),
  wrapped behind `gemma_orchestrator.generate()` — swap `_call_llm` to Ollama for
  on-prem Gemma without touching any other file.
- **Auth**: Emergent-managed Google OAuth + mocked 6-digit OTP demo flow.
- **PDF**: ReportLab (no system deps) instead of WeasyPrint.
- **Frontend**: React 19 + JSX + CRA (template default), not Vite/TS.

## Backend Layout
```
backend/
  server.py                     # FastAPI entry, mounts routers under /api
  app/
    api/
      auth.py                   # /api/auth/session, /auth/me, /auth/logout
      cases.py                  # /api/cases (CRUD + CSV upload)
      case_detail.py            # /api/cases/{id}/risk-scores, /graph, /copilot,
                                #  /copilot/{kind}, /recommendations, /report
      seed_route.py             # /api/seed
    core/
      config.py                 # env + risk weights + mule watchlist
      db.py                     # motor client + collection accessors
    services/
      ingestion.py              # CSV parsing + validation
      risk_scoring.py           # 7 explainable, additive rules
      graph_builder.py          # NetworkX-backed money-flow graph
      gemma_orchestrator.py     # LLM wrapper (Gemma-swappable)
      recommendation.py         # per-account Freeze/Monitor/Safe verdicts
      report_generator.py       # ReportLab court-ready PDF
    repositories/
      graph_repository.py       # GraphRepository ABC + NetworkX impl
    schemas.py                  # Pydantic v2 request/response schemas
    seed.py                     # 3 realistic mock fraud cases
  tests/
    test_risk_scoring.py        # 5 tests
    test_graph_builder.py       # 3 tests
    test_api.py                 # 2 tests (10/10 pass)
```

## Frontend Layout
```
frontend/
  src/
    components/
      SignInPage.jsx            # Google + mock OTP + shader background
      Dashboard.jsx             # Real dashboard (sidebar, cases, ingest panel, seed)
      CanvasRevealEffect.jsx    # GLSL dot-matrix shader (login only)
      CaseDetail.jsx            # (legacy demo detail, unused by real flow)
    features/
      auth/{AuthCallback,ProtectedRoute}.jsx
      dashboard/{CaseWorkspace,DemoDashboard}.jsx
      graph/CaseGraph.jsx       # Cytoscape.js money-flow graph
      copilot/CopilotPanel.jsx  # AI copilot tabs + EN/HI/TA language switch
      timeline/CaseTimeline.jsx # Vertical event timeline
    lib/{api,auth,reportPrint}.js/jsx
    data/mockCases.js           # Legacy demo data (used by DemoDashboard only)
```

## What's Implemented (2026-02-18)
- Real backend end-to-end: signed-in user can create/delete cases, upload CSV,
  auto-score, view graph + risk + copilot + timeline + recommendations, download PDF.
- 7 explainable risk rules (flash drain, structuring, known mule, velocity, cross-border,
  off-hours, round-dollar) — every factor returns a WHY string, no opaque scoring.
- Cytoscape graph with role-based shapes (round-rect / diamond / hexagon) and risk colors.
- LLM copilot returns 4 kinds (summary, report, freeze justification, next steps) in
  English/Hindi/Tamil, results cached per case/kind/lang in Mongo.
- ReportLab PDF with case header, risk-colored pill, meta grid, executive summary,
  chain, signal table, per-account recommendation table.
- Emergent Google OAuth (real sessions, httpOnly cookies) + mocked OTP for demos.
- 3 realistic seeded fraud cases (flash-drain PH mule ring, elder-fraud HK wire, retail safe).
- 10 pytest unit tests, all passing.

## Environment
Everything env-driven: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `EMERGENT_LLM_KEY`
(backend); `REACT_APP_BACKEND_URL` (frontend). `.env.example` provided for backend.

## Backlog / Next
- P1: SSE streaming for LLM copilot (`stream_message`) so tokens arrive live.
- P1: WebSocket case-updates channel (multiple analysts on one case).
- P2: Real Google auth flow tested in-browser (currently verified via cookie injection).
- P2: Multi-user case sharing / RBAC.
- P2: Neo4j swap-in for `GraphRepository` when case volume outgrows in-memory NetworkX.
- P2: WeasyPrint as an optional richer PDF renderer.
- P2: Ingestion job queue (Redis + Celery) once workloads are large enough to matter.
