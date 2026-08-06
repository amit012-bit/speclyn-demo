"""analyze.py — POST /analyze: the core CDI analysis endpoint."""

import logging

from fastapi import APIRouter, HTTPException

from models.schemas import AnalyzeRequest, AnalyzeResponse
from services.gap_detector import analyze as run_gap_analysis
from services.llm_orchestrator import LLMError

logger = logging.getLogger("speclyn.analyze")

router = APIRouter()

MIN_NOTE_LENGTH = 50


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    if len(request.note_text.strip()) < MIN_NOTE_LENGTH:
        raise HTTPException(
            status_code=422,
            detail="Note too short — provide a complete clinical note for accurate analysis.",
        )
    try:
        return run_gap_analysis(request)
    except LLMError as exc:
        # Provider-level failure → 503 so callers know to retry, with a clean message.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 — never leak a traceback to the client
        logger.exception("analysis failed")
        raise HTTPException(
            status_code=500, detail="Analysis failed unexpectedly. Please try again."
        ) from exc
