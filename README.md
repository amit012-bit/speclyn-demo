# Speclyn

**Real-time clinical documentation intelligence.**

Speclyn listens to a doctor–patient encounter as it happens, reads the emerging
clinical note, detects ICD-10/CPT specificity gaps and HCC capture
opportunities in real time, and surfaces natural clarifying prompts to the
physician — before the note is finalized.

> Demo environment. Do not enter real patient information.

---

## Monorepo layout

| Directory | Layer | Stack | Port |
|-----------|-------|-------|------|
| [`engine/`](engine/) | CDI analysis engine | Python · FastAPI | 8000 |
| [`backend/`](backend/) | API + auth + WebSocket relay | Node.js · Express · Socket.io | 4000 |
| [`frontend/`](frontend/) | Physician-facing UI | Next.js 14 · TypeScript · Tailwind | 3000 |
| [`demo/`](demo/) | Original Streamlit proof-of-concept (still runnable) | Python · Streamlit | 8501 |
| [`docs/`](docs/) | Build specs and instruction files | — | — |

```
frontend (3000) ──REST + Socket.io──▶ backend (4000) ──REST + WS──▶ engine (8000)
                                                                       │
                                                        Claude → OpenAI → Gemini
                                                        AssemblyAI STT (Phase 4)
```

## LLM strategy

Three-tier fallback, one provider per request: **Claude Opus 4.8 → OpenAI
GPT-4o → Gemini 1.5 Pro**. A provider is only attempted when its key is
configured; `GET /health` on the engine reports which are live.

## Quick start (local, no Docker)

Each layer runs standalone. Copy each service's `.env.example` and fill keys.

```powershell
# 1. Engine
cd engine
pip install -r requirements.txt
uvicorn main:app --port 8000

# 2. Backend (new terminal)
cd backend
npm install
npm start

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000, log in with the password from `backend/.env`
(default `speclyn2026` — change it before sharing).

### Or with Docker

```bash
docker compose up --build
```

## Engine API (the core)

```bash
# Health + configured providers
curl http://localhost:8000/health

# Full analysis of a completed note
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"note_text": "68yo male with CHF, CKD, diabetes...", "mode": "complete"}'

# Realtime mode: never re-surfaces gaps already shown this encounter
curl -X POST http://localhost:8000/analyze \
  -d '{"note_text": "...", "mode": "realtime",
       "previous_gaps": ["congestive-heart-failure--type-unspecified"]}'
```

Realtime behavior:
- Gap IDs are **canonical server-side slugs** (`condition--detail`), alias-mapped
  so "CHF" and "Congestive Heart Failure (CHF)" dedup to the same condition.
- At most `MAX_GAPS_PER_CYCLE` (default 2) clarification prompts per cycle.
- `WS /stream` accepts `{"type":"transcript","text":...}` messages and emits
  `gaps` / `final` / `error` events, keeping per-encounter surfaced-gap state.

## Deployment (all free tiers)

| Layer | Platform |
|-------|----------|
| engine | Render |
| backend | Railway |
| frontend | Vercel |

Set each service's environment variables in the platform dashboard — never
commit `.env` files.

## What this is not (yet)

- Not HIPAA-compliant — synthetic notes only in demo phase
- No EHR integration (Epic/Cerner)
- No multi-user accounts; a single shared password gates access

---

*Founder: Amit Prakhar Pandey — amitprakhar35@gmail.com*
