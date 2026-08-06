"""
gap_detector.py — Core CDI analysis logic for the Speclyn engine.

Orchestrates prompt assembly → LLM call → validation → realtime dedup.
In realtime mode, gaps whose IDs appear in `previous_gaps` are filtered out
and the number of surfaced clarification prompts is capped
(MAX_GAPS_PER_CYCLE) so the physician is never overwhelmed.
"""

import os
import re

from models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisMode,
    RevenueImpact,
)
from prompts.system_prompt import build_system_prompt, build_user_prompt
from services.llm_orchestrator import run_analysis
from services.revenue_calculator import validate_revenue_impact


def _max_gaps_per_cycle() -> int:
    try:
        return int(os.environ.get("MAX_GAPS_PER_CYCLE", "2"))
    except ValueError:
        return 2


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "gap"


# Common clinical abbreviations → canonical slugs, so "CHF" and
# "Congestive heart failure" dedup to the same condition across cycles.
_CONDITION_ALIASES = {
    "chf": "congestive-heart-failure",
    "congestive-heart-failure": "congestive-heart-failure",
    "heart-failure": "congestive-heart-failure",
    "ckd": "chronic-kidney-disease",
    "chronic-kidney-disease": "chronic-kidney-disease",
    "dm": "diabetes",
    "diabetes-mellitus": "diabetes",
    "type-2-diabetes": "diabetes",
    "type-2-diabetes-mellitus": "diabetes",
    "t2dm": "diabetes",
    "copd": "copd",
    "chronic-obstructive-pulmonary-disease": "copd",
    "htn": "hypertension",
    "cva": "stroke",
    "mdd": "depression",
    "major-depressive-disorder": "depression",
}


def _condition_key(condition: str) -> str:
    """Canonical per-condition dedup key.

    Robust to LLM variance like 'CHF' vs 'Congestive Heart Failure (CHF)':
    parentheticals are stripped, then the slug is alias-mapped; if no direct
    hit, any alias appearing as a token sequence inside the slug wins
    (longest first, so 'chronic-kidney-disease' beats 'ckd')."""
    cleaned = re.sub(r"\([^)]*\)", " ", condition)  # drop "(CKD)" etc.
    slug = _slugify(cleaned)
    if slug in _CONDITION_ALIASES:
        return _CONDITION_ALIASES[slug]
    tokens = slug.split("-")
    for alias in sorted(_CONDITION_ALIASES, key=len, reverse=True):
        alias_tokens = alias.split("-")
        n = len(alias_tokens)
        if any(tokens[i : i + n] == alias_tokens for i in range(len(tokens) - n + 1)):
            return _CONDITION_ALIASES[alias]
    return slug


def _assign_ids(items: list[dict]) -> list[dict]:
    """Assign server-side canonical IDs: '<condition-key>--<detail-slug>'.

    LLM-provided IDs are NOT trusted — the same gap gets differently worded
    slugs across cycles (observed: 'chf-systolic-vs-diastolic' vs
    'chf-type-unspecified'), which breaks realtime dedup. The condition-key
    prefix makes cross-cycle matching reliable.
    """
    for item in items:
        item["_llm_id"] = item.get("id")  # preserved for question-ID mapping
        detail = item.get("missing") or item.get("status") or item.get("detail") or "gap"
        item["id"] = f"{_condition_key(item.get('condition', 'condition'))}--{_slugify(str(detail))[:40]}"
    return items


def _is_previously_surfaced(gap_id: str, seen: set[str]) -> bool:
    """A gap is a repeat if its exact ID was surfaced OR any surfaced gap
    shares its condition prefix. Erring toward fewer prompts is deliberate:
    physician cognitive load is the product killer (spec: 'less is more')."""
    if gap_id in seen:
        return True
    prefix = gap_id.split("--", 1)[0]
    return any(s.split("--", 1)[0] == prefix for s in seen)


def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """Run a full CDI analysis for the given request."""
    system_prompt = build_system_prompt(
        mode=request.mode.value, specialty=request.specialty
    )
    user_prompt = build_user_prompt(
        request.note_text, previous_gaps=request.previous_gaps
    )

    data, provider = run_analysis(system_prompt, user_prompt)

    gaps = _assign_ids(list(data.get("specificity_gaps") or []))
    hccs = _assign_ids(list(data.get("hcc_opportunities") or []))
    questions = list(data.get("clarification_questions") or [])
    revenue = dict(data.get("revenue_impact") or {})

    # Map the LLM's own gap IDs → our server-assigned canonical IDs, so
    # question linkage survives the ID rewrite in _assign_ids.
    llm_to_canonical = {
        item.pop("_llm_id"): item["id"] for item in gaps + hccs if item.get("_llm_id")
    }

    # Normalize question shape and IDs (LLM may return bare strings).
    normalized_questions: list[dict] = []
    for i, q in enumerate(questions):
        text = (q.get("question") or q.get("text") or "") if isinstance(q, dict) else str(q)
        llm_qid = q.get("id") if isinstance(q, dict) else None
        if llm_qid and llm_qid in llm_to_canonical:
            qid = llm_to_canonical[llm_qid]
        elif i < len(gaps):
            qid = gaps[i]["id"]  # positional fallback: question i ↔ gap i
        else:
            qid = _slugify(text[:60]) or f"q-{i}"
        normalized_questions.append({"id": qid, "question": text})

    new_gaps_only = False
    if request.mode == AnalysisMode.realtime:
        seen = set(request.previous_gaps)
        new_gaps_only = True

        gaps = [g for g in gaps if not _is_previously_surfaced(g["id"], seen)]
        hccs = [h for h in hccs if not _is_previously_surfaced(h["id"], seen)]
        surviving_ids = {g["id"] for g in gaps} | {h["id"] for h in hccs}
        normalized_questions = [
            q
            for q in normalized_questions
            if not _is_previously_surfaced(q["id"], seen) and q["id"] in surviving_ids
        ]

        # Cap prompts per cycle — cognitive load is the product killer.
        cap = _max_gaps_per_cycle()
        normalized_questions = normalized_questions[:cap]

    # Deterministic guardrail over the LLM's revenue math.
    revenue = validate_revenue_impact(revenue, num_hcc_gaps=len(hccs), num_specificity_gaps=len(gaps))

    return AnalyzeResponse(
        specificity_gaps=gaps,
        hcc_opportunities=hccs,
        clarification_questions=normalized_questions,
        revenue_impact=RevenueImpact(**revenue),
        new_gaps_only=new_gaps_only,
        analysis_mode=request.mode,
        provider=provider,
    )
