"""
llm_orchestrator.py — Three-tier LLM strategy for the Speclyn engine.

Default provider order: Claude Opus 4.8 → OpenAI GPT-4o → Gemini 1.5 Pro.
The primary is selectable at launch — CLI flags (--claude / --openai /
--gemini on `python main.py`) or the LLM_PRIMARY env var — and the remaining
providers keep their default order as fallbacks. Never more than one provider
per request cycle: try in order, first success wins. A provider is only
attempted when its API key is configured, so the engine works with any
subset of keys present.
"""

import json
import logging
import os

logger = logging.getLogger("speclyn.llm")

ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
# gemini-1.5-pro was retired; 2.5-pro is the current stable. Env-overridable
# so a model bump never needs a code change again.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")
MAX_TOKENS = 4096
# Per-provider call timeout — a hanging provider must not stall the chain.
PROVIDER_TIMEOUT_SECONDS = 60


class LLMError(Exception):
    """Raised when every configured provider fails (or none are configured)."""


DEFAULT_ORDER = ["anthropic", "openai", "gemini"]

# Accepted spellings for provider selection (CLI flags / LLM_PRIMARY env var).
PROVIDER_ALIASES = {
    "claude": "anthropic",
    "anthropic": "anthropic",
    "openai": "openai",
    "gpt": "openai",
    "gemini": "gemini",
    "google": "gemini",
}


def resolve_provider_name(name: str) -> str | None:
    """Map a user-supplied provider spelling to its canonical name."""
    return PROVIDER_ALIASES.get((name or "").strip().lower())


def provider_order() -> list[str]:
    """Active provider chain: LLM_PRIMARY (if set) first, then the default
    order as fallbacks. Unknown LLM_PRIMARY values are ignored with the
    default order preserved."""
    order = DEFAULT_ORDER.copy()
    primary = resolve_provider_name(os.environ.get("LLM_PRIMARY", ""))
    if primary in order:
        order.remove(primary)
        order.insert(0, primary)
    return order


def _key_usable(env_var: str) -> bool:
    """A key is usable only if present AND clean printable ASCII.

    A key with a stray non-ASCII/whitespace character (a common copy-paste
    accident) produces 'Illegal header value' errors that some SDKs retry
    forever — observed hanging the chain for minutes. Treat such keys as
    not configured and say why, so the fallback engages immediately."""
    key = os.environ.get(env_var, "")
    if not key:
        return False
    if not all(32 < ord(c) < 127 for c in key):
        logger.warning(
            "%s contains whitespace or non-ASCII characters — ignoring it. "
            "Re-copy the key cleanly into your .env.", env_var,
        )
        return False
    return True


def available_providers() -> dict[str, bool]:
    """Which providers have usable API keys — used by /health."""
    return {
        "anthropic": _key_usable("ANTHROPIC_API_KEY"),
        "openai": _key_usable("OPENAI_API_KEY"),
        "gemini": _key_usable("GEMINI_API_KEY"),
    }


# ---------------------------------------------------------------------------
# Per-provider callers — each returns the raw text response or raises.
# SDK imports are deferred so a missing optional package only breaks the
# provider that needs it.
# ---------------------------------------------------------------------------
def _call_anthropic(system_prompt: str, user_prompt: str) -> str:
    from anthropic import Anthropic

    client = Anthropic(
        api_key=os.environ["ANTHROPIC_API_KEY"], timeout=PROVIDER_TIMEOUT_SECONDS
    )
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

    client = OpenAI(
        api_key=os.environ["OPENAI_API_KEY"], timeout=PROVIDER_TIMEOUT_SECONDS
    )
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
    # Uses the current google-genai SDK (the older google-generativeai
    # package is end-of-life and must not be used).
    from google import genai
    from google.genai import types

    client = genai.Client(
        api_key=os.environ["GEMINI_API_KEY"],
        http_options=types.HttpOptions(timeout=PROVIDER_TIMEOUT_SECONDS * 1000),
    )
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            max_output_tokens=MAX_TOKENS,
        ),
    )
    return (response.text or "").strip()


_CALLERS = {
    "anthropic": _call_anthropic,
    "openai": _call_openai,
    "gemini": _call_gemini,
}


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
    keys = available_providers()
    configured = [
        (name, _CALLERS[name]) for name in provider_order() if keys[name]
    ]
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
