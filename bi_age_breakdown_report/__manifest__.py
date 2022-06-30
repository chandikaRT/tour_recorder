# -*- coding: utf-8 -*-
# Part of BrowseInfo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Stock Age Breakdown Report Odoo App',
    'version': '15.0.0.0',
    'category': 'Warehouse',
    'license': 'OPL-1',
    'summary': 'Print Inventory Age Report Inventory Breakdown Report inventory aging report stock aging report warehouse aging report product Stock aging report Inventory age stock report stock card stock ageing report stock expiry report aging stock report ageing stock',
    'description' :"""
         This odoo app helps user to identify stock age, user can identify age of stock with days and stock values.
    """,
    'author': 'BrowseInfo',
    'website': 'https://www.browseinfo.in',
    "price": 29,
    "currency": 'EUR',
    'depends': ['sale_stock'],
    'data': [
        'security/ir.model.access.csv',
        'wizard/bi_age_breakdown_report_view.xml',
    ],
    'demo': [],
    'test': [],
    'installable': True,
    'auto_install': False,
    'live_test_url':'https://youtu.be/xE4wZUZipX4',
    "images":['static/description/Banner.png'],
}
