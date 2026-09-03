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

    # --- Challenge mode (comprehension check) ---
    # Recorded when the user replays the tour from memory with hints hidden.
    best_score = fields.Float(string="Best Score (%)", default=0.0)
    last_score = fields.Float(string="Last Score (%)", default=0.0)
    challenge_attempts = fields.Integer(string="Challenge Attempts", default=0)
    verified = fields.Boolean(
        string="Verified",
        default=False,
        help="Set once the user passes the challenge (score >= threshold), "
        "confirming they can perform the flow unaided.",
    )
    verified_date = fields.Datetime(string="Verified On")

    _sql_constraints = [
        (
            "unique_tour_user",
            "unique(tour_id, user_id)",
            "A progress record already exists for this user and tour.",
        ),
    ]
