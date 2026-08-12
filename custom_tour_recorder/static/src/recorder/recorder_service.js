/** @odoo-module **/

import { registry } from "@web/core/registry";
import { reactive } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { getCssSelector, inferRun, suggestTitle } from "./selector_utils";
import { StepDetailsDialog } from "./step_details_dialog";
import { TourManagerDialog } from "../manager/tour_manager_dialog";

/**
 * Singleton service that drives the "record a tour" experience. It lives in a
 * service (not a component) so the recording state survives SPA navigation
 * while the user clicks around the interface to capture steps.
 */
export const tourRecorderService = {
    dependencies: ["notification", "dialog", "orm"],
    start(env, { notification, dialog, orm }) {
        const state = reactive({
            recording: false,
            steps: [],
            tourId: null,   // null = new tour; integer = continue an existing tour
            tourName: "",   // display name shown in the systray during continue mode
        });

        let contextHandler = null;
        let selectChangeHandler = null;

        /**
         * Auto-capture native <select> option picks during recording.
         *
         * OS-rendered dropdown options never fire a contextmenu event, so the
         * normal right-click flow is impossible for native <select> fields.
         * Instead we intercept the "change" event that fires after the user
         * picks an option from the OS dropdown and offer to record it as a step.
         */
        function onSelectChange(ev) {
            if (!state.recording) {
                return;
            }
            const el = ev.target;
            if (!el || el.tagName !== "SELECT") {
                return;
            }
            // Skip selects that live inside our own recorder UI.
            if (
                el.closest(".o_tour_recorder_dialog") ||
                el.closest(".o_tour_recorder_systray")
            ) {
                return;
            }
            const selector = getCssSelector(el);
            // Use the chosen option's label as the step title suggestion.
            const chosen = el.options[el.selectedIndex];
            const label = chosen ? chosen.text.trim() : el.value;
            dialog.add(StepDetailsDialog, {
                selector,
                title: label ? `Select: ${label}` : "",
                run: "select",
                onAdd: (step) => {
                    state.steps.push({
                        title: step.title,
                        trigger: selector,
                        content: step.content,
                        position: step.position,
                        run: "select",
                        is_check: step.is_check,
                        validation_type: step.validation_type || "none",
                        validation_regex: step.validation_regex || "",
                        validation_message: step.validation_message || "",
                    });
                },
            });
        }

        function onContextMenu(ev) {
            if (!state.recording) {
                return;
            }
            const target = ev.target;
            // Ignore right-clicks inside our own recorder dialogs / systray
            // controls, but allow recording on any other Odoo popup/dialog.
            if (
                target.closest(".o_tour_recorder_dialog") ||
                target.closest(".o_tour_recorder_systray")
            ) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();

            const selector = getCssSelector(target);
            dialog.add(StepDetailsDialog, {
                selector,
                title: suggestTitle(target),
                run: inferRun(target),
                onAdd: (step) => {
                    state.steps.push({
                        title: step.title,
                        trigger: selector,
                        content: step.content,
                        position: step.position,
                        run: step.run || inferRun(target),
                        is_check: step.is_check,
                        validation_type: step.validation_type || "none",
                        validation_regex: step.validation_regex || "",
                        validation_message: step.validation_message || "",
                    });
                },
            });
        }

        function start() {
            if (state.recording) {
                return;
            }
            state.recording = true;
            state.steps = [];
            state.tourId = null;
            state.tourName = "";
            contextHandler = onContextMenu;
            selectChangeHandler = onSelectChange;
            document.addEventListener("contextmenu", contextHandler, true);
            document.addEventListener("change", selectChangeHandler, true);
            notification.add(
                _t(
                    "Recording started. Use LEFT CLICK to interact normally. RIGHT CLICK an element to record a step."
                ),
                { type: "info", sticky: false }
            );
        }

        /**
         * Resume recording on an existing saved tour. Pre-loads its steps so new
         * right-clicked steps are appended. Saving will update the tour in-place
         * via save_steps instead of creating a new one.
         */
        function continueRecording(tour) {
            if (state.recording) {
                return;
            }
            // Convert server-side step shape to the client-side recording format.
            // Keep the step id so save_steps updates existing rows in place
            // (preserving per-language translations) instead of recreating them.
            state.steps = (tour.steps || []).map((s) => ({
                id: s.id,
                title: s.title || "",
                trigger: s.trigger || "",
                content: s.content || "",
                position: s.position || "bottom",
                run: s.run || "click",
                is_check: !!s.is_check,
                validation_type: s.validation_type || "none",
                validation_regex: s.validation_regex || "",
                validation_message: s.validation_message || "",
            }));
            state.tourId = tour.id;
            state.tourName = tour.name;
            state.recording = true;
            contextHandler = onContextMenu;
            selectChangeHandler = onSelectChange;
            document.addEventListener("contextmenu", contextHandler, true);
            document.addEventListener("change", selectChangeHandler, true);
            notification.add(
                _t(
                    'Continuing "%s" — %s existing step(s). RIGHT CLICK to add more steps.',
                    tour.name,
                    state.steps.length
                ),
                { type: "info", sticky: false }
            );
        }

        function stopListening() {
            if (contextHandler) {
                document.removeEventListener("contextmenu", contextHandler, true);
                contextHandler = null;
            }
            if (selectChangeHandler) {
                document.removeEventListener("change", selectChangeHandler, true);
                selectChangeHandler = null;
            }
        }

        function clearState() {
            state.recording = false;
            state.steps = [];
            state.tourId = null;
            state.tourName = "";
        }

        /** Cancel recording, discarding captured steps. */
        function cancel() {
            if (!state.recording) {
                return;
            }
            stopListening();
            clearState();
            notification.add(_t("Recording cancelled."), { type: "warning" });
        }

        /** Finish recording: update an existing tour or open the save dialog for a new one. */
        function save() {
            if (!state.recording) {
                return;
            }
            if (!state.steps.length) {
                notification.add(_t("No steps were recorded yet."), { type: "warning" });
                return;
            }
            if (state.tourId) {
                // Continue mode: persist directly to the existing tour.
                const tourId = state.tourId;
                const allSteps = [...state.steps];
                orm.call("tour.recorder", "save_steps", [tourId, allSteps]).then(() => {
                    notification.add(_t("Tour updated!"), { type: "success" });
                    stopListening();
                    clearState();
                });
            } else {
                // New tour mode: open the manager dialog to name and save.
                const recordedSteps = [...state.steps];
                dialog.add(TourManagerDialog, {
                    recordedSteps,
                    onSaved: () => {
                        stopListening();
                        clearState();
                    },
                });
            }
        }

        function reset() {
            stopListening();
            clearState();
        }

        return {
            state,
            start,
            continueRecording,
            cancel,
            save,
            reset,
            get count() {
                return state.steps.length;
            },
        };
    },
};

registry.category("services").add("tour_recorder", tourRecorderService);
