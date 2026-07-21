/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { sprintf } from "@web/core/utils/strings";

/**
 * "Edit Steps" modal: reorder steps, tweak selectors / positions / tooltips and
 * toggle "check only", then persist everything at once.
 */
export class EditStepsDialog extends Component {
    static template = "custom_tour_recorder.EditStepsDialog";
    static components = { Dialog };
    static props = {
        tourId: { type: Number },
        tourName: { type: String, optional: true },
        onSaved: { type: Function, optional: true },
        close: { type: Function },
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.state = useState({ steps: [], loading: true });
        this.dialogTitle = sprintf(_t("Edit Steps – %s"), this.props.tourName || "");

        onWillStart(async () => {
            const tour = await this.orm.call("tour.recorder", "get_tour_for_play", [
                this.props.tourId,
            ]);
            this.state.steps = (tour.steps || []).map((s) => ({
                title: s.title || "",
                trigger: s.trigger || "",
                content: s.content || "",
                position: s.position || "bottom",
                run: s.run || "click",
                is_check: !!s.is_check,
            }));
            this.state.loading = false;
        });
    }

    get positions() {
        return [
            ["top", "top"],
            ["bottom", "bottom"],
            ["left", "left"],
            ["right", "right"],
        ];
    }

    addStep() {
        this.state.steps.push({
            title: "",
            trigger: "",
            content: "",
            position: "bottom",
            run: "click",
            is_check: false,
        });
    }

    moveUp(index) {
        if (index <= 0) {
            return;
        }
        const steps = this.state.steps;
        [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
    }

    moveDown(index) {
        const steps = this.state.steps;
        if (index >= steps.length - 1) {
            return;
        }
        [steps[index + 1], steps[index]] = [steps[index], steps[index + 1]];
    }

    removeStep(index) {
        this.state.steps.splice(index, 1);
    }

    async save() {
        for (const step of this.state.steps) {
            if (!step.trigger.trim()) {
                this.notification.add(_t("Every step needs a CSS trigger selector."), {
                    type: "warning",
                });
                return;
            }
        }
        await this.orm.call("tour.recorder", "save_steps", [
            this.props.tourId,
            this.state.steps,
        ]);
        this.notification.add(_t("Steps saved."), { type: "success" });
        if (this.props.onSaved) {
            this.props.onSaved();
        }
        this.props.close();
    }
}
