# -*- coding: utf-8 -*-
import base64
import json

from odoo import _, api, fields, models
from odoo.exceptions import UserError
from odoo.tools.safe_eval import safe_eval


class TourRecorder(models.Model):
    _name = "tour.recorder"
    _description = "Interactive Tour / Guide"
    _inherit = ["mail.thread"]
    _order = "name"

    name = fields.Char(string="Tour Name", required=True, tracking=True, translate=True)
    description = fields.Text(string="Description", translate=True)
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

    # ------------------------------------------------------------------
    # Workflow context binding
    # A guide can be attached to a document model + a stage condition + a role,
    # so the right guide can be surfaced to the right user on the right record
    # (e.g. the "Log the repair" guide shows to a technician only while the
    # repair order sits in the "Under Repair" stage). All optional: a guide
    # with no model set behaves exactly as before (a free-standing guide).
    # ------------------------------------------------------------------
    model_id = fields.Many2one(
        "ir.model",
        string="Applies To",
        ondelete="cascade",
        help="Bind this guide to a document model (e.g. Repair Order). When set, "
        "the guide can be offered contextually on records of this model.",
    )
    res_model = fields.Char(
        string="Model Name", related="model_id.model", store=True, index=True
    )
    group_id = fields.Many2one(
        "res.groups",
        string="For Role",
        help="Only members of this role are offered the guide contextually. "
        "Leave empty to offer it to any assigned user.",
    )
    trigger_domain = fields.Char(
        string="Trigger Condition",
        default="[]",
        help="Domain evaluated against the record to decide when this guide "
        "applies (e.g. the record's stage). Empty means: any record of the model.",
    )

    @api.depends("step_ids")
    def _compute_step_count(self):
        for rec in self:
            rec.step_count = len(rec.step_ids)

    @api.depends()
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
                    "validation_type": step.validation_type or "none",
                    "validation_regex": step.validation_regex or "",
                    "validation_message": step.validation_message or "",
                }
            )
        return steps

    @api.model
    def _step_vals_from_payload(self, step, index):
        """Map a front-end / import step dict to `tour.recorder.step` values."""
        return {
            "sequence": (index + 1) * 10,
            "name": step.get("title") or "",
            "css_selector": step.get("trigger") or "",
            "content": step.get("content") or "",
            "position": step.get("position") or "bottom",
            "run": step.get("run") or "click",
            "is_check": bool(step.get("is_check")),
            "validation_type": step.get("validation_type") or "none",
            "validation_regex": step.get("validation_regex") or "",
            "validation_message": step.get("validation_message") or "",
        }

    def _tour_payload(self):
        self.ensure_one()
        return {
            "id": self.id,
            "tour_key": self.tour_key,
            "name": self.name,
            "description": self.description or "",
            "step_count": self.step_count,
            "res_model": self.res_model or "",
            "group_id": self.group_id.id or False,
            "group_name": self.group_id.display_name or "",
            "steps": self._serialize_steps(),
        }

    # ------------------------------------------------------------------
    # Public RPC methods (called from JS via orm.call)
    # ------------------------------------------------------------------
    @api.model
    def get_incomplete_tour_count(self):
        """Count of assigned tours not yet completed by the current user."""
        if self.env.user.has_group("custom_tour_recorder.group_tour_manager"):
            tours = self.search([])
        else:
            tours = self.search([("user_ids", "in", self.env.uid)])
        if not tours:
            return 0
        completed_ids = self.env["tour.recorder.progress"].search([
            ("tour_id", "in", tours.ids),
            ("user_id", "=", self.env.uid),
            ("status", "=", "completed"),
        ]).mapped("tour_id").ids
        return len(tours) - len(set(completed_ids) & set(tours.ids))

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

    def _parse_trigger_domain(self):
        """Return this guide's trigger_domain as a domain list (safe)."""
        self.ensure_one()
        raw = (self.trigger_domain or "").strip()
        if not raw or raw == "[]":
            return []
        try:
            domain = safe_eval(raw, {"uid": self.env.uid})
        except Exception:
            return []
        return domain if isinstance(domain, list) else []

    def _is_eligible_for(self, user):
        """Whether ``user`` should be offered this guide contextually."""
        self.ensure_one()
        if user.has_group("custom_tour_recorder.group_tour_manager"):
            return True
        if self.group_id:
            return user in self.group_id.users
        # No role restriction → fall back to the explicit assignment list.
        return user in self.user_ids

    @api.model
    def get_guides_for(self, res_model, res_id):
        """Guides that apply to a specific record for the current user.

        A guide matches when it is bound to ``res_model``, the current user is
        eligible (manager, in the guide's role, or assigned), and the record
        satisfies the guide's ``trigger_domain`` (e.g. its current stage).
        Used to surface the right guide on the right record at the right stage.
        """
        if not res_model or not res_id:
            return []
        Model = self.env.get(res_model)
        if Model is None:
            return []
        guides = self.search([("res_model", "=", res_model)])
        if not guides:
            return []
        user = self.env.user
        result = []
        for guide in guides:
            if not guide._is_eligible_for(user):
                continue
            domain = [("id", "=", res_id)] + guide._parse_trigger_domain()
            try:
                matches = bool(Model.search_count(domain))
            except Exception:
                # A malformed/incompatible domain never blocks other guides.
                matches = False
            if matches:
                result.append(guide._tour_payload())
        return result

    @api.model
    def get_contextual_models(self):
        """Distinct model names that have a contextual guide for this user.

        Fetched once by the frontend so it can skip the per-record
        ``get_guides_for`` RPC on models that have no guide at all.
        """
        guides = self.search([("res_model", "!=", False)])
        user = self.env.user
        models = set()
        for guide in guides:
            if guide._is_eligible_for(user):
                models.add(guide.res_model)
        return sorted(models)

    @api.model
    def get_tour_for_play(self, tour_id, lang=None):
        tour = self.browse(tour_id)
        tour.check_access_rights("read")
        tour.check_access_rule("read")
        if lang:
            tour = tour.with_context(lang=lang)
        return tour._tour_payload()

    @api.model
    def get_languages(self):
        """Installed languages + the current user's language, for the pickers."""
        return {
            "current": self.env.context.get("lang") or self.env.lang or "en_US",
            "langs": [
                {"code": code, "name": name}
                for code, name in self.env["res.lang"].get_installed()
            ],
        }

    @api.model
    def create_from_recording(self, name, description, steps):
        """Persist a freshly recorded tour (called by the Save Tour dialog)."""
        commands = [
            (0, 0, self._step_vals_from_payload(step, index))
            for index, step in enumerate(steps or [])
        ]
        tour = self.create(
            {
                "name": name or "Untitled Tour",
                "description": description or "",
                "step_ids": commands,
            }
        )
        return tour.id

    # Fields whose value is language-specific (stored per-language as jsonb).
    _TRANSLATABLE_STEP_FIELDS = ("name", "content", "validation_message")

    def save_steps(self, steps, lang=None):
        """Update the tour's steps in place (called by the Edit Steps dialog).

        Steps are matched by ``id`` and **updated** rather than deleted+recreated,
        so per-language translations stored on each step record survive. When a
        ``lang`` is given, translatable text is written for that language only.
        """
        self.ensure_one()
        Step = self.env["tour.recorder.step"]
        if lang:
            Step = Step.with_context(lang=lang)

        incoming = steps or []
        keep_ids = []
        for index, step in enumerate(incoming):
            vals = self._step_vals_from_payload(step, index)
            step_id = step.get("id")
            existing = Step.browse(step_id) if step_id else Step.browse()
            if step_id and existing.exists() and existing.tour_id.id == self.id:
                existing.write(vals)
                keep_ids.append(existing.id)
            else:
                vals["tour_id"] = self.id
                new = Step.create(vals)
                # Seed the source language so there is always a fallback value.
                if lang and lang != "en_US":
                    new.with_context(lang="en_US").write(
                        {f: vals.get(f) or "" for f in self._TRANSLATABLE_STEP_FIELDS}
                    )
                keep_ids.append(new.id)

        # Remove steps the user deleted in the editor.
        (self.step_ids - self.env["tour.recorder.step"].browse(keep_ids)).unlink()
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
        """Serialize the current tours to a base64-encoded JSON payload.

        Translatable fields are exported both as their source value (flat key,
        backward-compatible) and as a per-language ``*_i18n`` map so all
        languages travel between databases.
        """
        langs = [code for code, _name in self.env["res.lang"].get_installed()]

        def i18n(record, field):
            return {lang: (record.with_context(lang=lang)[field] or "") for lang in langs}

        payload = {"version": 2, "tours": []}
        for tour in self:
            payload["tours"].append(
                {
                    "name": tour.name,
                    "name_i18n": i18n(tour, "name"),
                    "description": tour.description or "",
                    "description_i18n": i18n(tour, "description"),
                    "steps": [
                        {
                            "sequence": step.sequence,
                            "title": step.name or "",
                            "title_i18n": i18n(step, "name"),
                            "trigger": step.css_selector or "",
                            "content": step.content or "",
                            "content_i18n": i18n(step, "content"),
                            "position": step.position or "bottom",
                            "run": step.run or "click",
                            "is_check": step.is_check,
                            "validation_type": step.validation_type or "none",
                            "validation_regex": step.validation_regex or "",
                            "validation_message": step.validation_message or "",
                            "validation_message_i18n": i18n(step, "validation_message"),
                        }
                        for step in tour.step_ids.sorted(lambda s: (s.sequence, s.id))
                    ],
                }
            )
        raw = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
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

        installed = [code for code, _name in self.env["res.lang"].get_installed()]

        created = self.browse()
        for tour in tours:
            if not isinstance(tour, dict):
                continue
            step_dicts = tour.get("steps") or []
            new_id = self.create_from_recording(
                tour.get("name") or _("Imported Tour"),
                tour.get("description") or "",
                step_dicts,
            )
            new_tour = self.browse(new_id)
            self._apply_import_translations(new_tour, tour, step_dicts, installed)
            created |= new_tour
        return created.ids

    def _apply_import_translations(self, tour, tour_dict, step_dicts, installed):
        """Write the per-language ``*_i18n`` maps from an export onto a new tour."""
        for lang in installed:
            vals = {}
            if tour_dict.get("name_i18n", {}).get(lang):
                vals["name"] = tour_dict["name_i18n"][lang]
            if tour_dict.get("description_i18n", {}).get(lang):
                vals["description"] = tour_dict["description_i18n"][lang]
            if vals:
                tour.with_context(lang=lang).write(vals)

        steps = tour.step_ids.sorted(lambda s: (s.sequence, s.id))
        for step_rec, sdict in zip(steps, step_dicts):
            if not isinstance(sdict, dict):
                continue
            for lang in installed:
                vals = {}
                if sdict.get("title_i18n", {}).get(lang):
                    vals["name"] = sdict["title_i18n"][lang]
                if sdict.get("content_i18n", {}).get(lang):
                    vals["content"] = sdict["content_i18n"][lang]
                if sdict.get("validation_message_i18n", {}).get(lang):
                    vals["validation_message"] = sdict["validation_message_i18n"][lang]
                if vals:
                    step_rec.with_context(lang=lang).write(vals)

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
