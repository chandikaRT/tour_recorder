# -*- coding: utf-8 -*-
#################################################################################
# Author      : Acespritech Solutions Pvt. Ltd. (<www.acespritech.com>)
# Copyright(c): 2012-Present Acespritech Solutions Pvt. Ltd.
# All Rights Reserved.
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#################################################################################

{
    'name': 'Dynamic Cheque Print (Community)',
    'version': '1.0',
    'author': 'Acespritech Solutions Pvt. Ltd.',
    'category': 'Account',
    'description': """
        User can print the cheque and also can configure cheque different bank's cheque formats.
    """,
    'website': 'https://www.acespritech.com',
    'summary': 'Dynamic Cheque Print. User can print cheque easily.',
    'depends': ['base', 'sale_management', 'account'],
    'currency': 'EUR',
    'price': 60.00,
    'data': [
        'security/ir.model.access.csv',
        'views/dynamic_cheque_preview.xml',
        'views/dynamic_cheque_format_configuration_view.xml',
        'views/dynamic_cheque_print.xml',
        'views/account_payment_view.xml',
        'views/dynamic_cheque_print_template.xml',
        'dynamic_cheque_print_report.xml',
    ],
    'images': ['static/description/main_screenshot.png'],
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: