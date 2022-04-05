# -*- coding: utf-8 -*-

# Part of Probuse Consulting Service Pvt Ltd. See LICENSE file for full copyright and licensing details.

from odoo import models, fields

class HrSalaryRule(models.Model):
    _inherit = 'hr.salary.rule'

    is_loan_payment = fields.Boolean(
        string='Loan Payment',
    )
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: