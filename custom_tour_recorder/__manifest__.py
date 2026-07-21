# -*- coding: utf-8 -*-
{
    "name": "Interactive User Guide & Tour Recorder",
    "version": "17.0.1.0.0",
    "summary": "Record, assign and play no-code interactive guides using Odoo's native tour engine.",
    "description": """
Interactive User Guide & Tour Recorder
======================================
Record guided interactive tours without any code. Activate recording from the
systray, right-click any UI element to capture a step, assign the guide to users
and track their completion progress. Guides are played through Odoo's built-in
interactive tour engine (animated pointer + tooltips).

This is a clean-room implementation for Odoo 17.
""",
    "category": "Extra Tools",
    "author": "Chandika Rathnayake",
    "website": "",
    "license": "LGPL-3",
    "depends": ["web", "mail", "web_tour"],
    "data": [
        "security/tour_recorder_security.xml",
        "security/ir.model.access.csv",
        "views/tour_recorder_views.xml",
        "views/tour_recorder_menus.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "custom_tour_recorder/static/src/scss/tour_recorder.scss",
            "custom_tour_recorder/static/src/recorder/selector_utils.js",
            "custom_tour_recorder/static/src/recorder/recorder_service.js",
            "custom_tour_recorder/static/src/recorder/step_details_dialog.js",
            "custom_tour_recorder/static/src/recorder/step_details_dialog.xml",
            "custom_tour_recorder/static/src/manager/tour_manager_dialog.js",
            "custom_tour_recorder/static/src/manager/tour_manager_dialog.xml",
            "custom_tour_recorder/static/src/manager/edit_steps_dialog.js",
            "custom_tour_recorder/static/src/manager/edit_steps_dialog.xml",
            "custom_tour_recorder/static/src/playback/tour_player.js",
            "custom_tour_recorder/static/src/systray/record_systray.js",
            "custom_tour_recorder/static/src/systray/record_systray.xml",
            "custom_tour_recorder/static/src/systray/guides_systray.js",
            "custom_tour_recorder/static/src/systray/guides_systray.xml",
        ],
    },
    "images": ["static/description/icon.png"],
    "installable": True,
    "application": True,
}
