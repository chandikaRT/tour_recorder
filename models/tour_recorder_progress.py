# -*- coding: utf-8 -*-
from odoo import fields, models


class TourRecorderProgress(models.Model):
    _name = "tour.recorder.progress"
    _description = "Tour Recorder User Progress"
    _order = "last_update desc, id desc"

    tour_id = fields.Many2one(
        "tour.recorder", string="Tour", required=True, ondelete="cascade", index=True
    )
    user_id = fields.Many2one(
        "res.users", string="User", required=True, ondelete="cascade", index=True
    )
    steps_completed = fields.Integer(string="Steps Completed", default=0)
    total = fields.Integer(string="Total", related="tour_id.step_count", store=True)
    status = fields.Selection(
        [
            ("not_started", "Not Started"),
            ("in_progress", "In Progress"),
            ("completed", "Completed"),
        ],
        string="Status",
        default="not_started",
        required=True,
    )
    last_update = fields.Datetime(string="Last Update")

    _sql_constraints = [
        (
            "unique_tour_user",
            "unique(tour_id, user_id)",
            "A progress record already exists for this user and tour.",
        ),
    ]
