# -*- coding: utf-8 -*-

# Part of Probuse Consulting Service Pvt Ltd. See LICENSE file for full copyright and licensing details.

{
    'name' : 'Employee Loan Management with Payroll',
    'version' : '5.1.3',
    'category': 'Human Resources/Payroll',
    'depends' : [
         'hr_payroll',
         'hr_employee_loan',
                ],
    'author': 'Probuse Consulting Service Pvt. Ltd.',
    'images': ['static/description/img1.png'],
    'price': 79.0,
    'currency': 'EUR',
    'live_test_url': 'https://probuseappdemo.com/probuse_apps/employee_loan_payroll_enterprise/430',#'https://youtu.be/8EACejlHDF4',
    'license': 'Other proprietary',
    'summary': 'Employee Loan with Payroll Integration (Odoo Enterprise Edition)',
    'website': 'www.probuse.com',
    'description': ''' 
employee loan
loan
odoo loan
employee loan odoo
loan app
odoo loan app
 ''',
    'data' : [
        'views/hr_salary_rule_view.xml',
        'views/hr_payslip_line_view.xml',
        'views/loan_installment_view.xml',
        #'data/loan_payroll_sequence_enterprice.xml',
    ],
    'demo': ['data/loan_payroll_sequence_enterprice.xml'],
    'installable': True,
    'application': False,
}
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
