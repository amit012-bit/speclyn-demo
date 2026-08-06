"""
stream.py — WebSocket /stream: real-time encounter analysis.

Phase-1 scope: accepts TEXT transcript chunks (JSON messages) and maintains
per-connection encounter state — the set of gap IDs already surfaced — so the
same prompt never fires twice in one encounter. Audio ingestion via
AssemblyAI is a Phase-4 addition; the message protocol below is designed so
audio can be added without breaking text clients.

Protocol (client → engine), JSON per message:
  {"type": "transcript", "text": "<full transcript so far>"}
  {"type": "end"}                     — end the encounter, get final analysis

Engine → client:
  {"type": "gaps", ...AnalyzeResponse}       — new gaps for this cycle
  {"type": "final", ...AnalyzeResponse}      — complete end-of-encounter analysis
  {"type": "error", "detail": "<message>"}
"""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from models.schemas import AnalyzeRequest, AnalysisMode
from services.gap_detector import analyze as run_gap_analysis
from services.llm_orchestrator import LLMError

logger = logging.getLogger("speclyn.stream")

router = APIRouter()

MIN_ANALYZABLE_LENGTH = 50


@router.websocket("/stream")
async def stream(websocket: WebSocket):
    await websocket.accept()

    # Per-encounter state: gap IDs already surfaced to this physician.
    surfaced: set[str] = set()
    latest_transcript = ""

    try:
        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")

            if msg_type == "transcript":
                latest_transcript = str(message.get("text") or "")
                if len(latest_transcript.strip()) < MIN_ANALYZABLE_LENGTH:
                    continue  # not enough signal yet — wait for more speech

                request = AnalyzeRequest(
                    note_text=latest_transcript,
                    mode=AnalysisMode.realtime,
                    previous_gaps=sorted(surfaced),
                )
                try:
                    # The LLM call is sync/blocking — run it off the event loop.
                    result = await run_in_threadpool(run_gap_analysis, request)
                except LLMError as exc:
                    await websocket.send_json({"type": "error", "detail": str(exc)})
                    continue

                # Remember everything surfaced this cycle.
                for gap in result.specificity_gaps:
                    surfaced.add(gap.id)
                for hcc in result.hcc_opportunities:
                    surfaced.add(hcc.id)

                if result.clarification_questions or result.specificity_gaps:
                    await websocket.send_json(
                        {"type": "gaps", **result.model_dump(mode="json")}
                    )

            elif msg_type == "end":
                if len(latest_transcript.strip()) >= MIN_ANALYZABLE_LENGTH:
                    request = AnalyzeRequest(
                        note_text=latest_transcript,
                        mode=AnalysisMode.complete,
                    )
                    try:
                        result = await run_in_threadpool(run_gap_analysis, request)
                        await websocket.send_json(
                            {"type": "final", **result.model_dump(mode="json")}
                        )
                    except LLMError as exc:
                        await websocket.send_json({"type": "error", "detail": str(exc)})
                await websocket.close()
                return

            else:
                await websocket.send_json(
                    {"type": "error", "detail": f"Unknown message type: {msg_type!r}"}
                )

    except WebSocketDisconnect:
        logger.info("stream client disconnected")
