"""
llm_orchestrator.py — Three-tier LLM strategy for the Speclyn engine.

Provider order: Claude Opus 4.8 (primary) → OpenAI GPT-4o → Gemini 1.5 Pro.
Never more than one provider per request cycle — try in order, first success
wins. A provider is only attempted when its API key is configured, so the
engine works with any subset of keys present.
"""

import json
import logging
import os

logger = logging.getLogger("speclyn.llm")

ANTHROPIC_MODEL = "claude-opus-4-8"
OPENAI_MODEL = "gpt-4o"
GEMINI_MODEL = "gemini-1.5-pro"
MAX_TOKENS = 4096


class LLMError(Exception):
    """Raised when every configured provider fails (or none are configured)."""


def available_providers() -> dict[str, bool]:
    """Which providers have API keys configured — used by /health."""
    return {
        "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "openai": bool(os.environ.get("OPENAI_API_KEY")),
        "gemini": bool(os.environ.get("GEMINI_API_KEY")),
    }


# ---------------------------------------------------------------------------
# Per-provider callers — each returns the raw text response or raises.
# SDK imports are deferred so a missing optional package only breaks the
# provider that needs it.
# ---------------------------------------------------------------------------
def _call_anthropic(system_prompt: str, user_prompt: str) -> str:
    from anthropic import Anthropic

    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    ).strip()


def _call_openai(system_prompt: str, user_prompt: str) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        max_tokens=MAX_TOKENS,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return (response.choices[0].message.content or "").strip()


def _call_gemini(system_prompt: str, user_prompt: str) -> str:
    import google.generativeai as genai

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(
        GEMINI_MODEL,
        system_instruction=system_prompt,
        generation_config={"response_mime_type": "application/json"},
    )
    response = model.generate_content(user_prompt)
    return (response.text or "").strip()


_PROVIDERS = [
    ("anthropic", _call_anthropic),
    ("openai", _call_openai),
    ("gemini", _call_gemini),
]


# ---------------------------------------------------------------------------
# JSON extraction — tolerant of fences and stray prose, same approach the
# demo proved out.
# ---------------------------------------------------------------------------
def extract_json(text: str) -> dict:
    """Best-effort extraction of a JSON object from a model response."""
    text = text.strip()

    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start : end + 1])

    raise ValueError("No valid JSON object found in response.")


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def run_analysis(system_prompt: str, user_prompt: str) -> tuple[dict, str]:
    """Run the CDI analysis through the provider chain.

    Returns (parsed_json, provider_name). Raises LLMError when no provider
    is configured or every configured provider fails.
    """
    configured = [(name, fn) for name, fn in _PROVIDERS if available_providers()[name]]
    if not configured:
        raise LLMError(
            "No LLM provider configured. Set at least one of ANTHROPIC_API_KEY, "
            "OPENAI_API_KEY, or GEMINI_API_KEY."
        )

    errors: list[str] = []
    for name, caller in configured:
        try:
            raw = caller(system_prompt, user_prompt)
            data = extract_json(raw)
            logger.info("analysis served by provider=%s", name)
            return data, name
        except Exception as exc:  # noqa: BLE001 — fall through to next provider
            logger.warning("provider %s failed: %s", name, exc)
            errors.append(f"{name}: {exc}")

    raise LLMError("All configured providers failed. " + "; ".join(errors))
