# -*- coding: utf-8 -*-

# Part of Probuse Consulting Service Pvt Ltd. See LICENSE file for full copyright and licensing details.
import odoo.addons.decimal_precision as dp

import time
from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import models, fields, api, _
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, DEFAULT_SERVER_DATETIME_FORMAT, float_compare
from odoo.exceptions import Warning

class HrEmployee(models.Model):
    _inherit = 'hr.employee'
    
    def get_installment_loan(self, emp_id, date_from, date_to=None):
        if date_to is None:
            date_to = datetime.now().strftime('%Y-%m-%d')
        #probuse added paid state and loan_repayment_method condition
#         self._cr.execute("SELECT sum(o.principal_amt) from loan_installment_details as o where \
#                             o.employee_id=%s \
#                             AND o.state != 'paid'\
#                             AND o.loan_repayment_method = 'salary'\
#                             AND to_char(o.date_from, 'YYYY-MM-DD') >= %s AND to_char(o.date_from, 'YYYY-MM-DD') <= %s ",
#                             (emp_id, date_from, date_to))
        self._cr.execute("SELECT sum(o.principal_amt) from loan_installment_details as o where \
                            o.employee_id=%s \
                            AND o.state != 'paid'\
                            AND o.loan_repayment_method = 'salary'\
                            AND o.date_from >= %s AND o.date_from <= %s ",
                            (emp_id, date_from, date_to))
        res = self._cr.fetchone()
        return res and res[0] or 0.0

    def get_interest_loan(self, emp_id, date_from, date_to=None):
        if date_to is None:
            date_to = datetime.now().strftime('%Y-%m-%d')
        #probuse added paid state  and loan_repayment_method condition
#         self._cr.execute("SELECT sum(o.interest_amt) from loan_installment_details as o where \
#                             o.employee_id=%s \
#                             AND o.state != 'paid'\
#                             AND o.loan_repayment_method = 'salary'\
#                             AND to_char(o.date_from, 'YYYY-MM-DD') >= %s AND to_char(o.date_from, 'YYYY-MM-DD') <= %s ",
#                             (emp_id, date_from, date_to))
        self._cr.execute("SELECT sum(o.interest_amt) from loan_installment_details as o where \
                            o.employee_id=%s \
                            AND o.state != 'paid'\
                            AND o.loan_repayment_method = 'salary'\
                            AND o.date_from >= %s AND o.date_from <= %s ",
                            (emp_id, date_from, date_to))
        res = self._cr.fetchone()
        return res and res[0] or 0.0

class LoanType(models.Model):
    _inherit = 'loan.type'

    disburse_method = fields.Selection(selection_add=
        [('payroll', 'Through Payroll')],
    )

    payment_method = fields.Selection(selection_add=
        [('salary', 'Deduction From Payroll')],
    )
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: