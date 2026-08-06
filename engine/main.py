"""
main.py — Speclyn Engine (FastAPI entry point).

The CDI brain of Speclyn: ICD-10/HCC gap analysis, realtime encounter
streaming, and LLM orchestration (Claude → OpenAI → Gemini by default).

Run locally — pick your primary provider with a flag:
    python main.py                # default order: Claude -> OpenAI -> Gemini
    python main.py --openai       # OpenAI primary, others as fallback
    python main.py --claude       # Claude primary
    python main.py --gemini       # Gemini primary
    python main.py --openai --port 8001

Or via uvicorn / deployment platforms, set LLM_PRIMARY instead:
    LLM_PRIMARY=openai uvicorn main:app --port 8000
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
    import argparse

    import uvicorn

    from services.llm_orchestrator import available_providers, provider_order

    parser = argparse.ArgumentParser(
        description="Speclyn Engine — pick the primary LLM provider with a flag."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--claude", "--anthropic",
        action="store_const", const="anthropic", dest="primary",
        help="Use Claude (Anthropic) as the primary provider",
    )
    group.add_argument(
        "--openai", "--gpt",
        action="store_const", const="openai", dest="primary",
        help="Use OpenAI as the primary provider",
    )
    group.add_argument(
        "--gemini", "--google",
        action="store_const", const="gemini", dest="primary",
        help="Use Gemini (Google) as the primary provider",
    )
    parser.add_argument(
        "--port", type=int, default=int(os.environ.get("PORT", "8000")),
        help="Port to serve on (default: PORT env var or 8000)",
    )
    parser.add_argument(
        "--reload", action="store_true", help="Auto-reload on code changes (dev)"
    )
    args = parser.parse_args()

    if args.primary:
        os.environ["LLM_PRIMARY"] = args.primary

    order = provider_order()
    keys = available_providers()
    active = [p for p in order if keys[p]]
    print(f"Provider chain: {' -> '.join(order)}")
    if args.primary and not keys[args.primary]:
        print(
            f"WARNING: --{args.primary} requested but no API key is configured "
            f"for it — requests will fall through to: {', '.join(active) or 'NONE'}"
        )
    elif not active:
        print("WARNING: no LLM API keys configured — /analyze will return 503.")

    uvicorn.run("main:app", host="0.0.0.0", port=args.port, reload=args.reload)
