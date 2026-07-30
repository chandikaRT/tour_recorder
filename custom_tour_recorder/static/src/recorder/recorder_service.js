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
        });

        let contextHandler = null;

        function onContextMenu(ev) {
            if (!state.recording) {
                return;
            }
            const target = ev.target;
            // Ignore right-clicks inside our own dialogs / systray controls.
            if (
                target.closest(".o_dialog") ||
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
            contextHandler = onContextMenu;
            document.addEventListener("contextmenu", contextHandler, true);
            notification.add(
                _t(
                    "Recording started. Use LEFT CLICK to interact normally. RIGHT CLICK an element to record a step."
                ),
                { type: "info", sticky: false }
            );
        }

        function stopListening() {
            if (contextHandler) {
                document.removeEventListener("contextmenu", contextHandler, true);
                contextHandler = null;
            }
        }

        /** Cancel recording, discarding captured steps. */
        function cancel() {
            if (!state.recording) {
                return;
            }
            stopListening();
            state.recording = false;
            state.steps = [];
            notification.add(_t("Recording cancelled."), { type: "warning" });
        }

        /** Finish recording and open the save dialog. */
        function save() {
            if (!state.recording) {
                return;
            }
            if (!state.steps.length) {
                notification.add(_t("No steps were recorded yet."), { type: "warning" });
                return;
            }
            const recordedSteps = [...state.steps];
            dialog.add(TourManagerDialog, {
                recordedSteps,
                onSaved: () => {
                    stopListening();
                    state.recording = false;
                    state.steps = [];
                },
            });
        }

        function reset() {
            stopListening();
            state.recording = false;
            state.steps = [];
        }

        return {
            state,
            start,
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
