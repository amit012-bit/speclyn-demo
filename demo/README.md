# Speclyn — Documentation Gap Analyzer

**Closing the gap between documentation AI and coding AI.**

Speclyn is a proof-of-concept tool for a healthcare AI startup that sits between
ambient clinical documentation AI and medical coding AI. It reads a clinical
note and surfaces the ICD-10/CPT specificity gaps, HCC capture opportunities,
and revenue leakage that a coder or CDI specialist would otherwise catch days
later — if at all.

This repository is the **demo**, not the production system. It runs on a
completed note pasted into a web UI. In a real deployment, Speclyn runs inside
the EHR alongside the ambient scribe, in real time, with full HIPAA compliance
and a BAA in place.

---

## What it does

Paste a clinical note, click **Analyze Note**, and Speclyn returns four things:

1. **Specificity Gaps** — diagnoses that lack the detail required for accurate
   ICD-10-CM coding, with the candidate codes from least to most specific.
2. **HCC Opportunities** — chronic conditions that are HCC-relevant under
   CMS-HCC v28 but not documented well enough to be captured for risk
   adjustment.
3. **Clarification Questions** — the exact questions to ask the physician, in
   plain clinical English, one per gap.
4. **Revenue Impact** — a dollar range for the total gap, based on published
   CMS/industry benchmarks, with stated assumptions.

### Real-Time Encounter Preview

Below the analysis, a section titled **"How Speclyn works during the
encounter"** shows a visual mock of what Speclyn looks like *during* a live
patient visit — a dark clinical-workstation card with the note forming in real
time and a Speclyn prompt surfacing the first clarification question to the
physician, with "Answer verbally" / "Skip for now" buttons.

This section is a **storytelling / visualization component only** — the buttons
do not trigger any API call. Its job is to help a prospective customer picture
the end product. If the note is already well-documented (no clarification
questions), the prompt is replaced by a green "Note is coding-complete" state.

---

## How it works (architecture)

```
┌─────────────┐     note text      ┌──────────────┐    system + user prompt    ┌──────────────┐
│   app.py    │ ─────────────────▶ │  analyzer.py │ ─────────────────────────▶ │  Claude API  │
│ (Streamlit  │                    │ (AI engine + │                            │ (Opus 4.8)   │
│  UI + mock) │ ◀───────────────── │  fallback)   │ ◀───────────────────────── │              │
└─────────────┘   parsed JSON      └──────────────┘        JSON response        └──────────────┘
                                          │  fallback if Claude unavailable
                                          ▼
                                   ┌──────────────┐
                                   │  OpenAI API  │
                                   │  (gpt-4o)    │
                                   └──────────────┘
```

| File | Responsibility |
|------|----------------|
| `app.py` | Streamlit UI — input, results rendering, and the real-time preview mock. Holds all CSS and session state. |
| `analyzer.py` | The AI engine. Owns the system prompt, builds the user prompt, calls the model, and robustly extracts JSON from the response. |
| `sample_notes.py` | Three one-click sample notes (high / medium / low gap). |
| `requirements.txt` | Python dependencies. |
| `.env.example` | Template for API keys (copy to `.env`). |

**Provider strategy:** Claude (Opus 4.8) is the primary engine. If no Anthropic
key is set — or the Claude call fails at runtime — Speclyn automatically falls
back to OpenAI (`gpt-4o`), and the UI shows a small notice when it does. If
neither key is configured, it shows a clean error (never a traceback).

**Session state:** because the preview buttons trigger Streamlit reruns, the
analysis result is stored in `st.session_state` so the whole results page
(including the preview) survives those reruns.

---

## Running it locally

### Prerequisites
- Python 3.10+ (this project was set up with a Conda env on Python 3.11)
- An Anthropic API key (and optionally an OpenAI key for the fallback)

### 1. Set up the environment

**Using Conda (recommended, matches the project setup):**
```powershell
conda create -n speclyn -c conda-forge --override-channels python=3.11 -y
conda activate speclyn
pip install -r requirements.txt
```

**Or using venv:**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Add your API key

Copy the template and fill in a real key:
```powershell
Copy-Item .env.example .env
```
Then edit `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...your real key...
# Optional fallback:
OPENAI_API_KEY=sk-...your openai key...
```

### 3. Run

```powershell
streamlit run app.py
```
It opens `http://localhost:8501` in your browser. Stop the server with `Ctrl+C`.

---

## How to test it

### Manual smoke test (do this first)
1. Launch the app (`streamlit run app.py`).
2. In the sidebar, click **Sample 1 — High gap (CHF + CKD + diabetes)**, then
   click **Analyze Note**. You should see:
   - ≥3 specificity gaps, ≥2 HCC opportunities, clarification questions, and a
     dollar range — **no raw JSON, no errors**.
3. Scroll past the four sections. You should see the divider
   **"HOW SPECLYN WORKS DURING THE ENCOUNTER"**, then the dark encounter card
   with the note and the first clarification question inside a Speclyn prompt.
4. Click **Answer verbally** below the card → the prompt's button row is
   replaced with green **"✅ Response captured — note updated automatically"**.
5. Re-analyze and click **Skip for now** → muted **"Prompt dismissed — query
   will be sent after encounter"**.
6. Confirm the three stat pills and the blue pilot callout box (with the mailto
   link) appear at the very bottom.

### Edge cases to check
- **Well-documented note:** click **Sample 3** → Analyze. The encounter card
  should show the green **"Note is coding-complete"** state instead of a prompt.
- **Too-short input:** clear the box, type a few characters, click Analyze →
  you should get *"Please paste a complete clinical note for accurate
  analysis."* (no crash).
- **Fallback path:** temporarily remove `ANTHROPIC_API_KEY` from `.env` (leaving
  a valid `OPENAI_API_KEY`) → analysis should run via OpenAI and show the
  "Claude unavailable — analyzed with OpenAI fallback" notice.

### Quick offline check (no API call)
Confirm the files import and the prompt/env wiring is intact:
```powershell
python -m py_compile app.py analyzer.py sample_notes.py
```

---

## Deployment (Streamlit Community Cloud)

1. Push to GitHub (the repo already ignores `.env`).
2. Go to https://share.streamlit.io and connect the repo.
3. Add `ANTHROPIC_API_KEY` (and optionally `OPENAI_API_KEY`) as **secrets** in
   the Streamlit Cloud dashboard — never commit keys.
4. Deploy. You get a free, permanent URL.

---

## What this demo is *not*

- Not a HIPAA-compliant production system
- Does not store any patient data
- Not connected to any EHR
- Does not replace a certified medical coder or CDI specialist

When showing this to a prospective customer, state upfront: *"This is a
proof-of-concept demo. In a real deployment, this runs inside your EHR
environment with full HIPAA compliance and a BAA in place."*

---

*Speclyn — Documentation Gap Analyzer*
*Founder: Amit Prakhar Pandey*
