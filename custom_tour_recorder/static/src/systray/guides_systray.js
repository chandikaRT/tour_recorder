/** @odoo-module **/

import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { TourManagerDialog } from "../manager/tour_manager_dialog";

/**
 * Systray control (all users) opening the "Tour Manager" with the guides
 * available to the current user.
 */
export class GuidesSystray extends Component {
    static template = "custom_tour_recorder.GuidesSystray";

    setup() {
        this.dialog = useService("dialog");
    }

    onClick() {
        this.dialog.add(TourManagerDialog, {});
    }
}

registry
    .category("systray")
    .add("custom_tour_recorder.guides", { Component: GuidesSystray }, { sequence: 100 });
