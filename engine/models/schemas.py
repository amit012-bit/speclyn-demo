"""
schemas.py — Pydantic request/response models for the Speclyn engine.

These define the contract in docs/SPECLYN_FULL_BUILD.md exactly:
POST /analyze accepts note text + mode + optional specialty and a list of
already-surfaced gap IDs; the response carries the four analysis sections
plus realtime bookkeeping fields.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AnalysisMode(str, Enum):
    realtime = "realtime"
    complete = "complete"


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    note_text: str = Field(..., description="The clinical note or transcript so far")
    mode: AnalysisMode = Field(
        AnalysisMode.complete,
        description="'realtime' for in-progress encounters, 'complete' for finished notes",
    )
    specialty: Optional[str] = Field(
        None, description="Optional specialty context, e.g. 'cardiology', 'primary_care'"
    )
    previous_gaps: list[str] = Field(
        default_factory=list,
        description="Gap IDs already surfaced this encounter — never repeat these",
    )


# ---------------------------------------------------------------------------
# Response components
# ---------------------------------------------------------------------------
class SpecificityGap(BaseModel):
    id: str = Field(..., description="Stable slug ID, e.g. 'chf-systolic-vs-diastolic'")
    condition: str
    missing: str = Field(..., description="What specificity is missing")
    possible_codes: list[str] = Field(
        default_factory=list,
        description="Candidate ICD-10 codes from lowest to highest specificity",
    )
    why: str = Field("", description="Why this gap matters for coding")


class HCCOpportunity(BaseModel):
    id: str
    condition: str
    status: str = Field("", description="Documentation status, e.g. 'mentioned but not addressed'")
    detail: str = Field("", description="What is needed to capture this for risk adjustment")


class ClarificationQuestion(BaseModel):
    id: str = Field(..., description="Matches the gap ID this question resolves")
    question: str


class RevenueItem(BaseModel):
    condition: str
    low: int
    high: int
    basis: str = Field("", description="Which benchmark this line item uses")


class TotalRange(BaseModel):
    low: int
    high: int


class RevenueImpact(BaseModel):
    total_range: TotalRange
    items: list[RevenueItem] = Field(default_factory=list)
    assumptions: str = ""


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------
class AnalyzeResponse(BaseModel):
    specificity_gaps: list[SpecificityGap] = Field(default_factory=list)
    hcc_opportunities: list[HCCOpportunity] = Field(default_factory=list)
    clarification_questions: list[ClarificationQuestion] = Field(default_factory=list)
    revenue_impact: RevenueImpact
    new_gaps_only: bool = Field(
        False, description="True when realtime mode filtered out previously surfaced gaps"
    )
    analysis_mode: AnalysisMode
    provider: str = Field("", description="Which LLM produced this analysis")


class HealthResponse(BaseModel):
    status: str = "ok"
    providers: dict[str, bool] = Field(
        default_factory=dict,
        description="Which LLM providers have keys configured, e.g. {'anthropic': false, 'openai': true}",
    )
