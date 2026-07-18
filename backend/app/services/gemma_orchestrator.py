"""Local Ollama/Gemma integration for investigator-facing draft narratives."""
from __future__ import annotations

import asyncio
import json
import socket
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import OLLAMA_BASE_URL, OLLAMA_MODEL

_LANG_NAMES = {"en": "English", "hi": "Hindi", "ta": "Tamil", "kn": "Kannada"}
_KIND_PROMPTS = {
    "summary": "Write a concise executive summary (maximum six sentences) explaining the evidenced risk signals.",
    "report": "Draft a concise investigation report with Overview, Chain of funds, Risk signals, and Recommendation.",
    "freeze_justification": "Draft a freeze-review justification using only the provided evidence. Do not claim a legal conclusion.",
    "next_steps": "List five concrete, evidence-led next steps for an investigator.",
}
_SYSTEM = (
    "You are TraceRoot's local Gemma assistant for financial-crime investigators. "
    "Use only supplied evidence; do not invent facts or legal authority. Every output is a DRAFT "
    "requiring investigator and applicable legal/policy review. Never present a model output as an automatic decision."
)


class OllamaUnavailable(RuntimeError):
    """Raised only when the local Ollama service cannot be reached."""


def _build_prompt(ctx: Dict[str, Any], language: str) -> str:
    factors = "\n".join(f"- {f['label']} (+{f['points']}): {f['meta']}" for f in ctx.get("factors", []))
    chain = " -> ".join(n["label"] for n in ctx.get("chain", []))
    return (
        f"Respond in {_LANG_NAMES.get(language, 'English')}.\n"
        f"Case: {ctx.get('subject', '(no subject)')} ({ctx.get('case_id', '')})\n"
        f"Channel/route: {ctx.get('channel', '')} / {ctx.get('country', '')}\n"
        f"Exposure: {ctx.get('currency', 'USD')} {ctx.get('amount', 0):,.2f}\n"
        f"Case risk score: {ctx.get('risk_score', 0)}/100 ({ctx.get('risk', 'safe')})\n"
        f"Chain: {chain or '(no chain)'}\nSignals:\n{factors or '- none'}\n"
        f"Transactions analyzed: {ctx.get('tx_count', 0)}\n"
    )


def _request(payload: dict, stream: bool = False):
    request = Request(
        f"{OLLAMA_BASE_URL}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        return urlopen(request, timeout=60)
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        raise RuntimeError(f"Ollama returned HTTP {exc.code}: {detail}") from exc
    except (URLError, socket.timeout, TimeoutError, ConnectionError, OSError) as exc:
        raise OllamaUnavailable(
            f"Local Ollama is unavailable at {OLLAMA_BASE_URL}. Start Ollama and confirm model '{OLLAMA_MODEL}' is installed."
        ) from exc


def _payload(system: str, user_text: str, stream: bool) -> dict:
    return {"model": OLLAMA_MODEL, "system": system, "prompt": user_text, "stream": stream,
            "options": {"temperature": 0.2}}


async def _call_llm(system: str, user_text: str) -> str:
    response = await asyncio.to_thread(_request, _payload(system, user_text, False))
    try:
        raw = await asyncio.to_thread(response.read)
    finally:
        response.close()
    try:
        body = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError("Ollama returned an invalid response.") from exc
    text = body.get("response")
    if not isinstance(text, str):
        raise RuntimeError("Ollama response did not contain generated text.")
    return text


async def _stream_llm(system: str, user_text: str) -> AsyncIterator[str]:
    response = await asyncio.to_thread(_request, _payload(system, user_text, True))
    try:
        while True:
            line = await asyncio.to_thread(response.readline)
            if not line:
                break
            try:
                event = json.loads(line.decode("utf-8"))
            except json.JSONDecodeError:
                continue
            if event.get("error"):
                raise RuntimeError(f"Ollama generation error: {event['error']}")
            if event.get("response"):
                yield str(event["response"])
            if event.get("done"):
                break
    finally:
        response.close()


async def generate(kind: str, ctx: Dict[str, Any], language: str = "en") -> Dict[str, Any]:
    if kind not in _KIND_PROMPTS:
        raise ValueError(f"unknown copilot kind: {kind}")
    prompt = _KIND_PROMPTS[kind] + "\n\n" + _build_prompt(ctx, language)
    try:
        text = await _call_llm(_SYSTEM, prompt)
    except OllamaUnavailable:
        text = _fallback_text(kind, ctx, language)
    return {"kind": kind, "language": language, "text": text.strip(), "generated_at": datetime.now(timezone.utc)}


async def generate_stream(kind: str, ctx: Dict[str, Any], language: str = "en") -> AsyncIterator[str]:
    if kind not in _KIND_PROMPTS:
        raise ValueError(f"unknown copilot kind: {kind}")
    prompt = _KIND_PROMPTS[kind] + "\n\n" + _build_prompt(ctx, language)
    try:
        async for chunk in _stream_llm(_SYSTEM, prompt):
            yield chunk
    except OllamaUnavailable:
        yield _fallback_text(kind, ctx, language)


async def assess_account(ctx: Dict[str, Any], language: str = "en") -> Dict[str, Any]:
    """Return an explainable deterministic score plus a Gemma draft explanation."""
    evidence = ctx["evidence"]
    prompt = (
        "Assess this selected account using the deterministic score and evidence below. "
        "Explain the evidence in 3-5 concise sentences. State that the score is an advisory signal, "
        "not an automatic freeze decision.\n\n"
        f"Respond in {_LANG_NAMES.get(language, 'English')}.\n"
        f"Account: {ctx['account_id']}\nDeterministic score: {ctx['score']}/100 ({ctx['risk']})\n"
        f"Account transaction history: {json.dumps(ctx['transactions'], ensure_ascii=False)}\n"
        f"Connected graph evidence: {json.dumps(ctx['connections'], ensure_ascii=False)}\n"
        "Evidence:\n- " + "\n- ".join(evidence)
    )
    source = "ollama"
    try:
        explanation = await _call_llm(_SYSTEM, prompt)
    except OllamaUnavailable:
        source = "local_fallback"
        explanation = _account_fallback(ctx)
    return {**ctx, "explanation": explanation.strip(), "source": source,
            "generated_at": datetime.now(timezone.utc)}


def _fallback_text(kind: str, ctx: Dict[str, Any], language: str) -> str:
    signals = "; ".join(f"{f['label']} (+{f['points']})" for f in ctx.get("factors", [])) or "no rules fired"
    return (
        f"DRAFT — local advisory fallback ({_LANG_NAMES.get(language, 'English')}). "
        f"Case risk is {ctx.get('risk_score', 0)}/100 based on {signals}. "
        "An investigator must verify underlying transactions and obtain applicable legal/policy review before action."
    )


def _account_fallback(ctx: Dict[str, Any]) -> str:
    return (
        "DRAFT — local advisory fallback. " + " ".join(ctx["evidence"]) + " "
        "This score is an evidence-led review signal, not an automatic freeze decision; investigator and applicable legal/policy review are required."
    )
