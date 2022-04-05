# -*- coding: utf-8 -*-

# Part of Probuse Consulting Service Pvt Ltd. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _


class EmployeeLoanDetails(models.Model):
    _inherit = "employee.loan.details"

    def action_disburse(self):
        for loan in self:
            if loan.loan_type.disburse_method == 'payroll':
                loan.write({'state':'disburse'})
                return True
            else:
                return super(EmployeeLoanDetails, self).action_disburse()

class LoanInstallmentDetail(models.Model):
    _inherit = 'loan.installment.details'

    inrest_payslip_line_ids = fields.Many2many(
        'hr.payslip.line', 
        string='Interest Payslip Line', 
        required=False,
    )
    principal_payslip_line_ids = fields.Many2many(
        'hr.payslip.line', 
        'hr_payslip_line_rel', 
        'loan_installment_detail_id', 
        'payslip_id' ,
        string='Principal Payslip Line',
        required=False,
    )

    def write(self, vals):
        res = super(LoanInstallmentDetail, self).write(vals)
        for rec in self:
            total_inrest_sum = 0
            total_principal_sum = 0
            for inrest in rec.inrest_payslip_line_ids:
                total_inrest_sum += inrest.total
            if rec.interest_amt == abs(total_inrest_sum) and rec.state != 'paid' and not vals.get('state') == 'paid':
                rec.state = 'paid'
            for principal in rec.principal_payslip_line_ids:
                total_principal_sum += principal.total
            if rec.principal_amt == abs(total_principal_sum) and rec.state != 'paid' and not vals.get('state') == 'paid':
                rec.state = 'paid'
        return res
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: