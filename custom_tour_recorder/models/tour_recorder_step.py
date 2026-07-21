# -*- coding: utf-8 -*-
from odoo import fields, models


class TourRecorderStep(models.Model):
    _name = "tour.recorder.step"
    _description = "Tour Recorder Step"
    _order = "sequence, id"

    tour_id = fields.Many2one("tour.recorder", string="Tour", required=True, ondelete="cascade")
    sequence = fields.Integer(string="Sequence", default=10)

    name = fields.Char(string="Step Title")
    css_selector = fields.Char(string="CSS Trigger Selector", required=True)
    position = fields.Selection(
        [
            ("top", "Top"),
            ("bottom", "Bottom"),
            ("left", "Left"),
            ("right", "Right"),
        ],
        string="Tooltip Position",
        default="bottom",
    )
    run = fields.Char(
        string="Action (run)",
        default="click",
        help='Tour action to run, e.g. "click" or "edit some text".',
    )
    content = fields.Text(string="Content / Tooltip")
    is_check = fields.Boolean(
        string="Check only",
        help="Only assert the element is visible, do not interact with it.",
    )
