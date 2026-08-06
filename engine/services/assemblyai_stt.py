"""
assemblyai_stt.py — AssemblyAI realtime STT support (Universal-3.5 Pro).

Architecture (per AssemblyAI's official browser pattern): the BROWSER connects
directly to `wss://streaming.assemblyai.com/v3/ws` using a short-lived token
minted here, server-side — the API key never reaches the client. Final Turn
transcripts then feed Speclyn's existing text realtime loop (frontend →
backend Socket.io relay → engine /stream). No audio flows through our servers.

Realtime parameters verified against live AssemblyAI docs (2026-08):
  speech_model=universal-3-5-pro · mode=balanced · domain=medical-v1
  keyterms_prompt (≤100 terms) · sample_rate=16000
"""

import logging
import os

import httpx

logger = logging.getLogger("speclyn.stt")

TOKEN_URL = "https://streaming.assemblyai.com/v3/token"
TOKEN_EXPIRES_SECONDS = 60  # single-use; minted per encounter start

# Medical Mode — clinical vocabulary tuning on U3.5 Pro realtime.
STT_DOMAIN = "medical-v1"

# Domain terms beyond what medical mode covers — coding/HCC jargon and the
# common clinical abbreviations Speclyn cares about. ≤100 terms (API cap).
MEDICAL_KEYTERMS = [
    "HCC", "ICD-10", "CPT", "HbA1c", "eGFR", "HFrEF", "HFpEF",
    "RAF", "Medicare Advantage", "CKD", "COPD", "CHF", "CVA",
    "metformin", "lisinopril", "furosemide", "atorvastatin",
    "hyperglycemia", "hypoglycemia", "neuropathy", "nephropathy",
    "retinopathy", "diastolic", "systolic", "ejection fraction",
    "creatinine", "BMP", "CBC", "A1c", "BMI",
]


def _api_key() -> str:
    """AssemblyAI key — accepts ASSEMBLYAI_API_KEY (canonical) or the
    common misspelling ASSEMBLY_API_KEY."""
    return os.environ.get("ASSEMBLYAI_API_KEY") or os.environ.get("ASSEMBLY_API_KEY", "")


def stt_available() -> bool:
    """True when an AssemblyAI key is configured."""
    return bool(_api_key())


async def mint_streaming_token(expires_in_seconds: int = TOKEN_EXPIRES_SECONDS) -> str:
    """Mint a single-use realtime token for a browser client.

    Note: the Authorization header is the RAW key — no 'Bearer' prefix
    (AssemblyAI STT convention). Raises for HTTP errors; callers translate
    to a clean API response.
    """
    if not stt_available():
        raise RuntimeError("ASSEMBLYAI_API_KEY not configured")

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            TOKEN_URL,
            params={"expires_in_seconds": expires_in_seconds},
            headers={"Authorization": _api_key()},
        )
        response.raise_for_status()
        return response.json()["token"]
