# -*- coding: utf-8 -*-
import logging

_logger = logging.getLogger(__name__)

# Languages the tour recorder ships translations for.
TOUR_LANGS = ["si_LK", "ta_IN"]


def post_init_hook(env):
    """Activate Sinhala and Tamil so tour content can be translated into them."""
    for code in TOUR_LANGS:
        try:
            env["res.lang"]._activate_lang(code)
        except Exception as exc:  # pragma: no cover - non fatal
            _logger.warning("custom_tour_recorder: could not activate %s: %s", code, exc)
