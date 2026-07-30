/** @odoo-module **/

import { registry } from "@web/core/registry";
import { tourState } from "@web_tour/tour_service/tour_state";
import { isValid, validationMessage } from "../validation";

/**
 * Plays a recorded tour through Odoo's native (manual mode) tour engine and
 * mirrors the user's progress into `tour.recorder.progress` records.
 *
 * NOTE (Odoo 17 specifics):
 *  - Steps are registered dynamically in the "web_tour.tours" registry.
 *  - `isCheck` does not exist in 17; a "check only" step is emulated with an
 *    empty run function so the engine only asserts the element is visible.
 *  - There is no completion callback, so progress is derived by polling
 *    `tourState` (currentIndex / getActiveTourNames).
 *  - Data-type validation: a validated step advances only on a custom
 *    `consumeEvent` ("tr_validated"). The engine will not advance until that
 *    event fires on the trigger, and we only dispatch it once the field's value
 *    is valid -> the tour is physically blocked on wrong input.
 */

const CONSUME_EVENT = "tr_validated";

export const tourPlayerService = {
    dependencies: ["orm", "tour_service"],
    start(env, { orm, tour_service }) {
        function buildSteps(steps) {
            return steps.map((s) => {
                const step = {
                    trigger: s.trigger,
                    content: s.content,
                    position: s.position || "bottom",
                };
                if (s.is_check) {
                    // Emulate isCheck on Odoo 17: assert visibility, no interaction.
                    step.run = () => {};
                } else if (s.run) {
                    step.run = s.run;
                }
                if (s.validation_type && s.validation_type !== "none") {
                    // Advance only via our validated custom event (see validator).
                    step.consumeEvent = CONSUME_EVENT;
                }
                return step;
            });
        }

        // ---------------------------------------------------------------
        // Live validation controller
        // ---------------------------------------------------------------
        function createValidator(steps, tourKey) {
            let errorEl = null;

            function currentStep() {
                let idx = 0;
                try {
                    idx = tourState.get(tourKey, "currentIndex") || 0;
                } catch {
                    idx = 0;
                }
                return steps[idx];
            }

            function isValidated(step) {
                return step && step.validation_type && step.validation_type !== "none";
            }

            function elementValue(el) {
                if (el && "value" in el) {
                    return el.value;
                }
                return el ? el.textContent : "";
            }

            function ensureErrorEl() {
                if (!errorEl) {
                    errorEl = document.createElement("div");
                    errorEl.className = "o_tr_validation_error";
                    document.body.appendChild(errorEl);
                }
                return errorEl;
            }

            function showError(el, message) {
                const box = ensureErrorEl();
                box.textContent = message;
                box.style.display = "block";
                const rect = el.getBoundingClientRect();
                box.style.top = `${rect.bottom + 4}px`;
                box.style.left = `${rect.left}px`;
            }

            function clearError() {
                if (errorEl) {
                    errorEl.style.display = "none";
                }
            }

            function resolveElement(step, target) {
                if (!step) {
                    return null;
                }
                try {
                    if (target && target.matches && target.matches(step.trigger)) {
                        return target;
                    }
                    if (target && target.closest) {
                        const found = target.closest(step.trigger);
                        if (found) {
                            return found;
                        }
                    }
                    return document.querySelector(step.trigger);
                } catch {
                    return null;
                }
            }

            function advance(el) {
                clearError();
                el.dispatchEvent(new CustomEvent(CONSUME_EVENT, { bubbles: true }));
            }

            function evaluate(el, step, { silent = false } = {}) {
                if (!el) {
                    return;
                }
                const value = elementValue(el);
                if (isValid(value, step.validation_type, step.validation_regex)) {
                    advance(el);
                } else if (!silent && (value ?? "").toString().trim().length) {
                    showError(el, validationMessage(step.validation_type, step.validation_message));
                }
            }

            function onInput(ev) {
                const step = currentStep();
                if (!isValidated(step)) {
                    return;
                }
                const el = resolveElement(step, ev.target);
                if (el) {
                    evaluate(el, step);
                }
            }

            // Called from the poll loop: catches pre-filled valid fields and any
            // input event we might have missed. Never nags with an error.
            function checkCurrent() {
                const step = currentStep();
                if (!isValidated(step)) {
                    clearError();
                    return;
                }
                const el = resolveElement(step, null);
                if (el) {
                    evaluate(el, step, { silent: true });
                }
            }

            function onStepChange() {
                clearError();
            }

            const handler = onInput;
            document.addEventListener("input", handler, true);
            document.addEventListener("change", handler, true);
            document.addEventListener("blur", handler, true);

            function teardown() {
                document.removeEventListener("input", handler, true);
                document.removeEventListener("change", handler, true);
                document.removeEventListener("blur", handler, true);
                if (errorEl && errorEl.parentNode) {
                    errorEl.parentNode.removeChild(errorEl);
                }
                errorEl = null;
            }

            return { checkCurrent, onStepChange, teardown };
        }

        function trackProgress(tourId, tourKey, total, validator) {
            let last = 0;
            let sawActive = false;
            const interval = setInterval(async () => {
                const activeNames = tourState.getActiveTourNames
                    ? tourState.getActiveTourNames()
                    : [];
                if (activeNames.includes(tourKey)) {
                    sawActive = true;
                    let idx = 0;
                    try {
                        idx = tourState.get(tourKey, "currentIndex") || 0;
                    } catch {
                        idx = 0;
                    }
                    if (idx !== last) {
                        last = idx;
                        validator.onStepChange();
                        await orm.call("tour.recorder", "set_progress", [
                            tourId,
                            Math.min(idx, total),
                            "in_progress",
                        ]);
                    }
                    // Safety net for validated steps (pre-filled / missed events).
                    validator.checkCurrent();
                } else if (sawActive) {
                    // The tour left the active set: it either completed or was
                    // stopped by the user.
                    clearInterval(interval);
                    validator.teardown();
                    const completed = last >= total - 1;
                    await orm.call("tour.recorder", "set_progress", [
                        tourId,
                        completed ? total : last,
                        completed ? "completed" : "in_progress",
                    ]);
                }
            }, 800);

            // Safety net: never poll forever.
            setTimeout(() => {
                clearInterval(interval);
                validator.teardown();
            }, 1000 * 60 * 30);
        }

        async function play(tourId) {
            const tour = await orm.call("tour.recorder", "get_tour_for_play", [tourId]);
            const tourKey = tour.tour_key;
            const steps = tour.steps || [];
            const total = steps.length;
            if (!total) {
                return;
            }

            registry.category("web_tour.tours").add(
                tourKey,
                {
                    steps: () => buildSteps(steps),
                },
                { force: true }
            );

            const validator = createValidator(steps, tourKey);

            await orm.call("tour.recorder", "set_progress", [tourId, 0, "in_progress"]);
            tour_service.startTour(tourKey, { mode: "manual" });
            trackProgress(tourId, tourKey, total, validator);
        }

        return { play };
    },
};

registry.category("services").add("tour_player", tourPlayerService);
