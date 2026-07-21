# -*- coding: utf-8 -*-
from odoo import _, fields, models


class TourExportWizard(models.TransientModel):
    _name = "tour.recorder.export.wizard"
    _description = "Export Tours"

    data = fields.Binary(string="File", readonly=True, attachment=False)
    filename = fields.Char(string="Filename", default="tour_export.json")


class TourImportWizard(models.TransientModel):
    _name = "tour.recorder.import.wizard"
    _description = "Import Tours"

    data = fields.Binary(string="File", required=True, attachment=False)
    filename = fields.Char(string="Filename")

    def action_import(self):
        self.ensure_one()
        ids = self.env["tour.recorder"]._import_json(self.data)
        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Import complete"),
                "message": _("%s tour(s) imported.") % len(ids),
                "type": "success",
                "next": {
                    "type": "ir.actions.act_window",
                    "name": _("Imported Tours"),
                    "res_model": "tour.recorder",
                    "view_mode": "list,form",
                    "views": [[False, "list"], [False, "form"]],
                    "domain": [("id", "in", ids)],
                },
            },
        }
