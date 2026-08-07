# -*- coding: utf-8 -*-
import logging

_logger = logging.getLogger(__name__)

# Languages the tour recorder ships translations for.
# Each entry: (code, iso_code, url_code, name, direction)
TOUR_LANGS = [
    ("si_LK", "si", "si_LK", "Sinhala / සිංහල", "ltr"),
    ("ta_IN", "ta", "ta_IN", "Tamil / தமிழ்",   "ltr"),
]


def post_init_hook(env):
    """Activate Sinhala and Tamil so tour content can be translated into them.

    Odoo's built-in _activate_lang / load_lang only work for languages that are
    already in Odoo's internal language registry (a fixed list shipped with the
    core). Sinhala (si_LK) and Tamil/India (ta_IN) are not in that list, so we
    create / activate the res.lang records directly instead.
    """
    # Copy format settings from English as a sensible default.
    en = env["res.lang"].search([("code", "=", "en_US")], limit=1)
    defaults = {
        "date_format":    en.date_format    if en else "%m/%d/%Y",
        "time_format":    en.time_format    if en else "%H:%M:%S",
        "week_start":     en.week_start     if en else "1",
        "grouping":       en.grouping       if en else "[]",
        "decimal_point":  en.decimal_point  if en else ".",
        "thousands_sep":  en.thousands_sep  if en else ",",
    }

    Lang = env["res.lang"].with_context(active_test=False)
    for code, iso_code, url_code, name, direction in TOUR_LANGS:
        existing = Lang.search([("code", "=", code)], limit=1)
        if existing:
            if not existing.active:
                existing.write({"active": True})
                _logger.info("custom_tour_recorder: activated language %s", code)
            else:
                _logger.info("custom_tour_recorder: language %s already active", code)
        else:
            Lang.create({
                "code":          code,
                "iso_code":      iso_code,
                "url_code":      url_code,
                "name":          name,
                "direction":     direction,
                "active":        True,
                **defaults,
            })
            _logger.info("custom_tour_recorder: created and activated language %s", code)
