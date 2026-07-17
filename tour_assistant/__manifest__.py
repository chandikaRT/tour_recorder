# -*- coding: utf-8 -*-
{
    "name": "Tour Assistant",
    "summary": "Interactive guided tours with an AI chat assistant sidebar",
    "description": """
Interactive guided tours driven by Driver.js (MIT) with a persistent OWL
sidebar and an AI chat assistant. Fully decoupled from Odoo's native
web_tour registry.
    """,
    "version": "17.0.1.0.0",
    "category": "Productivity",
    "author": "Jinasena",
    "license": "LGPL-3",
    "depends": ["web", "mail"],
    "data": [
        "security/ir.model.access.csv",
    ],
    "assets": {
        "web.assets_backend": [
            # Vendored third-party lib (Driver.js 1.3.1, MIT).
            "tour_assistant/static/lib/driver.css",
            "tour_assistant/static/lib/driver.js.umd.js",
            # Our styles.
            "tour_assistant/static/src/scss/tour_sidebar.scss",
            # Our JS: registry + bridge first, component last.
            "tour_assistant/static/src/js/tour_registry.js",
            "tour_assistant/static/src/js/driver_bridge.js",
            "tour_assistant/static/src/js/tour_sidebar.js",
            # OWL template.
            "tour_assistant/static/src/xml/tour_sidebar.xml",
        ],
    },
    "installable": True,
    "application": True,
}
