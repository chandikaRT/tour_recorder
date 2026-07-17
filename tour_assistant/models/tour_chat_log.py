# -*- coding: utf-8 -*-
from odoo import fields, models


class TourChatLog(models.Model):
    """One row per AI chat call, for per-user cost visibility."""

    _name = "tour.chat.log"
    _description = "Tour Assistant Chat Log"
    _order = "create_date desc"

    user_id = fields.Many2one(
        "res.users",
        string="User",
        required=True,
        ondelete="cascade",
        default=lambda self: self.env.user,
        index=True,
    )
    module = fields.Char(string="Current Module")
    question = fields.Text()
    answer = fields.Text()
    model = fields.Char(string="LLM Model")
    input_tokens = fields.Integer()
    output_tokens = fields.Integer()
    success = fields.Boolean(default=True)
    error = fields.Text()
