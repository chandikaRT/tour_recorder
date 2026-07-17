# -*- coding: utf-8 -*-
from odoo import fields, models


class TourDefinition(models.Model):
    """Phase-2 stub: lets tours be authored from the backend instead of JS.

    Not wired into the sidebar yet — the frontend currently reads its tours
    from static/src/js/tour_registry.js. This model exists so we can later
    expose an endpoint that merges DB-defined tours with the JS registry.
    """

    _name = "tour.definition"
    _description = "Tour Definition"

    name = fields.Char(required=True)
    module = fields.Char(
        help="Technical name of the Odoo module/menu this tour belongs to.",
    )
    active = fields.Boolean(default=True)
    steps = fields.Json(
        help="Ordered list of step dicts: "
        "[{id, title, content, target}]. Mirrors the JS registry shape.",
    )
