/** @odoo-module **/

import { registry } from "@web/core/registry";
import { tourState } from "@web_tour/tour_service/tour_state";

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
 */
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
                return step;
            });
        }

        function trackProgress(tourId, tourKey, total) {
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
                        await orm.call("tour.recorder", "set_progress", [
                            tourId,
                            Math.min(idx, total),
                            "in_progress",
                        ]);
                    }
                } else if (sawActive) {
                    // The tour left the active set: it either completed or was
                    // stopped by the user.
                    clearInterval(interval);
                    const completed = last >= total - 1;
                    await orm.call("tour.recorder", "set_progress", [
                        tourId,
                        completed ? total : last,
                        completed ? "completed" : "in_progress",
                    ]);
                }
            }, 800);

            // Safety net: never poll forever.
            setTimeout(() => clearInterval(interval), 1000 * 60 * 30);
        }

        async function play(tourId) {
            const tour = await orm.call("tour.recorder", "get_tour_for_play", [tourId]);
            const tourKey = tour.tour_key;
            const total = (tour.steps || []).length;
            if (!total) {
                return;
            }

            registry.category("web_tour.tours").add(
                tourKey,
                {
                    steps: () => buildSteps(tour.steps),
                },
                { force: true }
            );

            await orm.call("tour.recorder", "set_progress", [tourId, 0, "in_progress"]);
            tour_service.startTour(tourKey, { mode: "manual" });
            trackProgress(tourId, tourKey, total);
        }

        return { play };
    },
};

registry.category("services").add("tour_player", tourPlayerService);
