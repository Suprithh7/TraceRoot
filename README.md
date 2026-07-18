# 🔍 TraceRoot

**AI-assisted fraud investigation platform for cybercrime investigators.**

> Money doesn't disappear in cyber fraud — it moves. Through five, ten, sometimes fifteen mule accounts in minutes. TraceRoot turns that invisible trail into a visual, explainable, court-ready case in the time it takes to upload a CSV.

---

## 📌 Table of Contents

- [Problem Statement](#-problem-statement)
- [What TraceRoot Does](#-what-traceroot-does)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Investigation Workflow](#-investigation-workflow)
- [Backend Module Design](#-backend-module-design)
- [Gemma Integration](#-gemma-integration)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Audit Trail & Tamper-Evidence](#-audit-trail--tamper-evidence)
- [Challenges We Faced](#-challenges-we-faced)
- [Future Scope](#-future-scope)
- [Responsible AI](#-responsible-ai)

---

## 🎯 Problem Statement

Cybercrime investigators today rely on manual bank-statement tracing and spreadsheets to follow stolen money through layered mule accounts. This is slow, error-prone, and gives fraud rings a critical head start — by the time a trail is manually reconstructed, the money has usually already been withdrawn or moved beyond recovery.

There is no tool that combines **explainable risk detection**, **visual money-flow mapping**, and **AI-assisted report writing** in one investigator-first workflow — while keeping a human squarely in control of every freeze decision.

**TraceRoot solves this.**

---

## ✅ What TraceRoot Does

1. Investigator uploads transaction data for a case.
2. Explainable rule-based detectors score every transaction — no black-box ML confidence numbers.
3. Transactions are transformed into an interactive fraud graph — victim → mule(s) → destination.
4. Gemma acts as an **AI Investigation Co-pilot** — not a chatbot — generating summaries, reports, freeze justifications, and regional-language translations from the graph context.
5. The dashboard recommends accounts to freeze, with full reasoning attached.
6. The investigator approves, edits, or rejects — **Gemma never makes the final call.**
7. Every action is logged in a tamper-evident, HMAC-signed audit trail suitable for court submission.

---

## ⭐ Key Features

| Feature | Description |
|---|---|
| **Explainable Risk Scoring** | Five named fraud-pattern detectors (Flash Drain, Structuring, Mule Account Behaviour, Transaction Velocity, Known Account Reuse) — every score traces to a rule, not a mystery model output. |
| **Interactive Fraud Graph** | Cytoscape.js-powered visualization of money flow across accounts, built with NetworkX on the backend. |
| **Gemma AI Co-pilot** | Generates executive summaries, investigation reports, compliance docs, freeze justifications, next-action recommendations, and regional language translations. |
| **Human-in-the-Loop Decisions** | Every AI recommendation requires explicit investigator sign-off before any action is logged. |
| **Tamper-Evident Audit Trail** | HMAC-SHA256 signed JSON export — any edit to any entry invalidates the signature, verifiable independently in court. |
| **Court-Format Report Generator** | One-click PDF generation via ReportLab, styled for legal/compliance submission. |
| **Swappable LLM Backend** | Ships wired to a hosted Gemma-family model (Gemini 3 Flash via Emergent LLM key) but architected so `gemma_orchestrator.py` is the *only* file touched to swap to local Ollama Gemma — zero other code changes required. |
| **Google OAuth + OTP Auth** | Investigator-only access, gated behind Google sign-in and a verification step. |

---

## 🏗 System Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                     FRONTEND — React 19 Dashboard                     │
│  ┌──────────────┐  ┌───────────────────┐  ┌────────────────────────┐  │
│  │  Auth         │  │  Fraud Graph View │  │  Copilot / Reports    │  │
│  │  (OAuth+OTP)  │  │  (Cytoscape.js)   │  │  (Timeline, Recharts) │  │
│  └──────────────┘  └───────────────────┘  └────────────────────────┘  │
│           Tailwind · Framer Motion · shadcn/ui primitives              │
└──────────────────────────────────┬──────────────────────────────────────┘
                                    │  REST (/api/*)
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    BACKEND — FastAPI (Python 3.11+)                    │
│                                                                          │
│  ┌────────────┐   ┌────────────────┐   ┌───────────────────────────┐   │
│  │ auth router │   │ cases router   │   │ case_detail / seed router│   │
│  └────────────┘   └───────┬────────┘   └───────────────────────────┘   │
│                            │                                            │
│                            ▼                                            │
│                   ┌─────────────────┐                                   │
│                   │ Ingestion       │                                   │
│                   │ Service         │                                   │
│                   └────────┬────────┘                                   │
│                            ▼                                            │
│                   ┌─────────────────┐                                   │
│                   │ Risk Scoring    │                                   │
│                   │ Service         │                                   │
│                   └────────┬────────┘                                   │
│                            ▼                                            │
│                   ┌─────────────────┐        ┌─────────────────────┐    │
│                   │ Graph Builder   │───────▶│ GraphRepository     │    │
│                   │ Service         │        │ (NetworkX impl)     │    │
│                   └────────┬────────┘        └─────────────────────┘    │
│                            ▼                                            │
│                   ┌─────────────────┐                                   │
│                   │ Gemma           │◀──── the ONLY file touched        │
│                   │ Orchestrator    │       to swap hosted↔local Gemma  │
│                   └────────┬────────┘                                   │
│                            ▼                                            │
│         ┌──────────────────┴───────────────────┐                        │
│         ▼                                      ▼                        │
│  ┌─────────────────┐                 ┌──────────────────────┐           │
│  │ Recommendation  │                 │ Report Generator      │           │
│  │ Service         │                 │ (ReportLab → PDF)     │           │
│  └─────────────────┘                 └──────────────────────┘           │
│                                                                          │
│         Async jobs via FastAPI BackgroundTasks (no Redis needed)        │
└──────────────────────────────────┬──────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   MongoDB (motor)     │
                        │  Cases · Transactions │
                        │  Audit Log (signed)   │
                        └───────────────────────┘
```

---

## 🔄 Investigation Workflow

```
 Investigator                  TraceRoot Backend                    Gemma
      │                              │                                 │
      │  1. Upload transactions       │                                 │
      │ ─────────────────────────────▶│                                 │
      │                              │  2. Run 5 explainable detectors │
      │                              │     Flash Drain · Structuring   │
      │                              │     Mule Behaviour · Velocity   │
      │                              │     Known Account Reuse         │
      │                              │                                 │
      │                              │  3. Build fraud graph (NetworkX)│
      │  4. View interactive graph    │                                 │
      │◀─────────────────────────────│                                 │
      │                              │                                 │
      │  5. Select suspicious cluster │                                 │
      │ ─────────────────────────────▶│  6. Send graph + pattern       │
      │                              │     context                     │
      │                              │ ───────────────────────────────▶│
      │                              │                                 │
      │                              │  7. Generate: summary, report,  │
      │                              │     freeze justification,       │
      │                              │     next actions, translation   │
      │                              │◀───────────────────────────────│
      │  8. Review recommendation     │                                 │
      │     + full reasoning trail    │                                 │
      │◀─────────────────────────────│                                 │
      │                              │                                 │
      │  9. Approve / edit / reject   │                                 │
      │     (human decision — final)  │                                 │
      │ ─────────────────────────────▶│                                 │
      │                              │  10. Sign + log to audit trail  │
      │                              │  11. Export court-format PDF    │
      │◀─────────────────────────────│                                 │
```

---

## 🧩 Backend Module Design

```
backend/app/
│
├── api/                    ┌─────────────────────────────┐
│   ├── auth.py             │ Routers — thin HTTP layer,  │
│   ├── cases.py            │ delegate to services below  │
│   ├── case_detail.py      └─────────────────────────────┘
│   └── seed.py
│
├── services/                ┌──────────────────────────────────┐
│   ├── ingestion.py          │ Parses uploaded transaction data │
│   ├── risk_scoring.py       │ 5 explainable fraud detectors     │
│   ├── graph_builder.py      │ Builds victim→mule→dest graph     │
│   ├── gemma_orchestrator.py │ ONLY file that talks to the LLM   │
│   ├── recommendation.py     │ Merges risk scores + Gemma output │
│   └── report_generator.py   │ Court-format PDF via ReportLab    │
│                             └──────────────────────────────────┘
│
├── repositories/            ┌──────────────────────────────────┐
│   └── graph_repository.py  │ Abstract interface + NetworkX impl│
│                             │ (swappable for Neo4j later)       │
│                             └──────────────────────────────────┘
│
├── core/                    config.py, db.py — env-driven, nothing hardcoded
└── schemas.py                Pydantic v2 request/response models
```

**Design principle:** every service does exactly one job and the orchestrator pattern means the LLM integration is isolated to a single file — a deliberate choice so the model can be swapped (hosted Gemini/Gemma → local Ollama Gemma) without touching business logic.

---

## 🤖 Gemma Integration

```
┌────────────────────────────────────────────────────────────────┐
│                     GEMMA ORCHESTRATOR                          │
│               (backend/app/services/gemma_orchestrator.py)      │
│                                                                  │
│   Input Context Assembled From:                                 │
│   ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│   │ Fraud Graph     │  │ Risk Scores +   │  │ Case Metadata   │  │
│   │ Structure       │  │ Rule Reasoning  │  │                 │  │
│   └────────────────┘  └─────────────────┘  └─────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│                     ┌──────────────────┐                        │
│                     │   _call_llm()    │                        │
│                     └────────┬─────────┘                        │
│                              │                                  │
│              ┌───────────────┴────────────────┐                 │
│              ▼                                ▼                 │
│   ┌─────────────────────┐          ┌───────────────────────┐    │
│   │  CURRENT: Hosted     │          │  SWAP TARGET: Local   │    │
│   │  Gemini 3 Flash      │          │  Ollama (Gemma)       │    │
│   │  (Gemma-family,      │          │  Same function        │    │
│   │  via Emergent key)   │          │  signature — drop-in  │    │
│   └─────────────────────┘          └───────────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│              Generated Artifacts (6 types):                     │
│    • Executive Summary        • Freeze Justification            │
│    • Investigation Report     • Next-Action Recommendations     │
│    • Compliance Documentation • Regional Language Translation   │
└────────────────────────────────────────────────────────────────┘
```

**Why Gemma:** strong reasoning on complex, multi-hop financial data; produces human-readable explanations instead of opaque outputs; open-weight, so it can be deployed on secure, air-gapped government infrastructure; extensible later with RBI guidelines and cybercrime SOPs baked into the prompt/context layer.

**Gemma is never the decision-maker.** It drafts, explains, and recommends — the investigator signs.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend Framework** | FastAPI (Python 3.11+) |
| **Database** | MongoDB via `motor` (async driver) |
| **Graph Engine** | NetworkX (abstracted behind a `GraphRepository` interface) |
| **LLM** | Gemini 3 Flash (Gemma-family, hosted via Emergent LLM key) — swappable to local Ollama Gemma |
| **PDF Generation** | ReportLab |
| **Async Jobs** | FastAPI `BackgroundTasks` |
| **Frontend Framework** | React 19 + JSX |
| **Styling** | Tailwind CSS + shadcn/ui primitives |
| **Animation** | Framer Motion |
| **Graph Visualization** | Cytoscape.js |
| **Charts** | Recharts |
| **Auth** | Emergent-managed Google OAuth + 6-digit OTP verification |
| **Testing** | Pytest (risk scoring, graph construction, API smoke tests) |
| **Audit Integrity** | HMAC-SHA256 signed JSON export |

---

## 📁 Project Structure

```
TraceRoot/
├── backend/
│   ├── server.py               # FastAPI entry point, mounts routers under /api
│   ├── app/
│   │   ├── api/                # auth, cases, case_detail, seed
│   │   ├── core/                # config, db
│   │   ├── services/            # ingestion, risk_scoring, graph_builder,
│   │   │                        # gemma_orchestrator, recommendation, report_generator
│   │   ├── repositories/        # GraphRepository abstract + NetworkX impl
│   │   └── schemas.py           # Pydantic v2 schemas
│   └── tests/                   # pytest suite
├── frontend/
│   └── src/
│       ├── features/            # auth, dashboard, graph, copilot, reports, timeline
│       ├── components/ui/       # shadcn primitives
│       └── lib/                 # api client, print helper
└── tests/
```

---

## 🚀 Getting Started

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload

# Frontend
cd frontend
yarn install
yarn start

# Run backend tests
cd backend && pytest -q
```

**Required environment variables** (never hardcoded — set in `backend/.env` and `frontend/.env`):

```
# backend/.env
MONGO_URL=
DB_NAME=
CORS_ORIGINS=
EMERGENT_LLM_KEY=

# frontend/.env
REACT_APP_BACKEND_URL=
```

**Seed demo data:** after signing in, click **Seed demo cases** on the dashboard (or `POST /api/seed`) to load 3 realistic mock fraud cases.

---

## 🔐 Audit Trail & Tamper-Evidence

Every investigator action is logged and independently verifiable. The signed export (`GET /api/cases/{id}/audit/export?format=json`) returns a canonical JSON envelope containing a SHA-256 content hash and an HMAC-SHA256 signature.

```
entries → canonical JSON (sorted keys) → SHA-256 hash
                                       → HMAC-SHA256 signature (AUDIT_HMAC_KEY)
```

Any change to any entry — reordering, editing, inserting a fake row — invalidates both the hash and the signature. A reviewing court or senior officer can verify this independently with the algorithm documented in-repo, without needing access to the live system.

---

## 🧗 Challenges We Faced

- **Balancing explainability with sophistication.** It was tempting to add ML-based anomaly scoring for higher accuracy, but that would reintroduce the "black box" problem this project exists to solve — we kept detection fully rule-based and auditable instead.
- **Designing for a swappable LLM under time pressure.** Committing to an orchestrator pattern early (rather than calling the LLM API directly from multiple services) meant more upfront structuring, but it was the only way to credibly support both a hosted demo model and a future air-gapped Gemma deployment.
- **Building trust without full data governance.** A real deployment would need PII masking, role-based access, and encryption at rest — we scoped these out for the hackathon build but designed the orchestrator boundary so they can be added without refactoring.
- **Making the graph readable, not just accurate.** Raw transaction graphs get visually noisy fast with 500+ nodes; tuning Cytoscape.js layout and clustering to stay legible under demo conditions took real iteration.
- **Court-admissibility as a design constraint.** Most hackathon projects treat reporting as an afterthought — we treated the audit/export format as a first-class requirement from day one, which shaped the backend schema more than we initially expected.

---

## 🔮 Future Scope

- **Local, air-gapped Gemma deployment** for classified/sensitive case data — architecture already supports this via a single-file swap in `gemma_orchestrator.py`.
- **PII masking and role-based access control** for multi-officer deployments where junior analysts shouldn't see raw identity data.
- **RBI guideline and cybercrime SOP fine-tuning** layered into the Gemma context for jurisdiction-specific compliance language.
- **Real-time transaction stream ingestion** (via bank API webhooks) instead of batch CSV upload, for near-live fraud interdiction.
- **Cross-case pattern matching** — detecting when the same mule accounts or fraud rings reappear across unrelated cases.
- **Neo4j migration** for the graph layer at scale, using the existing `GraphRepository` abstraction as a drop-in replacement path.
- **Mobile-friendly investigator view** for field officers verifying flagged accounts on-site.

---

## 🛡 Responsible AI

TraceRoot is built around one non-negotiable principle: **Gemma explains, humans decide.**

Every AI-generated recommendation carries its full reasoning trail. No account is ever frozen automatically. This isn't just a design choice — it's what makes the platform viable for real government and financial-sector deployment, where accountability for every action must trace back to a named human decision-maker.

---

<p align="center">Built for the Karnataka Cybercrime Department (CIDECODE) Hackathon</p>
