# Speclyn — Full Product Architecture Guide
## Claude Code Master Instruction File
## Read every word before writing a single line of code.

---

## WHAT WE ARE BUILDING

Speclyn is a real-time clinical documentation intelligence layer.
It listens to a doctor-patient encounter as it happens, reads the
emerging clinical note, detects ICD-10/CPT specificity gaps and HCC
capture opportunities in real time, and surfaces natural clarifying
prompts to the physician — before the note is finalized.

This is not a paste-and-analyze tool. This is a live, voice-driven,
real-time product that a physician uses during an actual encounter.

The goal: make physicians feel like Speclyn is an intelligent colleague
sitting in the room, not a billing compliance tool watching over their
shoulder.

---

## ARCHITECTURE OVERVIEW

Three independent layers communicating via REST and WebSocket APIs:

```
┌─────────────────────────────────────────────────────────┐
│                   NEXT.JS FRONTEND                       │
│   Physician-facing UI · Real-time encounter view         │
│   Voice recording · Live prompts · Analysis display      │
│   Port 3000 · Deployed on Vercel (free)                  │
└──────────────────────┬──────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                  NODE.JS API LAYER                        │
│   Auth · Session management · Request routing            │
│   WebSocket relay · Rate limiting · Logging              │
│   Port 4000 · Deployed on Railway (free tier)            │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API calls
┌──────────────────────▼──────────────────────────────────┐
│                PYTHON SPECLYN ENGINE                     │
│   CDI logic · ICD-10/HCC analysis · LLM orchestration   │
│   AssemblyAI STT integration · Gap detection             │
│   Port 8000 · Deployed on Render (free tier)             │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
   AssemblyAI API            OpenAI / Gemini API
   (Voice STT)               (CDI Analysis Engine)
```

---

## MONOREPO STRUCTURE

Build everything in a single repository with this exact structure:

```
speclyn/
├── frontend/                    # Next.js 14 app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Landing / login
│   │   ├── dashboard/
│   │   │   └── page.tsx         # Main encounter view
│   │   └── api/
│   │       └── auth/
│   │           └── route.ts     # NextAuth route
│   ├── components/
│   │   ├── EncounterPanel.tsx   # Main live encounter UI
│   │   ├── VoiceRecorder.tsx    # Microphone capture
│   │   ├── LiveTranscript.tsx   # Real-time note display
│   │   ├── PromptCard.tsx       # Speclyn clarification prompt
│   │   ├── AnalysisPanel.tsx    # Gap analysis sidebar
│   │   └── RevenueImpact.tsx    # Dollar impact display
│   ├── lib/
│   │   ├── api.ts               # API client
│   │   └── websocket.ts         # WebSocket client
│   ├── styles/
│   │   └── globals.css
│   ├── package.json
│   ├── next.config.js
│   └── tsconfig.json
│
├── backend/                     # Node.js Express API
│   ├── src/
│   │   ├── index.js             # Entry point
│   │   ├── routes/
│   │   │   ├── auth.js          # Password auth
│   │   │   ├── sessions.js      # Encounter sessions
│   │   │   └── analysis.js      # Analysis endpoints
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT verification
│   │   │   └── rateLimit.js     # Rate limiting
│   │   ├── websocket/
│   │   │   └── relay.js         # WebSocket relay to engine
│   │   └── utils/
│   │       └── logger.js
│   ├── package.json
│   └── .env.example
│
├── engine/                      # Python FastAPI engine
│   ├── main.py                  # FastAPI app entry
│   ├── routers/
│   │   ├── analyze.py           # POST /analyze endpoint
│   │   ├── stream.py            # WebSocket /stream endpoint
│   │   └── health.py            # GET /health
│   ├── services/
│   │   ├── assemblyai_stt.py    # AssemblyAI integration
│   │   ├── gap_detector.py      # Core CDI logic
│   │   ├── llm_orchestrator.py  # OpenAI/Gemini calls
│   │   └── revenue_calculator.py
│   ├── prompts/
│   │   └── system_prompt.py     # Master CDI system prompt
│   ├── models/
│   │   └── schemas.py           # Pydantic request/response models
│   ├── requirements.txt
│   └── .env.example
│
├── docker-compose.yml           # Local development
├── .gitignore
└── README.md
```

---

## TECH STACK — EXACT VERSIONS

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS v3
- shadcn/ui components
- Socket.io-client (WebSocket)
- React Query (TanStack Query v5) for API state
- Web Audio API (native browser, no library needed for mic capture)

**Backend (Node.js):**
- Express.js v4
- Socket.io (WebSocket server)
- jsonwebtoken (JWT auth)
- express-rate-limit
- cors
- dotenv
- axios (HTTP client to Python engine)

**Engine (Python):**
- FastAPI
- uvicorn
- assemblyai SDK (pip install assemblyai)
- openai SDK (pip install openai)
- google-generativeai SDK (pip install google-generativeai)
- websockets
- pydantic v2
- python-dotenv
- httpx

**Deployment (all free):**
- Frontend: Vercel
- Backend: Railway (free tier, 500 hours/month)
- Engine: Render (free tier, spins down after inactivity — acceptable for demo)

---

## CORE PRODUCT FLOW — BUILD THIS EXACTLY

### Flow 1: Text Analysis (already working in demo, now production-grade)

```
User pastes clinical note
→ Frontend sends POST /api/analysis/analyze to Node backend
→ Node backend forwards to Python engine POST /analyze
→ Engine runs CDI analysis via OpenAI/Gemini
→ Returns structured JSON
→ Frontend renders results in panels
```

### Flow 2: Real-Time Voice Analysis (the main product)

```
Doctor clicks "Start Encounter"
→ Frontend opens microphone via Web Audio API
→ Audio chunks sent to AssemblyAI via WebSocket (real-time streaming)
→ AssemblyAI returns live transcript tokens
→ Frontend displays live transcript
→ Every 15 seconds (configurable), frontend sends current transcript
  to Node backend via Socket.io
→ Node backend forwards to Python engine POST /analyze
→ Engine analyzes current transcript state for gaps
→ If new gap detected, engine returns prompt
→ Node backend emits prompt via Socket.io to frontend
→ Frontend displays PromptCard with clarifying question
→ Doctor answers verbally (captured in next transcript chunk)
→ Engine detects answer in subsequent transcript, marks gap resolved
→ Final analysis shown when encounter ends
```

---

## AUTHENTICATION — SIMPLE PASSWORD PROTECTION

No user accounts. No database. Just a shared password that gives access
to the product. This is correct for a pilot stage product.

**Implementation:**

In Node.js backend, create a single POST /auth/login endpoint:
- Accept { password: string }
- Compare against PASSWORD env variable using bcrypt
- If match, return a JWT token signed with JWT_SECRET
- Token expires in 24 hours

In Next.js frontend:
- Login page (app/page.tsx): simple centered form with password field
- On success, store JWT in httpOnly cookie
- All routes except /login check for valid JWT
- If no valid JWT, redirect to login

**Default password:** Set in .env as PASSWORD=speclyn2026
(User changes this before sharing with any pilot customer)

---

## THE PYTHON ENGINE — DETAILED SPEC

This is the heart of the product. Build this first.

### POST /analyze

Request body:
```json
{
  "note_text": "string — the clinical note or transcript so far",
  "mode": "realtime | complete",
  "specialty": "string — optional, e.g. cardiology, primary_care",
  "previous_gaps": ["array of gap IDs already surfaced — do not repeat these"]
}
```

Response:
```json
{
  "specificity_gaps": [...],
  "hcc_opportunities": [...],
  "clarification_questions": [...],
  "revenue_impact": {
    "total_range": { "low": int, "high": int },
    "items": [...],
    "assumptions": "string"
  },
  "new_gaps_only": true,
  "analysis_mode": "realtime | complete"
}
```

In realtime mode: only return gaps not in previous_gaps array.
This prevents the same prompt from appearing twice in one encounter.

### WebSocket /stream

Accepts WebSocket connections. Receives transcript chunks as they arrive.
Maintains encounter state (which gaps have been surfaced so far).
Emits gap events when new gaps are detected.

### LLM Strategy

Primary: OpenAI GPT-4o
Fallback: Google Gemini 1.5 Pro
Never both in the same request — try primary, if it fails, use fallback.

Use the same system prompt from the existing demo (already in
analyzer.py), with these additions for real-time mode:

Add to system prompt when mode is "realtime":
```
You are analyzing a LIVE, IN-PROGRESS clinical encounter transcript.
The physician is still talking. The note is not complete.
IMPORTANT: Only flag gaps where you have high confidence the information
is genuinely missing — do not flag gaps for information that may simply
not have been mentioned yet.
In realtime mode, prioritize the most clinically significant gaps first.
Surface at most 2-3 prompts per analysis cycle. The physician must not
be overwhelmed with questions.
```

---

## THE NEXT.JS FRONTEND — DETAILED SPEC

### Login Page (app/page.tsx)

Clean, minimal, professional:
- Centered card on dark background
- Speclyn logo/name in large text
- Tagline: "Clinical documentation intelligence"
- Single password field + Submit button
- No sign up link, no forgot password — this is a shared access product

### Dashboard (app/dashboard/page.tsx)

Two-panel layout:

**Left panel (60% width) — Encounter Panel:**
- Header: "Current Encounter" + Start/Stop button
- When stopped: shows a text area for manual note entry
- When recording: shows live transcript appearing word by word
- PromptCard appears as an overlay at the bottom of this panel
  when a gap is detected — slides in from the bottom, stays until
  dismissed or answered

**Right panel (40% width) — Analysis Panel:**
- Shows full structured analysis
- Updates in real time as encounter progresses
- Revenue impact number displayed prominently at the top
  in large green text — this is the first thing a CFO sees
- Specificity gaps, HCC opportunities below
- Export as PDF button at the bottom

### PromptCard Component (most important UI element)

This is the moment that makes doctors feel the product.
Design it carefully:

```
┌────────────────────────────────────────┐
│  💬 Quick clarification               │
│                                        │
│  Was the patient's CHF systolic       │
│  or diastolic?                         │
│                                        │
│  [Answer verbally]    [Skip]           │
└────────────────────────────────────────┘
```

- Slides up from bottom with smooth animation (Tailwind transition)
- Background: white with blue left border
- Subtle drop shadow
- "Answer verbally" is primary (blue) button
- "Skip" is ghost button
- Auto-dismisses after 30 seconds if no interaction
- Never shows more than one prompt at a time
- Queue subsequent prompts — show them one at a time

### VoiceRecorder Component

Uses Web Audio API (built into browsers, no library needed):
- getUserMedia to access microphone
- MediaRecorder to capture audio chunks
- Send chunks to AssemblyAI via their SDK
- Display live waveform visualization (simple CSS animation, not canvas)
- Red recording indicator when active

### Color Palette

Use these exact values, consistently:

- Background: #0F1117 (dark, clinical feel)
- Surface: #1A1D27 (cards, panels)
- Border: #2D3748
- Primary: #3B82F6 (blue — actions, links)
- Success: #10B981 (green — revenue, positive states)
- Warning: #F59E0B (amber — gaps, prompts)
- Text primary: #F9FAFB
- Text secondary: #9CA3AF
- Revenue green: #10B981 (large number displays)

---

## ASSEMBLYAI INTEGRATION — EXACT IMPLEMENTATION

In engine/services/assemblyai_stt.py:

```python
import assemblyai as aai
import os

aai.settings.api_key = os.environ["ASSEMBLYAI_API_KEY"]

def create_realtime_transcriber(on_data_callback, on_error_callback):
    """
    Create a real-time transcriber configured for medical conversations.
    """
    transcriber = aai.RealtimeTranscriber(
        sample_rate=16_000,
        word_boost=MEDICAL_WORD_BOOST,
        # Medical mode — one parameter activates clinical vocabulary
        # Note: Check current AssemblyAI docs for domain parameter name
        # as of 2026 it may be: extra_session_information or domain
    )
    transcriber.on(aai.RealtimeEvents.transcript, on_data_callback)
    transcriber.on(aai.RealtimeEvents.error, on_error_callback)
    return transcriber

# Medical terminology boost list — common terms that generic STT misses
MEDICAL_WORD_BOOST = [
    "HCC", "ICD-10", "CPT", "HbA1c", "eGFR", "HFrEF", "HFpEF",
    "RAF", "Medicare Advantage", "CKD", "COPD", "CHF", "CVA",
    "metformin", "lisinopril", "furosemide", "atorvastatin",
    "hyperglycemia", "hypoglycemia", "neuropathy", "nephropathy",
    "retinopathy", "diastolic", "systolic", "ejection fraction",
    "creatinine", "BMP", "CBC", "A1c", "BMI"
]
```

In the frontend (VoiceRecorder.tsx):
- Capture audio from microphone using MediaRecorder
- Send audio blobs to Node.js backend via Socket.io
- Node.js backend relays to Python engine via WebSocket
- Engine passes to AssemblyAI, gets transcript back
- Engine emits transcript update and triggers gap analysis every 15 seconds

---

## ENVIRONMENT VARIABLES

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
JWT_SECRET=your_jwt_secret_here
```

### Backend (.env)
```
PORT=4000
JWT_SECRET=your_jwt_secret_here
PASSWORD=speclyn2026
ENGINE_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:3000
```

### Engine (.env)
```
PORT=8000
ASSEMBLYAI_API_KEY=your_assemblyai_key_here
OPENAI_API_KEY=your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
ANALYSIS_INTERVAL_SECONDS=15
MAX_GAPS_PER_CYCLE=2
```

---

## BUILD SEQUENCE — DO THIS IN ORDER

**Day 1: Foundation**
1. Set up monorepo with folder structure above
2. Build Python engine first — FastAPI app, POST /analyze endpoint
3. Test engine standalone: curl a clinical note, get back JSON analysis
4. Engine must work perfectly before touching frontend

**Day 2: Backend**
5. Build Node.js backend — Express setup, auth endpoints, JWT
6. Connect backend to engine — proxy /analyze calls
7. Test: login → get JWT → call /analyze → get results

**Day 3: Frontend Core**
8. Build Next.js login page
9. Build dashboard layout (two panels)
10. Build text analysis flow (paste note → see results)
11. This recreates the Streamlit demo but in the real product shell

**Day 4: Voice + Real-time**
12. Build VoiceRecorder component (mic capture)
13. Integrate AssemblyAI streaming in engine
14. Build Socket.io relay in Node.js backend
15. Build live transcript display in frontend
16. Test: record voice → see transcript appear in real time

**Day 5: Real-time Gap Detection**
17. Add 15-second analysis cycle to engine
18. Add gap event emission via Socket.io
19. Build PromptCard component in frontend
20. Test: speak about a diabetic patient → Speclyn asks for specificity

**Day 6: Polish**
21. Revenue impact display in right panel
22. Export PDF functionality
23. Loading states, error handling, edge cases
24. Mobile responsiveness (tablets are common in clinical settings)

**Day 7: Deploy**
25. Deploy engine to Render
26. Deploy backend to Railway
27. Deploy frontend to Vercel
28. Configure environment variables in all three platforms
29. End-to-end test on deployed URLs
30. Record a demo video

---

## WHAT SUCCESS LOOKS LIKE AFTER 7 DAYS

1. Open the URL on a laptop or tablet
2. Enter password — see the dashboard
3. Type a clinical note about CHF + CKD + diabetes → see structured
   analysis with revenue impact in the right panel
4. Click "Start Encounter" → speak the same clinical details out loud
   → see the transcript appear live in the left panel
5. Within 30 seconds, a PromptCard slides up: "Was that CHF systolic
   or diastolic?"
6. Say "it was systolic" → prompt dismisses, analysis updates
7. Click "End Encounter" → see complete analysis with all gaps resolved
8. Click "Export Analysis" → download a clean PDF

If all 8 of these work, you have a product, not a prototype.

---

## CRITICAL NOTES

**On HIPAA for the demo:**
This is a proof-of-concept. No real patient data should be processed
through this during the demo phase. Use synthetic clinical notes.
When you approach real pilot customers, you will need:
- BAA with AssemblyAI (available — contact their sales team)
- BAA with OpenAI (available on Enterprise tier)
- Your own BAA template for customers to sign
- Proper data handling policy

For demo purposes, include this notice in the UI footer:
"Demo environment. Do not enter real patient information."

**On the analysis interval:**
15 seconds is a starting point. In real clinical use, this may need
to be tuned — too frequent creates noise, too infrequent misses the
real-time window. Make ANALYSIS_INTERVAL_SECONDS a configurable
env variable so it can be adjusted without code changes.

**On prompt count:**
Never surface more than one PromptCard at a time. Never show more
than 3-4 prompts in a single encounter. Physician cognitive load
is the product killer — less is more.

**On the fallback mode:**
If AssemblyAI fails or the user doesn't grant microphone access,
the product gracefully falls back to the text paste mode.
Never show an error that blocks the user — always degrade gracefully.

---

## DO NOT BUILD (out of scope for this week)

- EHR integration (Epic/Cerner) — this is a 3-month project on its own
- Multi-user accounts or team features
- Custom specialty-specific models
- Mobile app (the web app on a tablet is sufficient)
- Analytics dashboard
- Billing or subscription management

---

## ACCOUNTS TO SET UP BEFORE STARTING

1. AssemblyAI — assemblyai.com — free tier, $50 credit, no card needed
   Get API key immediately, it's instant
2. Vercel — vercel.com — free, connect GitHub
3. Railway — railway.app — free tier for Node.js backend
4. Render — render.com — free tier for Python engine
5. GitHub — create a new repo called "speclyn"

---

*Speclyn — Full Product Build*
*Architecture Version 1.0*
*Target: 7-day build with Claude Code premium*
*Founder: Amit Prakhar Pandey*
*Contact: amitprakhar35@gmail.com*
