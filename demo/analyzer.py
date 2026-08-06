"""
analyzer.py — Claude API call logic and prompt engineering for Speclyn.

This module is the AI engine of the Speclyn Documentation Gap Analyzer.
It sends a clinical note to Claude and returns a structured analysis of
documentation gaps, HCC capture opportunities, physician clarification
questions, and estimated revenue impact.
"""

import json
import os

# Primary engine: Anthropic Claude. Opus 4.8 — most capable model for
# clinical reasoning.
ANTHROPIC_MODEL = "claude-opus-4-8"

# Secondary fallback: OpenAI, used only when no Anthropic key is configured
# or the Anthropic call fails at runtime.
OPENAI_MODEL = "gpt-4o"

MAX_TOKENS = 4096

# The system prompt is the heart of the product. Do not simplify or shorten it
# — the quality of the output depends entirely on the precision of this prompt.
SYSTEM_PROMPT = """You are a senior medical coding specialist and Clinical Documentation Improvement (CDI) expert with deep knowledge of ICD-10-CM, CPT coding guidelines, HCC (Hierarchical Condition Category) risk adjustment under CMS-HCC v28, and payer-specific LCD (Local Coverage Determination) policies.

Your job is to analyze clinical notes and identify documentation gaps that will cause revenue leakage — either through undercoding, specificity failures, or missed HCC capture opportunities.

You think like someone who has reviewed thousands of denied and undercoded claims and traced them back to the exact moment of documentation failure.

When analyzing a clinical note, you must:

1. SPECIFICITY GAPS: Identify every diagnosis mentioned or implied that lacks the specificity required for accurate ICD-10-CM coding. For each gap, name the condition, state what specificity is missing, and name the ICD-10 codes that could apply depending on the answer (from lowest to highest specificity).

2. HCC OPPORTUNITIES: Identify every chronic condition present in the note that is HCC-relevant under CMS-HCC v28 and assess whether it is documented with enough specificity and clinical context to be captured for risk adjustment. Flag conditions that are mentioned but not adequately "addressed" per CMS guidelines (conditions must be assessed, not merely listed).

3. CLARIFICATION QUESTIONS: For each gap identified, write the exact clarifying question a physician should be asked, in natural clinical language — not billing language. The question must feel like a colleague asking for clinical precision, not a coder demanding compliance. Each question must be specific, answerable in one sentence, and directly resolve the identified gap.

4. REVENUE IMPACT: Estimate the revenue impact of the identified gaps using these benchmarks:
   - Unspecified HCC condition (when specificity would change HCC weight): $900-$1,100 per member per year per 0.1 RAF point
   - Missed or underspecified chronic condition per encounter: $50-$200 per visit
   - Calculate a total range across all identified gaps
   - State assumptions clearly

CRITICAL RULES:
- Never invent conditions not present or implied in the note
- Never suggest upcoding — only accurate, specific, defensible coding
- If the note is already well-documented, say so clearly and specifically
- Always explain WHY each gap matters for coding, not just that it exists
- Write clarification questions in plain English a physician would actually respond to

Output format: structured JSON with four keys: "specificity_gaps", "hcc_opportunities", "clarification_questions", "revenue_impact". Each key contains an array of objects. Revenue impact also contains a "total_range" object with "low" and "high" integer values in USD, and an "assumptions" string."""


class AnalyzerError(Exception):
    """Raised when the analysis cannot be completed. Carries a clean,
    user-facing message — never a raw traceback."""


def _anthropic_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _openai_available() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


def build_user_prompt(note_text: str) -> str:
    """Build the user prompt for a given clinical note."""
    return f"""
Please analyze the following clinical note for documentation gaps, HCC capture opportunities, and revenue impact.

CLINICAL NOTE:
{note_text}

Return your analysis as valid JSON only. No preamble, no explanation outside the JSON structure.
"""


def _extract_json(text: str):
    """Best-effort extraction of a JSON object from the model response.

    Handles the common cases: a clean JSON body, JSON wrapped in a
    ```json fenced block, or JSON with leading/trailing prose. Returns
    the parsed object, or raises ValueError if no valid JSON is found.
    """
    text = text.strip()

    # Strip a markdown code fence if present.
    if text.startswith("```"):
        # Remove the opening fence (``` or ```json) and the closing fence.
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
        text = text.strip()

    # Try a direct parse first.
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fall back to extracting the outermost {...} span.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start : end + 1]
        return json.loads(candidate)

    raise ValueError("No valid JSON object found in response.")


def _call_anthropic(note_text: str) -> str:
    """Call Claude and return the raw text response. Raises on failure."""
    from anthropic import Anthropic

    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_user_prompt(note_text)}],
    )
    return "".join(
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text"
    ).strip()


def _call_openai(note_text: str) -> str:
    """Call OpenAI and return the raw text response. Raises on failure.

    Used only as a secondary fallback. Requests a JSON object response so the
    output matches the structure Claude produces.
    """
    from openai import OpenAI

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        max_tokens=MAX_TOKENS,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(note_text)},
        ],
    )
    return (response.choices[0].message.content or "").strip()


def analyze_note(note_text: str) -> dict:
    """Analyze a clinical note and return structured results.

    Provider strategy: Claude (Anthropic) is primary. OpenAI is a secondary
    fallback used when no Anthropic key is configured, or when the Anthropic
    call fails at runtime.

    Returns a dict with keys:
      - "data": the parsed JSON analysis (dict), or None if parsing failed
      - "raw": the raw text response from the model (always present)
      - "provider": which engine produced the result ("anthropic" | "openai")

    Raises AnalyzerError (with a clean message) if no provider is configured,
    or if every configured provider fails. JSON parse failures do NOT raise —
    they return raw text so the UI can display it rather than crash.
    """
    if not _anthropic_available() and not _openai_available():
        raise AnalyzerError(
            "No API key configured. Set ANTHROPIC_API_KEY (primary) or "
            "OPENAI_API_KEY (fallback) in your environment or in Streamlit "
            "Cloud secrets."
        )

    # Ordered list of (provider name, caller) to try in sequence.
    providers = []
    if _anthropic_available():
        providers.append(("anthropic", _call_anthropic))
    if _openai_available():
        providers.append(("openai", _call_openai))

    raw_text = None
    used_provider = None
    errors = []

    for name, caller in providers:
        try:
            raw_text = caller(note_text)
            used_provider = name
            break
        except Exception as exc:  # noqa: BLE001 — try the next provider, then surface cleanly
            errors.append(f"{name}: {exc}")

    if raw_text is None:
        raise AnalyzerError(
            "The analysis service is temporarily unavailable. Please try again "
            f"in a moment. (Details: {'; '.join(errors)})"
        )

    try:
        data = _extract_json(raw_text)
    except (ValueError, json.JSONDecodeError):
        data = None

    return {"data": data, "raw": raw_text, "provider": used_provider}
