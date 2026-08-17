/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { sprintf } from "@web/core/utils/strings";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { EditStepsDialog } from "./edit_steps_dialog";

/**
 * "Tour Manager" modal. Two modes:
 *  - opened from the "Guides" systray -> lists the tours available to the user.
 *  - opened from the recording "Save" button (recordedSteps prop) -> also shows
 *    a panel to name and save the freshly recorded tour.
 */
export class TourManagerDialog extends Component {
    static template = "tour_recorder.TourManagerDialog";
    static components = { Dialog };
    static props = {
        recordedSteps: { type: Array, optional: true },
        onSaved: { type: Function, optional: true },
        close: { type: Function },
    };

    setup() {
        this.orm = useService("orm");
        this.dialog = useService("dialog");
        this.notification = useService("notification");
        this.player = useService("tour_player");
        this.recorder = useService("tour_recorder");
        const user = useService("user");

        this.steps = this.props.recordedSteps || [];
        this.state = useState({
            tours: [],
            loading: true,
            isManager: false,
            showSave: !!this.props.recordedSteps,
            name: "",
            description: "",
            langs: [],
            playLang: "en_US",
        });

        onWillStart(async () => {
            this.state.isManager = await user.hasGroup(
                "tour_recorder.group_tour_manager"
            );
            const info = await this.orm.call("tour.recorder", "get_languages", []);
            this.state.langs = info.langs || [];
            this.state.playLang = info.current || "en_US";
            await this.loadTours();
        });
    }

    onPlayLangChange(ev) {
        this.state.playLang = ev.target.value;
    }

    async loadTours() {
        this.state.loading = true;
        this.state.tours = await this.orm.call("tour.recorder", "get_my_tours", []);
        this.state.loading = false;
    }

    get recordedCount() {
        return this.steps.length;
    }

    get isRecording() {
        return this.recorder.state.recording;
    }

    continueRecording(tour) {
        this.props.close();
        this.recorder.continueRecording(tour);
    }

    newTour() {
        this.steps = [];
        this.state.name = "";
        this.state.description = "";
        this.state.showSave = true;
    }

    cancelSave() {
        this.state.showSave = false;
    }

    async save() {
        if (!this.state.name.trim()) {
            this.notification.add(_t("Please give your tour a name."), { type: "warning" });
            return;
        }
        await this.orm.call("tour.recorder", "create_from_recording", [
            this.state.name,
            this.state.description,
            this.steps,
        ]);
        this.notification.add(_t("Tour saved!"), { type: "success" });
        if (this.props.onSaved) {
            this.props.onSaved();
        }
        this.steps = [];
        this.state.showSave = false;
        await this.loadTours();
    }

    play(tour) {
        this.props.close();
        this.player.play(tour.id, this.state.playLang);
    }

    editSteps(tour) {
        this.dialog.add(EditStepsDialog, {
            tourId: tour.id,
            tourName: tour.name,
            onSaved: () => this.loadTours(),
        });
    }

    remove(tour) {
        this.dialog.add(ConfirmationDialog, {
            title: _t("Delete Tour"),
            body: sprintf(_t('Are you sure you want to delete "%s"?'), tour.name),
            confirmLabel: _t("Delete"),
            confirm: async () => {
                await this.orm.unlink("tour.recorder", [tour.id]);
                this.notification.add(_t("Tour deleted."), { type: "success" });
                await this.loadTours();
            },
            cancel: () => {},
        });
    }
}
