"""Gemma Orchestrator — builds structured prompts from graph + risk context
and calls a Gemma-family model via the Emergent LLM key.

Interface stays identical if you later swap to a local Ollama Gemma:
just replace `_call_llm` with an Ollama HTTP call. The rest of the app
depends only on `generate(kind, ctx, language)`.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, Any, AsyncIterator
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from app.core.config import EMERGENT_LLM_KEY

# Gemma is not on the Emergent-hosted list; we use Gemini 3 Flash as the
# closest hosted equivalent. Swap this to Ollama Gemma for on-prem use.
_MODEL_PROVIDER = "gemini"
_MODEL_NAME = "gemini-3-flash-preview"

_LANG_NAMES = {"en": "English", "hi": "Hindi", "ta": "Tamil"}

_KIND_PROMPTS = {
    "summary": (
        "Write a concise executive summary (max 6 sentences) explaining "
        "why this account chain is risky. Use precise, investigator-grade language. "
        "Never fabricate facts beyond the provided context."
    ),
    "report": (
        "Draft a full investigation report with the following sections: "
        "1) Overview, 2) Chain of funds, 3) Risk signals, 4) Recommendation. "
        "Keep it under 350 words. Investigator-grade tone."
    ),
    "freeze_justification": (
        "Draft a legal freeze justification. IMPORTANT: begin the output with the exact "
        'line "DRAFT — for human review, not a legal determination." Then, in 4-6 sentences, '
        "state the statutory basis (e.g. Reg E elder fraud, 314(b) safe harbor), the specific "
        "signals justifying the freeze, and the recommended freeze scope."
    ),
    "next_steps": (
        "List 5 concrete next investigation steps for an analyst, as a short "
        "numbered list. Each step should be a single actionable line."
    ),
}


def _build_prompt(ctx: Dict[str, Any], language: str) -> str:
    lang_name = _LANG_NAMES.get(language, "English")
    factors = "\n".join(f"- {f['label']} (+{f['points']}): {f['meta']}" for f in ctx.get("factors", []))
    chain = " → ".join(n["label"] for n in ctx.get("chain", []))
    return (
        f"Language: respond in {lang_name}.\n\n"
        f"Case: {ctx.get('subject','(no subject)')}\n"
        f"Case ID: {ctx.get('case_id','')}\n"
        f"Channel: {ctx.get('channel','')}\n"
        f"Route: {ctx.get('country','')}\n"
        f"Exposure: {ctx.get('currency','USD')} {ctx.get('amount',0):,.2f}\n"
        f"Total risk score: {ctx.get('risk_score',0)}/100 ({ctx.get('risk','safe')})\n\n"
        f"Chain: {chain or '(no chain)'}\n\n"
        f"Signals:\n{factors or '(none)'}\n\n"
        f"Transactions analyzed: {ctx.get('tx_count', 0)}\n"
    )


async def _call_llm(system: str, user_text: str, session_id: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model(_MODEL_PROVIDER, _MODEL_NAME)
    resp = await chat.send_message(UserMessage(text=user_text))
    return resp if isinstance(resp, str) else str(resp)


async def _stream_llm(system: str, user_text: str, session_id: str) -> AsyncIterator[str]:
    """Yields token deltas. Swap this for Ollama's /api/generate with stream=true
    to run against a local Gemma model — no other caller needs to change."""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model(_MODEL_PROVIDER, _MODEL_NAME)
    async for ev in chat.stream_message(UserMessage(text=user_text)):
        if isinstance(ev, TextDelta):
            yield ev.content
        elif isinstance(ev, StreamDone):
            break


async def generate(kind: str, ctx: Dict[str, Any], language: str = "en") -> Dict[str, Any]:
    """Public interface. `kind` must be one of _KIND_PROMPTS keys."""
    if kind not in _KIND_PROMPTS:
        raise ValueError(f"unknown copilot kind: {kind}")
    system = _SYSTEM
    user_text = _KIND_PROMPTS[kind] + "\n\n" + _build_prompt(ctx, language)
    session_id = f"case-{ctx.get('case_id','x')}-{kind}-{language}"
    text = await _call_llm(system, user_text, session_id)
    return {
        "kind": kind,
        "language": language,
        "text": text.strip(),
        "generated_at": datetime.now(timezone.utc),
    }


async def generate_stream(kind: str, ctx: Dict[str, Any], language: str = "en") -> AsyncIterator[str]:
    """Stream token deltas for a copilot response."""
    if kind not in _KIND_PROMPTS:
        raise ValueError(f"unknown copilot kind: {kind}")
    user_text = _KIND_PROMPTS[kind] + "\n\n" + _build_prompt(ctx, language)
    session_id = f"case-{ctx.get('case_id','x')}-{kind}-{language}"
    async for chunk in _stream_llm(_SYSTEM, user_text, session_id):
        yield chunk


_SYSTEM = (
    "You are TR-Cortex, an AI fraud-investigation assistant for financial "
    "crime investigators. Be precise, cite provided evidence, never invent "
    "facts. All output is a DRAFT for human review."
)
