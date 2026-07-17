# -*- coding: utf-8 -*-
import json
import logging

import requests

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)

# ── Provider selector ─────────────────────────────────────────────────────────
# tour_assistant.llm_provider  →  "anthropic" | "gemini" | "grok" | "mistral"  (default: anthropic)

# ── Anthropic parameters ──────────────────────────────────────────────────────
# tour_assistant.anthropic_api_key   — required when provider=anthropic
# tour_assistant.anthropic_model     — optional; falls back to DEFAULT below
# tour_assistant.anthropic_endpoint  — optional; falls back to DEFAULT below
DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5"
DEFAULT_ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"

# ── Gemini parameters ─────────────────────────────────────────────────────────
# tour_assistant.gemini_api_key   — required when provider=gemini
# tour_assistant.gemini_model     — optional; falls back to DEFAULT below
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_ENDPOINT_TPL = (
    "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent"
)

# ── Grok (xAI) parameters ─────────────────────────────────────────────────────
# tour_assistant.grok_api_key   — required when provider=grok
# tour_assistant.grok_model     — optional; falls back to DEFAULT below
# xAI exposes an OpenAI-compatible chat-completions endpoint.
DEFAULT_GROK_MODEL = "grok-3-mini"
DEFAULT_GROK_ENDPOINT = "https://api.x.ai/v1/chat/completions"

# ── Mistral parameters ────────────────────────────────────────────────────────
# tour_assistant.mistral_api_key   — required when provider=mistral
# tour_assistant.mistral_model     — optional; falls back to DEFAULT below
# Mistral also uses an OpenAI-compatible chat-completions endpoint.
DEFAULT_MISTRAL_MODEL = "ministral-3b-latest"
DEFAULT_MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions"

REQUEST_TIMEOUT = 30  # seconds – shared by all providers

# ── Shared system prompt ──────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are the in-app Tour Assistant for an Odoo 17 system.
You help users find and navigate guided tours.

You are given a JSON catalog of available tours and their steps. Answer the
user's question using ONLY that catalog. If a tour is relevant, point the user
to it and, when helpful, to a specific step.

Respond with STRICT JSON and nothing else, matching exactly this schema:
{"answer": "<plain-text answer for the user>",
 "action": {"tour": "<tour id>", "step": "<step id>"} }
Set "action" to null when no tour navigation is warranted.
Do not wrap the JSON in markdown fences. Do not add commentary."""


class TourChatController(http.Controller):

    @http.route(
        "/tour_assistant/ask",
        type="json",
        auth="user",
        methods=["POST"],
    )
    def ask(self, question=None, current_module=None, tours=None, **kwargs):
        """Answer a tour question via the configured LLM provider.

        Reads ``tour_assistant.llm_provider`` from system parameters and
        dispatches to the appropriate backend: anthropic, gemini, or grok.

        Params (JSON-RPC body):
            question (str): the user's question.
            current_module (str): module/menu the user is currently in.
            tours (list): the frontend tour catalog used as grounding context.
        """
        env = request.env
        icp = env["ir.config_parameter"].sudo()
        provider = (icp.get_param("tour_assistant.llm_provider") or "anthropic").lower()

        log_vals = {
            "user_id": env.user.id,
            "module": current_module,
            "question": question,
        }

        if provider == "gemini":
            return self._ask_gemini(env, icp, log_vals, question, current_module, tours)
        if provider == "grok":
            return self._ask_grok(env, icp, log_vals, question, current_module, tours)
        if provider == "mistral":
            return self._ask_mistral(env, icp, log_vals, question, current_module, tours)
        return self._ask_anthropic(env, icp, log_vals, question, current_module, tours)

    # ── Anthropic ─────────────────────────────────────────────────────────────

    def _ask_anthropic(self, env, icp, log_vals, question, current_module, tours):
        api_key = icp.get_param("tour_assistant.anthropic_api_key")
        model = icp.get_param("tour_assistant.anthropic_model") or DEFAULT_ANTHROPIC_MODEL
        endpoint = icp.get_param("tour_assistant.anthropic_endpoint") or DEFAULT_ANTHROPIC_ENDPOINT

        log_vals["model"] = model

        if not api_key:
            msg = (
                "The AI assistant is not configured yet. An administrator must "
                "set the 'tour_assistant.anthropic_api_key' system parameter."
            )
            self._log(env, dict(log_vals, success=False, error="missing api key", answer=msg))
            return {"answer": msg, "action": None}

        user_content = self._build_user_content(question, current_module, tours)
        payload = {
            "model": model,
            "max_tokens": 1024,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": user_content}],
        }
        headers = {
            "x-api-key": api_key,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        }

        try:
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as exc:
            _logger.exception("Tour Assistant (Anthropic): API call failed")
            msg = "Sorry, the assistant is temporarily unavailable."
            self._log(env, dict(log_vals, success=False, error=str(exc), answer=msg))
            return {"answer": msg, "action": None}

        usage = data.get("usage", {})
        log_vals["input_tokens"] = usage.get("input_tokens", 0)
        log_vals["output_tokens"] = usage.get("output_tokens", 0)

        text = "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )
        result = self._parse_model_json(text)
        self._log(env, dict(log_vals, success=True, answer=result["answer"]))
        return result

    # ── Gemini ────────────────────────────────────────────────────────────────

    def _ask_gemini(self, env, icp, log_vals, question, current_module, tours):
        api_key = icp.get_param("tour_assistant.gemini_api_key")
        model = icp.get_param("tour_assistant.gemini_model") or DEFAULT_GEMINI_MODEL

        log_vals["model"] = model

        if not api_key:
            msg = (
                "The AI assistant is not configured yet. An administrator must "
                "set the 'tour_assistant.gemini_api_key' system parameter."
            )
            self._log(env, dict(log_vals, success=False, error="missing api key", answer=msg))
            return {"answer": msg, "action": None}

        user_content = self._build_user_content(question, current_module, tours)
        endpoint = GEMINI_ENDPOINT_TPL % model
        payload = {
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [{"role": "user", "parts": [{"text": user_content}]}],
            "generationConfig": {"maxOutputTokens": 1024},
        }
        headers = {
            "x-goog-api-key": api_key,
            "content-type": "application/json",
        }

        try:
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as exc:
            _logger.exception("Tour Assistant (Gemini): API call failed")
            msg = "Sorry, the assistant is temporarily unavailable."
            self._log(env, dict(log_vals, success=False, error=str(exc), answer=msg))
            return {"answer": msg, "action": None}

        usage = data.get("usageMetadata", {})
        log_vals["input_tokens"] = usage.get("promptTokenCount", 0)
        log_vals["output_tokens"] = usage.get("candidatesTokenCount", 0)

        text = ""
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts)

        result = self._parse_model_json(text)
        self._log(env, dict(log_vals, success=True, answer=result["answer"]))
        return result

    # ── Grok (xAI) ───────────────────────────────────────────────────────────
    # xAI uses an OpenAI-compatible chat-completions endpoint.

    def _ask_grok(self, env, icp, log_vals, question, current_module, tours):
        api_key = icp.get_param("tour_assistant.grok_api_key")
        model = icp.get_param("tour_assistant.grok_model") or DEFAULT_GROK_MODEL
        endpoint = icp.get_param("tour_assistant.grok_endpoint") or DEFAULT_GROK_ENDPOINT

        log_vals["model"] = model

        if not api_key:
            msg = (
                "The AI assistant is not configured yet. An administrator must "
                "set the 'tour_assistant.grok_api_key' system parameter."
            )
            self._log(env, dict(log_vals, success=False, error="missing api key", answer=msg))
            return {"answer": msg, "action": None}

        user_content = self._build_user_content(question, current_module, tours)
        payload = {
            "model": model,
            "max_tokens": 1024,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        }
        headers = {
            "Authorization": "Bearer %s" % api_key,
            "content-type": "application/json",
        }

        try:
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as exc:
            _logger.exception("Tour Assistant (Grok): API call failed")
            msg = "Sorry, the assistant is temporarily unavailable."
            self._log(env, dict(log_vals, success=False, error=str(exc), answer=msg))
            return {"answer": msg, "action": None}

        usage = data.get("usage", {})
        log_vals["input_tokens"] = usage.get("prompt_tokens", 0)
        log_vals["output_tokens"] = usage.get("completion_tokens", 0)

        text = ""
        choices = data.get("choices", [])
        if choices:
            text = choices[0].get("message", {}).get("content", "")

        result = self._parse_model_json(text)
        self._log(env, dict(log_vals, success=True, answer=result["answer"]))
        return result

    # ── Mistral ───────────────────────────────────────────────────────────────
    # Mistral uses an OpenAI-compatible chat-completions endpoint.

    def _ask_mistral(self, env, icp, log_vals, question, current_module, tours):
        api_key = icp.get_param("tour_assistant.mistral_api_key")
        model = icp.get_param("tour_assistant.mistral_model") or DEFAULT_MISTRAL_MODEL
        endpoint = icp.get_param("tour_assistant.mistral_endpoint") or DEFAULT_MISTRAL_ENDPOINT

        log_vals["model"] = model

        if not api_key:
            msg = (
                "The AI assistant is not configured yet. An administrator must "
                "set the 'tour_assistant.mistral_api_key' system parameter."
            )
            self._log(env, dict(log_vals, success=False, error="missing api key", answer=msg))
            return {"answer": msg, "action": None}

        user_content = self._build_user_content(question, current_module, tours)
        payload = {
            "model": model,
            "max_tokens": 1024,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        }
        headers = {
            "Authorization": "Bearer %s" % api_key,
            "content-type": "application/json",
        }

        try:
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as exc:
            _logger.exception("Tour Assistant (Mistral): API call failed")
            msg = "Sorry, the assistant is temporarily unavailable."
            self._log(env, dict(log_vals, success=False, error=str(exc), answer=msg))
            return {"answer": msg, "action": None}

        usage = data.get("usage", {})
        log_vals["input_tokens"] = usage.get("prompt_tokens", 0)
        log_vals["output_tokens"] = usage.get("completion_tokens", 0)

        choices = data.get("choices", [])
        text = choices[0].get("message", {}).get("content", "") if choices else ""

        result = self._parse_model_json(text)
        self._log(env, dict(log_vals, success=True, answer=result["answer"]))
        return result

    # ── Shared helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _build_user_content(question, current_module, tours):
        catalog = json.dumps(tours or [], ensure_ascii=False)
        return (
            "Current module: %s\n\n"
            "Available tours (JSON catalog):\n%s\n\n"
            "User question: %s"
        ) % (current_module or "unknown", catalog, question or "")

    @staticmethod
    def _parse_model_json(text):
        """Parse the model's strict-JSON output, tolerating stray markdown fences."""
        cleaned = (text or "").strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
        try:
            parsed = json.loads(cleaned)
            answer = parsed.get("answer") or ""
            action = parsed.get("action")
            if not isinstance(action, dict):
                action = None
            return {"answer": answer, "action": action}
        except (ValueError, AttributeError):
            _logger.warning("Tour Assistant: model returned non-JSON output")
            return {"answer": text or "", "action": None}

    @staticmethod
    def _log(env, vals):
        try:
            env["tour.chat.log"].sudo().create(vals)
        except Exception:  # noqa: BLE001 – logging must never break the reply
            _logger.exception("Tour Assistant: failed to write chat log")
