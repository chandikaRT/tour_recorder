# -*- coding: utf-8 -*-
import json
import logging

import requests

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)

# System parameters (set per-branch/per-database via Settings > Technical >
# System Parameters, or the Odoo.sh shell). Never hardcode the key.
PARAM_API_KEY = "tour_assistant.anthropic_api_key"
PARAM_MODEL = "tour_assistant.anthropic_model"
PARAM_ENDPOINT = "tour_assistant.anthropic_endpoint"

DEFAULT_MODEL = "claude-haiku-4-5-20251001"
DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
REQUEST_TIMEOUT = 30  # seconds

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
        """Answer a tour question via the Anthropic API.

        Params (JSON-RPC body):
            question (str): the user's question.
            current_module (str): module/menu the user is currently in.
            tours (list): the frontend tour catalog (step definitions) used
                as grounding context for the model.
        """
        env = request.env
        icp = env["ir.config_parameter"].sudo()
        api_key = icp.get_param(PARAM_API_KEY)
        model = icp.get_param(PARAM_MODEL) or DEFAULT_MODEL
        endpoint = icp.get_param(PARAM_ENDPOINT) or DEFAULT_ENDPOINT

        log_vals = {
            "user_id": env.user.id,
            "module": current_module,
            "question": question,
            "model": model,
        }

        if not api_key:
            msg = (
                "The AI assistant is not configured yet. An administrator must "
                "set the '%s' system parameter." % PARAM_API_KEY
            )
            self._log(env, dict(log_vals, success=False, error="missing api key",
                                 answer=msg))
            return {"answer": msg, "action": None}

        catalog = json.dumps(tours or [], ensure_ascii=False)
        user_content = (
            "Current module: %s\n\n"
            "Available tours (JSON catalog):\n%s\n\n"
            "User question: %s"
        ) % (current_module or "unknown", catalog, question or "")

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
            resp = requests.post(
                endpoint, headers=headers, json=payload, timeout=REQUEST_TIMEOUT
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as exc:
            _logger.exception("Tour Assistant: Anthropic API call failed")
            msg = "Sorry, the assistant is temporarily unavailable."
            self._log(env, dict(log_vals, success=False, error=str(exc),
                                 answer=msg))
            return {"answer": msg, "action": None}

        # Extract usage + text.
        usage = data.get("usage", {})
        log_vals["input_tokens"] = usage.get("input_tokens", 0)
        log_vals["output_tokens"] = usage.get("output_tokens", 0)

        text = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                text += block.get("text", "")

        result = self._parse_model_json(text)
        self._log(env, dict(log_vals, success=True, answer=result["answer"]))
        return result

    @staticmethod
    def _parse_model_json(text):
        """Parse the model's strict-JSON output, tolerating stray fences."""
        cleaned = (text or "").strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            # drop an optional leading "json" language tag
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
        except Exception:  # noqa: BLE001 - logging must never break the reply
            _logger.exception("Tour Assistant: failed to write chat log")
