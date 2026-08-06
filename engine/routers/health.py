"""health.py — GET /health for uptime checks and provider visibility."""

from fastapi import APIRouter

from models.schemas import HealthResponse
from services.llm_orchestrator import available_providers, provider_order

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok", providers=available_providers(), order=provider_order()
    )
