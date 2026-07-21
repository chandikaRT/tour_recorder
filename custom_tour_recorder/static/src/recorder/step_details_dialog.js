/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

/**
 * "Step Details" modal shown each time the user right-clicks an element while
 * recording. Collects the title, tooltip, position and the "check only" flag.
 */
export class StepDetailsDialog extends Component {
    static template = "custom_tour_recorder.StepDetailsDialog";
    static components = { Dialog };
    static props = {
        selector: { type: String, optional: true },
        title: { type: String, optional: true },
        run: { type: String, optional: true },
        onAdd: { type: Function },
        close: { type: Function },
    };

    setup() {
        this.state = useState({
            title: this.props.title || "",
            content: "",
            position: "bottom",
            is_check: false,
        });
    }

    get positions() {
        return [
            ["top", "Top"],
            ["bottom", "Bottom"],
            ["left", "Left"],
            ["right", "Right"],
        ];
    }

    add() {
        this.props.onAdd({
            title: this.state.title,
            content: this.state.content,
            position: this.state.position,
            run: this.props.run,
            is_check: this.state.is_check,
        });
        this.props.close();
    }

    cancel() {
        this.props.close();
    }
}
