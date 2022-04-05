# -*- coding: utf-8 -*-

# Part of Probuse Consulting Service Pvt Ltd. See LICENSE file for full copyright and licensing details.

from odoo import models, api,fields

class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    # @api.multi
    # def action_payslip_done(self):
    #     res = super(HrPayslip, self).action_payslip_done()
    #     for rec in self:
    #         line = rec.line_ids.filtered(lambda l:l.salary_rule_id.is_loan_payment)
    #         if line:
    #             install_ids = self.get_loan_installment(rec.employee_id.id, rec.date_from, rec.date_to)
    #             if install_ids:
    #                 install_lines = self.env['loan.installment.details'].browse(install_ids)
    #                 install_lines.pay_installment()
    #     return res

    # @api.model
    # def get_loan_installment(self, emp_id, date_from, date_to=None):
    #         self._cr.execute("SELECT o.id, o.install_no from loan_installment_details as o where \
    #                             o.employee_id=%s \
    #                             AND o.state != 'paid' \
    #                             AND o.loan_repayment_method = 'salary' \
    #                             AND o.date_from >= %s AND o.date_from <= %s ",
    #                             (emp_id, date_from, date_to))
    #         res = self._cr.dictfetchall()
    #         print('ressss',res)
    #         install_ids = []
    #         if res:
    #             install_ids = [r['id']for r in res]
    #         print('install_ids',install_ids)
    #         return install_ids

class HrPayslipLine(models.Model):
    _inherit = 'hr.payslip.line'

    custom_state = fields.Selection(
        related='slip_id.state', 
        required=False, 
        readonly=False
    )
    custom_is_loan_payment = fields.Boolean(
        related='salary_rule_id.is_loan_payment',
    )
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: