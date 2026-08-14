# -*- coding: utf-8 -*-
import logging

_logger = logging.getLogger(__name__)

# Languages the tour recorder ships translations for.
# Each entry: (code, iso_code, url_code, name, direction)
TOUR_LANGS = [
    ("si_LK", "si", "si_LK", "Sinhala / සිංහල", "ltr"),
    ("ta_IN", "ta", "ta_IN", "Tamil / தமிழ்",   "ltr"),
]


def pre_init_hook(env):
    """
    Deactivate stale Odoo Studio customisations on res.users.form that
    reference a sel_groups_* field which no longer exists on this database.

    Background: Odoo auto-generates a combined selection field on res.users
    whose name encodes the DB IDs of all groups in a given category, e.g.
    sel_groups_146_147_225_226_234.  If any module is installed or removed
    since a Studio customisation was saved, those IDs change and the XPath
    in the Studio view becomes invalid.

    When our module creates its res.groups records, Odoo calls
    _update_user_groups_view() which validates ALL child views of
    res.users.form — exposing the stale XPath as a ParseError that blocks
    installation.  Running this hook first avoids the crash.
    """
    import re
    cr = env.cr

    # Find all active views on res.users that mention a sel_groups_ field.
    cr.execute("""
        SELECT id, arch_db
        FROM ir_ui_view
        WHERE active = TRUE
          AND model = 'res.users'
          AND arch_db::text LIKE '%%sel_groups_%%'
    """)
    views = cr.fetchall()
    if not views:
        return

    # Collect sel_groups_* field names that actually exist right now.
    cr.execute("""
        SELECT name FROM ir_model_fields
        WHERE model = 'res.users' AND name LIKE 'sel_groups_%%'
    """)
    existing = {r[0] for r in cr.fetchall()}

    stale_ids = []
    for view_id, arch in views:
        referenced = set(re.findall(r'sel_groups_[\d_]+', arch or ''))
        missing = referenced - existing
        if missing:
            stale_ids.append(view_id)
            _logger.warning(
                "custom_tour_recorder pre_init: deactivating ir.ui.view(%s) "
                "— references non-existent field(s): %s",
                view_id, missing,
            )

    if stale_ids:
        cr.execute(
            "UPDATE ir_ui_view SET active = FALSE WHERE id = ANY(%s)",
            [stale_ids],
        )
        _logger.info(
            "custom_tour_recorder pre_init: deactivated %d stale "
            "res.users view(s) before group creation.",
            len(stale_ids),
        )


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
