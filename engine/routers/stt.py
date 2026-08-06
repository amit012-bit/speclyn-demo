"""stt.py — GET /stt/token: mint a browser realtime-transcription token.

Returns everything the frontend needs to open its own WebSocket to
AssemblyAI: the single-use token plus the medical domain + keyterms config
(kept server-side as the single source of truth).
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.assemblyai_stt import (
    MEDICAL_KEYTERMS,
    STT_DOMAIN,
    mint_streaming_token,
    stt_available,
)

logger = logging.getLogger("speclyn.stt")

router = APIRouter()


class SttTokenResponse(BaseModel):
    token: str
    keyterms: list[str]
    domain: str


@router.get("/stt/token", response_model=SttTokenResponse)
async def stt_token() -> SttTokenResponse:
    if not stt_available():
        raise HTTPException(
            status_code=503,
            detail="Voice transcription not configured — set ASSEMBLYAI_API_KEY. "
            "Text mode remains available.",
        )
    try:
        token = await mint_streaming_token()
    except httpx.HTTPStatusError as exc:
        logger.error("AssemblyAI token mint failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not obtain a transcription token — check the AssemblyAI key.",
        ) from exc
    except Exception as exc:  # noqa: BLE001 — clean message, never a traceback
        logger.exception("token mint error")
        raise HTTPException(
            status_code=502, detail="Voice transcription temporarily unavailable."
        ) from exc

    return SttTokenResponse(token=token, keyterms=MEDICAL_KEYTERMS, domain=STT_DOMAIN)
