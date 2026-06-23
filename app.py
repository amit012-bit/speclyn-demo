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
# Styling
# --------------------------------------------------------------------------
st.markdown(
    """
    <style>
      .speclyn-logo {
          font-size: 2.6rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 0.1rem;
          color: #0F4C81;
      }
      .speclyn-tagline {
          font-size: 1.05rem;
          color: #5A6B7B;
          margin-top: 0;
          margin-bottom: 1.5rem;
      }
      .section-card {
          background: #F7FAFC;
          border: 1px solid #E2E8F0;
          border-left: 4px solid #0F4C81;
          border-radius: 8px;
          padding: 1.1rem 1.3rem;
          margin-bottom: 0.9rem;
      }
      .clarify-box {
          background: #EBF5FF;
          border: 1px solid #BEE3F8;
          border-radius: 8px;
          padding: 0.9rem 1.1rem;
          margin-bottom: 0.7rem;
          font-size: 1.02rem;
      }
      .clarify-num {
          display: inline-block;
          background: #0F4C81;
          color: #fff;
          font-weight: 700;
          border-radius: 50%;
          width: 1.7rem;
          height: 1.7rem;
          line-height: 1.7rem;
          text-align: center;
          margin-right: 0.6rem;
      }
      .revenue-range {
          font-size: 2.8rem;
          font-weight: 800;
          color: #1A7A4C;
          margin: 0.2rem 0;
      }
      .revenue-assumptions {
          font-size: 0.9rem;
          color: #5A6B7B;
      }
      .disclaimer {
          font-size: 0.82rem;
          color: #8A98A6;
          border-top: 1px solid #E2E8F0;
          padding-top: 1rem;
          margin-top: 2rem;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

# --------------------------------------------------------------------------
# Header
# --------------------------------------------------------------------------
st.markdown('<div class="speclyn-logo">Speclyn</div>', unsafe_allow_html=True)
st.markdown(
    '<p class="speclyn-tagline">Closing the gap between documentation AI and coding AI</p>',
    unsafe_allow_html=True,
)

# --------------------------------------------------------------------------
# Sidebar — sample notes
# --------------------------------------------------------------------------
if "note_text" not in st.session_state:
    st.session_state.note_text = ""

with st.sidebar:
    st.header("Sample Notes")
    st.caption("Load an example clinical note with one click.")
    for label, text in SAMPLE_NOTES.items():
        if st.button(label, use_container_width=True):
            st.session_state.note_text = text
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
    value=st.session_state.note_text,
    height=300,
    placeholder=PLACEHOLDER,
    key="note_input",
)

analyze_clicked = st.button("Analyze Note", type="primary", use_container_width=True)


# --------------------------------------------------------------------------
# Rendering helpers
# --------------------------------------------------------------------------
def _render_specificity_gaps(gaps):
    st.subheader("Specificity Gaps")
    if not gaps:
        st.success("No specificity gaps identified — this condition set is well documented.")
        return
    for gap in gaps:
        condition = gap.get("condition", "Condition")
        missing = gap.get("missing_specificity") or gap.get("missing") or ""
        codes = gap.get("possible_codes") or gap.get("icd_codes") or gap.get("codes") or []
        why = gap.get("why") or gap.get("why_it_matters") or ""
        codes_str = ", ".join(codes) if isinstance(codes, list) else str(codes)
        body = f"**{condition}** — {missing}"
        if codes_str:
            body += f"<br><span style='color:#5A6B7B;'>Possible ICD-10: {codes_str}</span>"
        if why:
            body += f"<br><span style='color:#5A6B7B;'>{why}</span>"
        st.markdown(f'<div class="section-card">{body}</div>', unsafe_allow_html=True)


def _render_hcc(opportunities):
    st.subheader("HCC Opportunities")
    if not opportunities:
        st.success("No missed HCC capture opportunities identified.")
        return
    for opp in opportunities:
        condition = opp.get("condition", "Condition")
        status = opp.get("status") or opp.get("documentation_status") or ""
        detail = opp.get("detail") or opp.get("issue") or opp.get("why") or ""
        body = f"**{condition}**"
        if status:
            body += f" — {status}"
        if detail:
            body += f"<br><span style='color:#5A6B7B;'>{detail}</span>"
        st.markdown(f'<div class="section-card">{body}</div>', unsafe_allow_html=True)


def _render_clarifications(questions):
    st.subheader("Clarification Questions")
    if not questions:
        st.info("No physician clarification questions needed.")
        return
    for i, q in enumerate(questions, start=1):
        if isinstance(q, dict):
            text = q.get("question") or q.get("text") or ""
        else:
            text = str(q)
        st.markdown(
            f'<div class="clarify-box"><span class="clarify-num">{i}</span>{text}</div>',
            unsafe_allow_html=True,
        )


def _render_revenue(revenue):
    st.subheader("Revenue Impact")
    if not revenue:
        st.info("No revenue impact estimated.")
        return

    total = revenue.get("total_range") or {}
    low = total.get("low")
    high = total.get("high")
    assumptions = revenue.get("assumptions", "")

    if low is not None and high is not None:
        st.markdown(
            f'<div class="revenue-range">${low:,} — ${high:,}</div>',
            unsafe_allow_html=True,
        )
        st.caption("Estimated impact per patient per year")

    # Per-item breakdown, if the model provided one.
    items = revenue.get("items") or revenue.get("breakdown") or []
    for item in items:
        if isinstance(item, dict):
            label = item.get("condition") or item.get("item") or "Item"
            ilow = item.get("low")
            ihigh = item.get("high")
            if ilow is not None and ihigh is not None:
                st.markdown(
                    f'<div class="section-card">**{label}** — ${ilow:,} — ${ihigh:,}</div>',
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    f'<div class="section-card">{label}</div>', unsafe_allow_html=True
                )

    if assumptions:
        st.markdown(
            f'<p class="revenue-assumptions"><strong>Assumptions:</strong> {assumptions}</p>',
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


# --------------------------------------------------------------------------
# Analysis flow
# --------------------------------------------------------------------------
if analyze_clicked:
    # Keep the note in session state so it survives the rerun.
    st.session_state.note_text = note_text

    if len(note_text.strip()) < MIN_NOTE_LENGTH:
        st.warning("Please paste a complete clinical note for accurate analysis.")
    else:
        with st.spinner("Analyzing documentation gaps..."):
            try:
                result = analyze_note(note_text.strip())
            except AnalyzerError as err:
                result = None
                st.error(str(err))

        if result is not None:
            if result.get("provider") == "openai":
                st.caption("⚠️ Claude unavailable — analyzed with OpenAI fallback.")
            if result["data"] is not None:
                render_results(result["data"])
            else:
                # JSON parsing failed — show the raw text rather than crashing.
                st.warning(
                    "The analysis could not be formatted into structured sections. "
                    "Here is the raw response:"
                )
                st.text(result["raw"])
