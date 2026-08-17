/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { TourManagerDialog } from "../manager/tour_manager_dialog";

/**
 * Systray control (all users) opening the "Tour Manager" with the guides
 * available to the current user.
 *
 * Shows a red badge with the number of incomplete (not-yet-completed) tours
 * assigned to the current user.  The count is fetched on page load and
 * refreshed each time the user opens the Guides dialog.
 */
export class GuidesSystray extends Component {
    static template = "custom_tour_recorder.GuidesSystray";

    setup() {
        this.dialog = useService("dialog");
        this.orm = useService("orm");
        this.state = useState({ incompleteCount: 0 });
        onWillStart(() => this.refreshCount());
    }

    async refreshCount() {
        this.state.incompleteCount = await this.orm.call(
            "tour.recorder",
            "get_incomplete_tour_count",
            []
        );
    }

    async onClick() {
        await this.refreshCount();
        this.dialog.add(TourManagerDialog, {});
    }
}

registry
    .category("systray")
    .add("custom_tour_recorder.guides", { Component: GuidesSystray }, { sequence: 100 });
