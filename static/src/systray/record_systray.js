/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

/**
 * Systray control (managers only) to start/cancel/save a tour recording.
 */
export class RecordSystray extends Component {
    static template = "tour_recorder.RecordSystray";

    setup() {
        this.recorder = useService("tour_recorder");
        this.state = useState(this.recorder.state);
        this.ui = useState({ isManager: false });
        const user = useService("user");
        onWillStart(async () => {
            this.ui.isManager = await user.hasGroup(
                "tour_recorder.group_tour_manager"
            );
        });
    }

    onRecordClick() {
        if (this.state.recording) {
            this.recorder.cancel();
        } else {
            this.recorder.start();
        }
    }

    onSaveClick() {
        this.recorder.save();
    }
}

registry
    .category("systray")
    .add("tour_recorder.record", { Component: RecordSystray }, { sequence: 101 });
