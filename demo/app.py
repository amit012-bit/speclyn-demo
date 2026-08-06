"""
app.py — Speclyn Documentation Gap Analyzer (Streamlit demo).

A proof-of-concept tool that detects ICD-10/CPT specificity gaps and HCC
capture opportunities in clinical notes, and estimates the revenue impact —
closing the gap between documentation AI and coding AI.
"""

import streamlit as st
from dotenv import load_dotenv

from analyzer import AnalyzerError, analyze_note
from sample_notes import SAMPLE_NOTES

# Load .env for local development. On Streamlit Cloud the key comes from
# st.secrets, which is also exposed via os.environ, so this is a no-op there.
load_dotenv()

MIN_NOTE_LENGTH = 50

st.set_page_config(
    page_title="Speclyn — Documentation Gap Analyzer",
    page_icon="🩺",
    layout="centered",
)

# --------------------------------------------------------------------------
# Styling — a single cohesive design system.
# Every color is explicit so the UI never depends on Streamlit's theme
# inheritance (which is what caused the invisible-text failure before).
# --------------------------------------------------------------------------
st.markdown(
    """
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

      :root {
        --ink:    #14233A;   /* headings */
        --body:   #43546A;   /* body text */
        --muted:  #7B8A9E;   /* secondary / captions */
        --brand:  #0E5A8A;   /* primary brand blue */
        --brand2: #1B84C4;   /* accent */
        --bg:     #F4F7FB;
        --card:   #FFFFFF;
        --border: #E4EAF1;
        --shadow: 0 1px 2px rgba(20,35,58,.04), 0 4px 16px rgba(20,35,58,.06);
      }

      /* Typography — scoped to text elements only. Deliberately NOT applied to
         bare span/div, so Streamlit's Material-icon glyphs keep their icon font. */
      .stApp, .stApp p, .stApp li, .stApp label,
      .stApp h1, .stApp h2, .stApp h3, .stApp h4,
      .stApp textarea, .stApp input, .stApp button,
      [data-testid="stMarkdownContainer"] {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      /* Guard: never let the text font override icon fonts. */
      [data-testid="stIconMaterial"], .material-icons,
      .material-symbols-outlined, .material-symbols-rounded {
        font-family: 'Material Symbols Rounded', 'Material Symbols Outlined',
                     'Material Icons' !important;
      }
      .stApp { background: var(--bg); }
      .block-container { padding-top: 2.2rem; max-width: 760px; }

      /* ---------- Hero ---------- */
      .hero {
        display: flex; align-items: center; gap: 0.7rem;
        margin-bottom: 0.15rem;
      }
      .hero-mark {
        width: 2.3rem; height: 2.3rem; border-radius: 9px;
        background: linear-gradient(135deg, #0E5A8A 0%, #1B84C4 100%);
        color: #fff; font-weight: 800; font-size: 1.35rem;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 12px rgba(14,90,138,.28);
      }
      .hero-name {
        font-size: 2.35rem; font-weight: 800; letter-spacing: -0.03em;
        color: var(--ink); line-height: 1;
      }
      .hero-tagline {
        font-size: 1.02rem; color: var(--muted);
        margin: 0.35rem 0 1.6rem 0;
      }

      /* ---------- Section headers ---------- */
      .sec {
        display: flex; align-items: center; gap: 0.6rem;
        margin: 2rem 0 1rem 0; padding-bottom: 0.55rem;
        border-bottom: 2px solid var(--border);
      }
      .sec-icon { font-size: 1.15rem; }
      .sec-title {
        font-size: 1.28rem; font-weight: 700; color: var(--ink);
        letter-spacing: -0.01em;
      }
      .sec-count {
        margin-left: auto; font-size: 0.78rem; font-weight: 700;
        color: var(--brand); background: #E9F2F9;
        border: 1px solid #CFE4F2; border-radius: 20px;
        padding: 0.12rem 0.7rem;
      }

      /* ---------- Generic finding card ---------- */
      .card {
        background: var(--card); border: 1px solid var(--border);
        border-radius: 12px; padding: 1.05rem 1.2rem;
        margin-bottom: 0.8rem; box-shadow: var(--shadow);
        transition: box-shadow .15s ease, transform .15s ease;
      }
      .card:hover { box-shadow: 0 2px 4px rgba(20,35,58,.05), 0 10px 26px rgba(20,35,58,.09); transform: translateY(-1px); }
      .card-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.55rem; }
      .card-title { font-size: 1.06rem; font-weight: 700; color: var(--ink); }

      /* Tags / badges */
      .tag {
        font-size: 0.7rem; font-weight: 700; letter-spacing: 0.03em;
        text-transform: uppercase; padding: 0.16rem 0.55rem;
        border-radius: 6px; white-space: nowrap;
      }
      .tag-amber { background: #FDF3E7; color: #B45309; border: 1px solid #F3D9A8; }
      .tag-red   { background: #FDECEC; color: #C53030; border: 1px solid #F3C2C2; }
      .tag-blue  { background: #EAF3FB; color: #12608F; border: 1px solid #C7E0F2; }
      .tag-green { background: #E7F6EF; color: #12805C; border: 1px solid #B7E3CE; }

      /* Key/value line */
      .kv { font-size: 0.95rem; color: var(--body); line-height: 1.55; margin-bottom: 0.5rem; }
      .kv .k {
        display: inline-block; font-size: 0.72rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.04em;
        color: var(--muted); margin-right: 0.4rem;
      }

      /* ICD code chips */
      .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.15rem 0 0.6rem 0; }
      .chip {
        font-family: 'SFMono-Regular', 'Courier New', monospace;
        font-size: 0.8rem; font-weight: 600; color: #234;
        background: #F0F4F9; border: 1px solid #DCE6F0;
        border-radius: 6px; padding: 0.18rem 0.5rem;
      }
      .why {
        font-size: 0.9rem; color: var(--body); line-height: 1.55;
        border-left: 3px solid #DCE6F0; padding-left: 0.7rem; margin-top: 0.5rem;
      }
      .why b { color: var(--ink); }

      /* ---------- Clarification question cards ---------- */
      .q-card {
        display: flex; gap: 0.9rem; align-items: flex-start;
        background: linear-gradient(180deg, #FBFDFF 0%, #F4F9FE 100%);
        border: 1px solid #D8E8F5; border-left: 4px solid var(--brand2);
        border-radius: 12px; padding: 1rem 1.15rem; margin-bottom: 0.75rem;
        box-shadow: var(--shadow);
      }
      .q-num {
        flex: none; width: 2rem; height: 2rem; border-radius: 50%;
        background: var(--brand); color: #fff; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 3px 8px rgba(14,90,138,.3);
      }
      .q-eyebrow {
        font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.07em; color: var(--brand2); margin-bottom: 0.2rem;
      }
      .q-text { font-size: 1.02rem; color: var(--ink); line-height: 1.5; }

      /* ---------- Revenue hero ---------- */
      .rev {
        background: linear-gradient(135deg, #0E5A8A 0%, #12805C 100%);
        border-radius: 16px; padding: 1.6rem 1.8rem; color: #fff;
        margin-bottom: 0.9rem; box-shadow: 0 10px 30px rgba(14,90,138,.28);
      }
      .rev-eyebrow {
        font-size: 0.74rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.08em; color: rgba(255,255,255,.82);
      }
      .rev-num { font-size: 3rem; font-weight: 800; letter-spacing: -0.02em; margin: 0.15rem 0; line-height: 1.05; }
      .rev-sub { font-size: 0.95rem; color: rgba(255,255,255,.85); }
      .assume {
        background: #FBFCFE; border: 1px solid var(--border);
        border-radius: 10px; padding: 0.85rem 1.05rem; font-size: 0.9rem;
        color: var(--body); line-height: 1.6;
      }
      .assume b { color: var(--ink); }

      /* ---------- Success / empty state ---------- */
      .state-ok {
        background: #E7F6EF; border: 1px solid #B7E3CE; border-radius: 12px;
        padding: 1rem 1.2rem; color: #12805C; font-size: 0.98rem;
        display: flex; align-items: center; gap: 0.5rem;
      }

      .disclaimer {
        font-size: 0.82rem; color: var(--muted);
        border-top: 1px solid var(--border);
        padding-top: 1rem; margin-top: 2rem;
      }

      /* ---------- Buttons ---------- */
      .stButton > button {
        border-radius: 9px; font-weight: 600;
      }
      div[data-testid="stButton"] button[kind="primary"] {
        padding: 0.65rem 1rem; font-size: 1.02rem;
        box-shadow: 0 6px 16px rgba(14,90,138,.25);
      }

      /* ---------- Sidebar ---------- */
      section[data-testid="stSidebar"] { border-right: 1px solid var(--border); }

      /* ================= Real-time preview (dark clinical card) ============= */
      .realtime-header {
        font-size: 0.78rem; font-weight: 700; color: var(--muted);
        letter-spacing: 0.14em; text-align: center;
        margin: 2.5rem 0 0.4rem 0; text-transform: uppercase;
      }
      .realtime-intro {
        font-size: 0.92rem; color: var(--body); font-style: italic;
        margin-bottom: 1.2rem; line-height: 1.65; text-align: center;
      }
      .encounter-card {
        background: #0F1B2D; border-radius: 14px; overflow: hidden;
        margin-bottom: 1rem; box-shadow: 0 12px 34px rgba(15,27,45,.32);
      }
      .encounter-header {
        background: #0A1628; padding: 0.7rem 1.1rem; font-size: 0.82rem;
        color: #8A98A6; border-bottom: 1px solid #1A2F4A;
        display: flex; align-items: center;
      }
      .live-dot {
        color: #FF5A5A; font-weight: 700; margin-right: 0.5rem;
        display: inline-flex; align-items: center; gap: 0.35rem;
      }
      .live-pulse {
        width: 8px; height: 8px; border-radius: 50%; background: #FF5A5A;
        box-shadow: 0 0 0 0 rgba(255,90,90,.7); animation: pulse 1.6s infinite;
      }
      @keyframes pulse {
        0%   { box-shadow: 0 0 0 0 rgba(255,90,90,.6); }
        70%  { box-shadow: 0 0 0 7px rgba(255,90,90,0); }
        100% { box-shadow: 0 0 0 0 rgba(255,90,90,0); }
      }
      .encounter-body { padding: 1.3rem; }
      .note-draft {
        font-family: 'SFMono-Regular', 'Courier New', monospace;
        font-size: 0.86rem; color: #A0ADB8; line-height: 1.65;
        margin-bottom: 1.2rem; padding: 0.9rem 1rem; background: #0A1628;
        border-radius: 8px; border: 1px solid #16273D;
      }
      .speclyn-prompt-card {
        background: #14263E; border: 1px solid #2D7DD2; border-radius: 10px;
        padding: 1.1rem 1.2rem; box-shadow: 0 0 0 3px rgba(45,125,210,.12);
      }
      .prompt-label {
        font-size: 0.74rem; font-weight: 700; color: #5BA7E8;
        margin-bottom: 0.5rem; letter-spacing: 0.06em;
      }
      .prompt-question { font-size: 1.04rem; color: #FFFFFF; line-height: 1.55; }
      .sim-btn {
        display: inline-block; padding: 0.5rem 1.05rem; border-radius: 8px;
        font-size: 0.86rem; font-weight: 600; margin-right: 0.6rem; margin-top: 0.9rem;
      }
      .sim-btn-answer { background: #17915A; color: #FFFFFF; }
      .sim-btn-skip { background: #223349; color: #B7C4D3; border: 1px solid #2E4257; }
      .sim-answered { color: #43D69C; font-weight: 600; margin-top: 1rem; }
      .sim-skipped { color: #8A98A6; margin-top: 1rem; }
      .stat-pill {
        background: var(--card); border: 1px solid var(--border);
        border-radius: 20px; padding: 0.4rem 0.6rem; font-size: 0.8rem;
        color: var(--body); text-align: center; margin: 0.5rem auto;
        box-shadow: var(--shadow);
      }
      .pilot-callout {
        background: linear-gradient(135deg, #F0F7FF 0%, #EAF3FB 100%);
        border: 1px solid #CFE4F2; border-radius: 14px;
        padding: 1.3rem 1.5rem; margin-top: 1.2rem; font-size: 0.94rem;
        color: #23405C; line-height: 1.7;
      }
      .pilot-callout a { color: var(--brand); font-weight: 700; text-decoration: none; }
      .pilot-callout a:hover { text-decoration: underline; }
      .complete-state {
        background: #12291F; border: 1px solid #1F6B4A; border-radius: 10px;
        padding: 1.1rem 1.2rem; color: #6EE7B0; font-size: 0.98rem; text-align: center;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

# --------------------------------------------------------------------------
# Header
# --------------------------------------------------------------------------
st.markdown(
    """
    <div class="hero">
      <div class="hero-mark">S</div>
      <div class="hero-name">Speclyn</div>
    </div>
    """,
    unsafe_allow_html=True,
)
st.markdown(
    '<p class="hero-tagline">Closing the gap between documentation AI and coding AI</p>',
    unsafe_allow_html=True,
)

# --------------------------------------------------------------------------
# Session state
# --------------------------------------------------------------------------
if "note_input" not in st.session_state:
    st.session_state.note_input = ""
# Persisted analysis result — kept so the page survives reruns triggered by
# the real-time preview buttons (which fire when analyze_clicked is False).
if "result" not in st.session_state:
    st.session_state.result = None
# Real-time preview interaction state.
if "preview_answered" not in st.session_state:
    st.session_state.preview_answered = False
if "preview_skipped" not in st.session_state:
    st.session_state.preview_skipped = False

# --------------------------------------------------------------------------
# Sidebar — sample notes
# --------------------------------------------------------------------------
with st.sidebar:
    st.markdown("### 📋 Sample Notes")
    st.caption("Load an example clinical note with one click.")
    for label, text in SAMPLE_NOTES.items():
        if st.button(label, use_container_width=True):
            # Write directly to the text area's own widget key so the box
            # actually updates, then rerun to reflect it immediately.
            st.session_state.note_input = text
            st.rerun()
    st.markdown("---")
    st.caption(
        "**Proof-of-concept demo.** In a real deployment, this runs inside your "
        "EHR environment with full HIPAA compliance and a BAA in place. No "
        "patient data is stored."
    )

# --------------------------------------------------------------------------
# Input
# --------------------------------------------------------------------------
PLACEHOLDER = (
    "e.g. Patient is a 68-year-old male with CHF, CKD, and diabetes presenting "
    "for follow-up. Doing reasonably well overall. Blood pressure controlled. "
    "Continue current medications. Follow up in 3 months."
)

note_text = st.text_area(
    "Clinical Note",
    height=300,
    placeholder=PLACEHOLDER,
    key="note_input",
)

analyze_clicked = st.button("🔍  Analyze Note", type="primary", use_container_width=True)


# --------------------------------------------------------------------------
# Rendering helpers
# --------------------------------------------------------------------------
def _section_header(title: str, icon: str, count):
    """Render a consistent section header with an optional count badge."""
    badge = f'<span class="sec-count">{count}</span>' if count else ""
    st.markdown(
        f'<div class="sec"><span class="sec-icon">{icon}</span>'
        f'<span class="sec-title">{title}</span>{badge}</div>',
        unsafe_allow_html=True,
    )


def _state_ok(msg: str):
    st.markdown(f'<div class="state-ok">✅ {msg}</div>', unsafe_allow_html=True)


def _severity_class(text: str) -> str:
    """Pick a badge color from the language of a status/detail string."""
    t = (text or "").lower()
    if any(k in t for k in ("not addressed", "not captured", "missed", "absent", "undocumented", "not documented")):
        return "tag-red"
    if any(k in t for k in ("under", "insufficient", "inadequate", "partial", "vague", "unspecified", "not specific")):
        return "tag-amber"
    return "tag-blue"


def _render_specificity_gaps(gaps):
    _section_header("Specificity Gaps", "🔍", len(gaps))
    if not gaps:
        _state_ok("No specificity gaps — this condition set is well documented.")
        return
    for gap in gaps:
        condition = gap.get("condition", "Condition")
        missing = gap.get("missing_specificity") or gap.get("missing") or ""
        codes = gap.get("possible_codes") or gap.get("icd_codes") or gap.get("codes") or []
        why = gap.get("why") or gap.get("why_it_matters") or ""

        chips_html = ""
        if isinstance(codes, list) and codes:
            chips = "".join(f'<span class="chip">{c}</span>' for c in codes)
            chips_html = (
                '<div class="kv"><span class="k">Candidate ICD-10</span></div>'
                f'<div class="chips">{chips}</div>'
            )
        elif codes:
            chips_html = f'<div class="kv"><span class="k">Candidate ICD-10</span>{codes}</div>'

        missing_html = f'<div class="kv"><span class="k">Missing</span>{missing}</div>' if missing else ""
        why_html = f'<div class="why"><b>Why it matters:</b> {why}</div>' if why else ""

        st.markdown(
            f"""
            <div class="card">
              <div class="card-head">
                <span class="card-title">{condition}</span>
                <span class="tag tag-amber">Specificity gap</span>
              </div>
              {missing_html}
              {chips_html}
              {why_html}
            </div>
            """,
            unsafe_allow_html=True,
        )


def _render_hcc(opportunities):
    _section_header("HCC Opportunities", "🎯", len(opportunities))
    if not opportunities:
        _state_ok("No missed HCC capture opportunities identified.")
        return
    for opp in opportunities:
        condition = opp.get("condition", "Condition")
        status = opp.get("status") or opp.get("documentation_status") or ""
        detail = opp.get("detail") or opp.get("issue") or opp.get("why") or ""

        tag_html = (
            f'<span class="tag {_severity_class(status or detail)}">{status}</span>'
            if status
            else '<span class="tag tag-blue">HCC-relevant</span>'
        )
        detail_html = f'<div class="kv">{detail}</div>' if detail else ""

        st.markdown(
            f"""
            <div class="card">
              <div class="card-head">
                <span class="card-title">{condition}</span>
                {tag_html}
              </div>
              {detail_html}
            </div>
            """,
            unsafe_allow_html=True,
        )


def _render_clarifications(questions):
    _section_header("Clarification Questions", "💬", len(questions))
    if not questions:
        st.markdown(
            '<div class="state-ok">✅ No physician clarification questions needed.</div>',
            unsafe_allow_html=True,
        )
        return
    for i, q in enumerate(questions, start=1):
        if isinstance(q, dict):
            text = q.get("question") or q.get("text") or ""
        else:
            text = str(q)
        st.markdown(
            f"""
            <div class="q-card">
              <div class="q-num">{i}</div>
              <div>
                <div class="q-eyebrow">Ask the physician</div>
                <div class="q-text">{text}</div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )


def _render_revenue(revenue):
    _section_header("Revenue Impact", "💰", None)
    if not revenue:
        st.markdown(
            '<div class="assume">No revenue impact estimated.</div>',
            unsafe_allow_html=True,
        )
        return

    total = revenue.get("total_range") or {}
    low = total.get("low")
    high = total.get("high")
    assumptions = revenue.get("assumptions", "")

    if low is not None and high is not None:
        st.markdown(
            f"""
            <div class="rev">
              <div class="rev-eyebrow">Estimated annual revenue at risk</div>
              <div class="rev-num">${low:,} — ${high:,}</div>
              <div class="rev-sub">per patient · per year</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # Per-item breakdown, if the model provided one.
    items = revenue.get("items") or revenue.get("breakdown") or []
    for item in items:
        if isinstance(item, dict):
            label = item.get("condition") or item.get("item") or "Item"
            ilow = item.get("low")
            ihigh = item.get("high")
            if ilow is not None and ihigh is not None:
                st.markdown(
                    f'<div class="card"><div class="card-head">'
                    f'<span class="card-title">{label}</span>'
                    f'<span class="tag tag-green" style="margin-left:auto;">${ilow:,} — ${ihigh:,}</span>'
                    f"</div></div>",
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    f'<div class="card"><span class="card-title">{label}</span></div>',
                    unsafe_allow_html=True,
                )

    if assumptions:
        st.markdown(
            f'<div class="assume"><b>Assumptions:</b> {assumptions}</div>',
            unsafe_allow_html=True,
        )


def render_results(data: dict):
    """Render the four structured output sections."""
    _render_specificity_gaps(data.get("specificity_gaps") or [])
    _render_hcc(data.get("hcc_opportunities") or [])
    _render_clarifications(data.get("clarification_questions") or [])
    _render_revenue(data.get("revenue_impact") or {})

    st.markdown(
        '<p class="disclaimer">Revenue estimates are based on published CMS/HCC '
        "benchmarks and industry standards. Actual impact varies by payer, "
        "specialty, and patient population.</p>",
        unsafe_allow_html=True,
    )


def render_realtime_preview(data: dict):
    """
    Render the 'What This Looks Like in Real Time' section.

    Takes the same parsed analysis dict as render_results().
    Displays a visual simulation of Speclyn during a live encounter.
    This is a storytelling/visualization component — not functional.
    """
    st.markdown(
        '<div class="realtime-header">How Speclyn works during the encounter</div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        '<p class="realtime-intro">The analysis above ran on a completed note. '
        "In a live deployment, Speclyn runs alongside your ambient scribe — "
        "reading the note as it forms, and surfacing these questions to the "
        "physician before the encounter ends. Here is what that moment looks "
        "like.</p>",
        unsafe_allow_html=True,
    )

    # The clinical note text that appears inside the "live" encounter card.
    note_draft = st.session_state.get("note_input", "").strip() or (
        "Clinical note is being dictated…"
    )

    # Pull the first clarification question.
    questions = data.get("clarification_questions", [])
    question_text = ""
    if questions:
        first_q = questions[0]
        if isinstance(first_q, dict):
            question_text = first_q.get("question") or first_q.get("text") or ""
        else:
            question_text = str(first_q)

    live_header = (
        '<div class="encounter-header">'
        '<span class="live-dot"><span class="live-pulse"></span>LIVE</span>'
        "· Encounter in progress</div>"
    )

    # Well-documented note → show the coding-complete state instead of a prompt.
    if not question_text:
        st.markdown(
            f"""
            <div class="encounter-card">
              {live_header}
              <div class="encounter-body">
                <div class="note-draft">{note_draft}</div>
                <div class="complete-state">
                  ✅ Note is coding-complete — no clarifications needed for this encounter.
                </div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        # Build the inner button/response row based on interaction state.
        if st.session_state.preview_answered:
            action_row = (
                '<div class="sim-answered">✅ Response captured — '
                "note updated automatically</div>"
            )
        elif st.session_state.preview_skipped:
            action_row = (
                '<div class="sim-skipped">Prompt dismissed — '
                "query will be sent after encounter</div>"
            )
        else:
            action_row = (
                '<span class="sim-btn sim-btn-answer">Answer verbally</span>'
                '<span class="sim-btn sim-btn-skip">Skip for now</span>'
            )

        st.markdown(
            f"""
            <div class="encounter-card">
              {live_header}
              <div class="encounter-body">
                <div class="note-draft">{note_draft}</div>
                <div class="speclyn-prompt-card">
                  <div class="prompt-label">💬 SPECLYN</div>
                  <div class="prompt-question">{question_text}</div>
                  {action_row}
                </div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        # Real clickable buttons live OUTSIDE the HTML card. Clicking sets
        # session state and reruns so the card above reflects the choice.
        col_a, col_b = st.columns(2)
        with col_a:
            if st.button("Answer verbally", use_container_width=True, key="preview_answer_btn"):
                st.session_state.preview_answered = True
                st.session_state.preview_skipped = False
                st.rerun()
        with col_b:
            if st.button("Skip for now", use_container_width=True, key="preview_skip_btn"):
                st.session_state.preview_skipped = True
                st.session_state.preview_answered = False
                st.rerun()

    # Stat pills.
    pill_a, pill_b, pill_c = st.columns(3)
    with pill_a:
        st.markdown('<div class="stat-pill">⏱ Prompt within 30 sec</div>', unsafe_allow_html=True)
    with pill_b:
        st.markdown('<div class="stat-pill">🔒 0 queries sent</div>', unsafe_allow_html=True)
    with pill_c:
        st.markdown('<div class="stat-pill">💰 Revenue gap closed</div>', unsafe_allow_html=True)

    st.caption(
        "In a live deployment, this prompt appears while the physician is still "
        "in the room — not in a CDI queue days later."
    )

    # Final pilot callout — the only place contact info appears.
    st.markdown(
        """
        <div class="pilot-callout">
          This demo runs on a completed note. In production, Speclyn integrates
          directly with your ambient scribe and EHR — surfacing prompts in real
          time, with full HIPAA compliance and a BAA in place.
          <br><br>
          Interested in a pilot? →
          <a href="mailto:amitprakhar35@gmail.com">amitprakhar35@gmail.com</a>
        </div>
        """,
        unsafe_allow_html=True,
    )


# --------------------------------------------------------------------------
# Analysis flow
# --------------------------------------------------------------------------
if analyze_clicked:
    # The note already persists via the text area's own widget key (note_input).
    # Reset the real-time preview interaction state for a fresh analysis.
    st.session_state.preview_answered = False
    st.session_state.preview_skipped = False

    if len(note_text.strip()) < MIN_NOTE_LENGTH:
        st.session_state.result = None
        st.warning("Please paste a complete clinical note for accurate analysis.")
    else:
        with st.spinner("Analyzing documentation gaps..."):
            try:
                st.session_state.result = analyze_note(note_text.strip())
            except AnalyzerError as err:
                st.session_state.result = None
                st.error(str(err))

# Render the persisted result. This lives OUTSIDE the analyze_clicked block so
# the results and the real-time preview survive reruns triggered by the
# preview buttons (when analyze_clicked is False).
result = st.session_state.result
if result is not None:
    if result.get("provider") == "openai":
        st.caption("⚠️ Claude unavailable — analyzed with OpenAI fallback.")
    if result["data"] is not None:
        render_results(result["data"])
        render_realtime_preview(result["data"])
    else:
        # JSON parsing failed — show the raw text rather than crashing.
        st.warning(
            "The analysis could not be formatted into structured sections. "
            "Here is the raw response:"
        )
        st.text(result["raw"])
