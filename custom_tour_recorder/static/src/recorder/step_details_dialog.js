/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { VALIDATION_TYPES } from "../validation";

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
        /** Array of { value, label } objects for native <select> option pickers. */
        selectOptions: { type: Array, optional: true },
        onAdd: { type: Function },
        close: { type: Function },
    };

    setup() {
        this.state = useState({
            title: this.props.title || "",
            content: "",
            position: "bottom",
            run: this.props.run || "click",
            /** Which <option> value the user chose (only used when selectOptions provided). */
            selectValue: "",
            is_check: false,
            validation_type: "none",
            validation_regex: "",
            validation_message: "",
        });
    }

    /**
     * Called when the user picks an option from the native-select picker.
     * Auto-fills the step title and tooltip so they don't have to type from scratch.
     */
    onSelectValueChange(ev) {
        const val = ev.target.value;
        this.state.selectValue = val;
        if (!val || !this.props.selectOptions) {
            return;
        }
        const opt = this.props.selectOptions.find((o) => o.value === val);
        if (!opt) {
            return;
        }
        if (!this.state.title) {
            this.state.title = `Select: ${opt.label}`;
        }
        if (!this.state.content) {
            this.state.content = `Select "${opt.label}" from the dropdown`;
        }
    }

    get positions() {
        return [
            ["top", "Top"],
            ["bottom", "Bottom"],
            ["left", "Left"],
            ["right", "Right"],
        ];
    }

    get runCommands() {
        return [
            ["click", "Click"],
            ["dblclick", "Double Click"],
            ["edit", "Edit / Type"],
            ["select", "Select option (native dropdown)"],
            ["press Enter", "Press Enter"],
            ["press Escape", "Press Escape"],
            ["press Tab", "Press Tab"],
        ];
    }

    get validationTypes() {
        return VALIDATION_TYPES;
    }

    add() {
        let run = this.state.run;
        // When the user picked a specific option from the native-select picker,
        // encode the value so playback can enforce the correct selection.
        // Format: "select:<optionValue>"  e.g. "select:confirmed"
        if (run === "select" && this.state.selectValue) {
            run = `select:${this.state.selectValue}`;
        }
        this.props.onAdd({
            title: this.state.title,
            content: this.state.content,
            position: this.state.position,
            run,
            is_check: this.state.is_check,
            validation_type: this.state.validation_type,
            validation_regex: this.state.validation_regex,
            validation_message: this.state.validation_message,
        });
        this.props.close();
    }

    cancel() {
        this.props.close();
    }
}
