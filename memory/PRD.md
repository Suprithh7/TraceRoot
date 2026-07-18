# TraceRoot — AI Fraud Investigation Dashboard (Demo)

## Original Problem Statement
Build a web app called "TraceRoot" — an AI fraud investigation dashboard demo for
cybercrime investigators. Dark theme, professional, no backend, all data hardcoded.
Pages: Login → Dashboard (case list) → Case Detail (chain diagram + risk breakdown +
AI summary + Generate Report modal).

## Architecture
- Pure frontend React SPA (no backend, no MongoDB used).
- View switching via local `useState` in `App.js` (no react-router needed for 3 views).
- Hardcoded mock JSON in `/app/frontend/src/data/mockCases.js`.
- Shader-based animated dot-matrix background on login (react-three-fiber + three.js).
- Framer Motion for enter/exit + list stagger animations.
- Tailwind + shadcn palette (dark). Lucide icons only, no emoji.

## User Persona
- Cybercrime / fraud investigator at a financial institution or agency, reviewing a
  case queue and drilling into the account chain and risk drivers per case.

## Core Requirements (static)
1. Login page — email + Sign In, no OTP, no auth.
2. Dashboard — table of 3–5 sample cases with risk badge (Freeze / Monitor / Safe).
3. Case detail — chain diagram (Victim → Mule → Cash Out), score breakdown list,
   AI summary text, Generate Report modal.

## What's Implemented (2026-02-18)
- Login (`SignInPage.jsx`) with animated dot-matrix shader, brand mark, transition
  animation on submit.
- Dashboard (`Dashboard.jsx`) with 5 hardcoded cases, stats cards (open / freeze /
  monitor / frozen exposure), filter pills (All / Freeze / Monitor / Safe), sortable
  table with pulsing risk dots, sign-out.
- Case detail (`CaseDetail.jsx`) with:
  - Fund-flow chain (2–4 node horizontal boxes with color-coded tags & arrows).
  - Risk breakdown list with per-signal meta and total /100.
  - AI investigator summary with model tag and hashtags.
  - Generate Report modal with executive summary, fields grid, signals table,
    Close / Download PDF buttons.
- All `data-testid` attributes added to interactive elements.

## Data
5 realistic cases with varied risk profiles (US→PH mule ring, elder fraud US→HK,
SMB BEC, retail safe, payroll direct-deposit hijack).

## Backlog / Next
- P1: Add a mini timeline / activity chart on case detail (Recharts).
- P1: Case search + column sorting on dashboard.
- P2: Export report as actual PDF (currently mock).
- P2: Optional real LLM summary via Emergent LLM key.
- P2: Multi-case comparison view.
