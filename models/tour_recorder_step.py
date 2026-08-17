# -*- coding: utf-8 -*-
from odoo import fields, models


class TourRecorderStep(models.Model):
    _name = "tour.recorder.step"
    _description = "Tour Recorder Step"
    _order = "sequence, id"

    tour_id = fields.Many2one("tour.recorder", string="Tour", required=True, ondelete="cascade")
    sequence = fields.Integer(string="Sequence", default=10)

    name = fields.Char(string="Step Title", translate=True)
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
    content = fields.Text(string="Content / Tooltip", translate=True)
    is_check = fields.Boolean(
        string="Check only",
        help="Only assert the element is visible, do not interact with it.",
    )

    validation_type = fields.Selection(
        [
            ("none", "No validation"),
            ("required", "Required (not empty)"),
            ("integer", "Whole number"),
            ("float", "Number (decimal)"),
            ("email", "Email"),
            ("phone", "Phone"),
            ("url", "URL"),
            ("date", "Date"),
            ("alpha", "Letters only"),
            ("alphanumeric", "Letters & numbers"),
            ("regex", "Custom (regex)"),
        ],
        string="Validation",
        default="none",
        required=True,
        help="Block the tour from advancing until the user's input matches this "
        "data type.",
    )
    validation_regex = fields.Char(
        string="Custom Regex",
        help="Regular expression the value must match (used when Validation = Custom).",
    )
    validation_message = fields.Char(
        string="Validation Message",
        translate=True,
        help="Optional error shown to the user when the value is invalid.",
    )
