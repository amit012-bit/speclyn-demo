"""
main.py — Speclyn Engine (FastAPI entry point).

The CDI brain of Speclyn: ICD-10/HCC gap analysis, realtime encounter
streaming, and LLM orchestration (Claude → OpenAI → Gemini).

Run locally:
    uvicorn main:app --reload --port 8000
"""

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load engine/.env first, then fall back to a repo-root .env for local dev.
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from routers import analyze, health, stream  # noqa: E402 — after env load

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(
    title="Speclyn Engine",
    description="Real-time clinical documentation intelligence — CDI analysis engine.",
    version="1.0.0",
)

# CORS: the Node backend is the only intended caller in production, but
# allowing the frontend origin too keeps local development friction-free.
_default_origins = "http://localhost:3000,http://localhost:4000"
origins = [
    o.strip()
    for o in os.environ.get("CORS_ORIGIN", _default_origins).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analyze.router)
app.include_router(stream.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
