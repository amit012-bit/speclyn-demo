"""
assemblyai_stt.py — AssemblyAI real-time speech-to-text integration.

NOTE ON API VERSION: the original build spec sketched `aai.RealtimeTranscriber`,
which is DEPRECATED. This module uses the current (2026) streaming API:
`assemblyai.streaming.v3.StreamingClient`. See
https://github.com/AssemblyAI/assemblyai-python-sdk for the reference.

Voice is a Phase-4 feature. Until an ASSEMBLYAI_API_KEY is configured, the
engine's /stream endpoint accepts TEXT transcript chunks directly and this
module reports unavailable — the product degrades gracefully to text mode,
per the spec ("never show an error that blocks the user").
"""

import logging
import os
from typing import Callable

logger = logging.getLogger("speclyn.stt")

SAMPLE_RATE = 16_000

# Medical terminology boost — common clinical terms generic STT mishears.
MEDICAL_WORD_BOOST = [
    "HCC", "ICD-10", "CPT", "HbA1c", "eGFR", "HFrEF", "HFpEF",
    "RAF", "Medicare Advantage", "CKD", "COPD", "CHF", "CVA",
    "metformin", "lisinopril", "furosemide", "atorvastatin",
    "hyperglycemia", "hypoglycemia", "neuropathy", "nephropathy",
    "retinopathy", "diastolic", "systolic", "ejection fraction",
    "creatinine", "BMP", "CBC", "A1c", "BMI",
]


def stt_available() -> bool:
    """True when an AssemblyAI key is configured."""
    return bool(os.environ.get("ASSEMBLYAI_API_KEY"))


def create_streaming_client(
    on_turn: Callable[[str, bool], None],
    on_error: Callable[[Exception], None],
):
    """Create a v3 StreamingClient wired to the given callbacks.

    on_turn(transcript_text, end_of_turn) fires as transcript turns arrive.
    Returns the connected-ready client; caller is responsible for
    client.connect(...) / client.stream(...) / client.disconnect().

    Raises RuntimeError when no API key is configured — callers should check
    stt_available() first and fall back to text mode.
    """
    if not stt_available():
        raise RuntimeError(
            "ASSEMBLYAI_API_KEY not configured — voice transcription unavailable, "
            "use text mode."
        )

    from assemblyai.streaming.v3 import (
        StreamingClient,
        StreamingClientOptions,
        StreamingError,
        StreamingEvents,
        TurnEvent,
    )

    client = StreamingClient(
        StreamingClientOptions(api_key=os.environ["ASSEMBLYAI_API_KEY"])
    )

    def _handle_turn(_client, event: TurnEvent):
        on_turn(event.transcript, bool(getattr(event, "end_of_turn", False)))

    def _handle_error(_client, error: StreamingError):
        logger.error("AssemblyAI streaming error: %s", error)
        on_error(Exception(str(error)))

    client.on(StreamingEvents.Turn, _handle_turn)
    client.on(StreamingEvents.Error, _handle_error)
    return client
