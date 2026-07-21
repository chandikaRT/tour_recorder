# -*- coding: utf-8 -*-
import base64
import json

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class TourRecorder(models.Model):
    _name = "tour.recorder"
    _description = "Interactive Tour / Guide"
    _inherit = ["mail.thread"]
    _order = "name"

    name = fields.Char(string="Tour Name", required=True, tracking=True)
    description = fields.Text(string="Description")
    active = fields.Boolean(default=True)

    user_ids = fields.Many2many(
        "res.users",
        "tour_recorder_users_rel",
        "tour_id",
        "user_id",
        string="Assigned Users",
        help="Only the assigned users will see this guide in their 'Guides' list.",
    )
    step_ids = fields.One2many("tour.recorder.step", "tour_id", string="Steps", copy=True)
    progress_ids = fields.One2many("tour.recorder.progress", "tour_id", string="User Progress")

    step_count = fields.Integer(string="Step Count", compute="_compute_step_count", store=True)
    tour_key = fields.Char(string="Tour Key", compute="_compute_tour_key")

    @api.depends("step_ids")
    def _compute_step_count(self):
        for rec in self:
            rec.step_count = len(rec.step_ids)

    @api.depends("id")
    def _compute_tour_key(self):
        for rec in self:
            rec.tour_key = "custom_tour_recorder_%s" % rec.id if rec.id else False

    # ------------------------------------------------------------------
    # ORM overrides: keep creator assigned and progress rows in sync
    # ------------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for rec in records:
            if self.env.uid not in rec.user_ids.ids:
                rec.user_ids = [(4, self.env.uid)]
            rec._sync_progress()
        return records

    def write(self, vals):
        res = super().write(vals)
        if "user_ids" in vals:
            for rec in self:
                rec._sync_progress()
        return res

    def _sync_progress(self):
        """Ensure every assigned user has a progress row (Not Started)."""
        Progress = self.env["tour.recorder.progress"].sudo()
        for rec in self:
            existing = rec.progress_ids.mapped("user_id")
            missing = rec.user_ids - existing
            for user in missing:
                Progress.create({"tour_id": rec.id, "user_id": user.id})

    # ------------------------------------------------------------------
    # Serialisation helpers used by the front-end
    # ------------------------------------------------------------------
    def _serialize_steps(self):
        self.ensure_one()
        steps = []
        for step in self.step_ids.sorted(lambda s: (s.sequence, s.id)):
            steps.append(
                {
                    "id": step.id,
                    "title": step.name or "",
                    "trigger": step.css_selector or "",
                    "content": step.content or "",
                    "position": step.position or "bottom",
                    "run": step.run or "click",
                    "is_check": step.is_check,
                }
            )
        return steps

    def _tour_payload(self):
        self.ensure_one()
        return {
            "id": self.id,
            "tour_key": self.tour_key,
            "name": self.name,
            "description": self.description or "",
            "step_count": self.step_count,
            "steps": self._serialize_steps(),
        }

    # ------------------------------------------------------------------
    # Public RPC methods (called from JS via orm.call)
    # ------------------------------------------------------------------
    @api.model
    def get_my_tours(self):
        """Tours visible in the systray 'Guides' dialog.

        Managers see every tour so they can manage them; regular users only
        see the guides that have been assigned to them.
        """
        if self.env.user.has_group("custom_tour_recorder.group_tour_manager"):
            tours = self.search([])
        else:
            tours = self.search([("user_ids", "in", self.env.uid)])
        return [tour._tour_payload() for tour in tours]

    @api.model
    def get_tour_for_play(self, tour_id):
        tour = self.browse(tour_id)
        tour.check_access_rights("read")
        tour.check_access_rule("read")
        return tour._tour_payload()

    @api.model
    def create_from_recording(self, name, description, steps):
        """Persist a freshly recorded tour (called by the Save Tour dialog)."""
        commands = []
        for index, step in enumerate(steps or []):
            commands.append(
                (
                    0,
                    0,
                    {
                        "sequence": (index + 1) * 10,
                        "name": step.get("title") or "",
                        "css_selector": step.get("trigger") or "",
                        "content": step.get("content") or "",
                        "position": step.get("position") or "bottom",
                        "run": step.get("run") or "click",
                        "is_check": bool(step.get("is_check")),
                    },
                )
            )
        tour = self.create(
            {
                "name": name or "Untitled Tour",
                "description": description or "",
                "step_ids": commands,
            }
        )
        return tour.id

    def save_steps(self, steps):
        """Replace all steps of the tour (called by the Edit Steps dialog)."""
        self.ensure_one()
        commands = [(5, 0, 0)]
        for index, step in enumerate(steps or []):
            commands.append(
                (
                    0,
                    0,
                    {
                        "sequence": (index + 1) * 10,
                        "name": step.get("title") or "",
                        "css_selector": step.get("trigger") or "",
                        "content": step.get("content") or "",
                        "position": step.get("position") or "bottom",
                        "run": step.get("run") or "click",
                        "is_check": bool(step.get("is_check")),
                    },
                )
            )
        self.write({"step_ids": commands})
        return True

    @api.model
    def set_progress(self, tour_id, steps_completed, status):
        """Upsert the current user's progress for a tour (called during playback)."""
        Progress = self.env["tour.recorder.progress"]
        progress = Progress.search(
            [("tour_id", "=", tour_id), ("user_id", "=", self.env.uid)], limit=1
        )
        vals = {
            "steps_completed": steps_completed,
            "status": status,
            "last_update": fields.Datetime.now(),
        }
        if progress:
            progress.write(vals)
        else:
            vals.update({"tour_id": tour_id, "user_id": self.env.uid})
            Progress.create(vals)
        return True

    # ------------------------------------------------------------------
    # Import / Export
    # ------------------------------------------------------------------
    def _export_json(self):
        """Serialize the current tours to a base64-encoded JSON payload."""
        payload = {"version": 1, "tours": []}
        for tour in self:
            payload["tours"].append(
                {
                    "name": tour.name,
                    "description": tour.description or "",
                    "steps": [
                        {
                            "sequence": step.sequence,
                            "title": step.name or "",
                            "trigger": step.css_selector or "",
                            "content": step.content or "",
                            "position": step.position or "bottom",
                            "run": step.run or "click",
                            "is_check": step.is_check,
                        }
                        for step in tour.step_ids.sorted(lambda s: (s.sequence, s.id))
                    ],
                }
            )
        raw = json.dumps(payload, indent=2).encode("utf-8")
        return base64.b64encode(raw)

    @api.model
    def _import_json(self, b64data):
        """Create tours from a base64-encoded JSON export. Returns created ids."""
        if not b64data:
            raise UserError(_("Please select a file to import."))
        try:
            raw = base64.b64decode(b64data)
            payload = json.loads(raw.decode("utf-8"))
        except Exception as exc:
            raise UserError(_("The uploaded file is not a valid tour export:\n%s") % exc)

        tours = payload.get("tours") if isinstance(payload, dict) else None
        if not isinstance(tours, list) or not tours:
            raise UserError(_("The file does not contain any tours."))

        created = self.browse()
        for tour in tours:
            if not isinstance(tour, dict):
                continue
            new_id = self.create_from_recording(
                tour.get("name") or _("Imported Tour"),
                tour.get("description") or "",
                tour.get("steps") or [],
            )
            created |= self.browse(new_id)
        return created.ids

    # ------------------------------------------------------------------
    # UI actions
    # ------------------------------------------------------------------
    def action_open_steps(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": self.name,
            "res_model": "tour.recorder.step",
            "view_mode": "tree,form",
            "domain": [("tour_id", "=", self.id)],
            "context": {"default_tour_id": self.id},
        }
