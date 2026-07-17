/** @odoo-module **/

import { getTour } from "./tour_registry";

/**
 * Thin wrapper around the vendored Driver.js UMD build.
 *
 * Uses Driver.js in single-element highlight() mode. The sidebar controls
 * which step is active; Driver.js only renders the overlay + popover for the
 * current step. This survives Odoo's SPA navigations cleanly.
 *
 * Auto-advance: after highlighting, a one-shot click listener is attached to
 * the target element. For clickable elements (buttons, links) the listener
 * fires onComplete() so the sidebar can advance to the next step. For field
 * widgets (inputs, divs) auto-advance is suppressed — the user must click
 * the sidebar's Next button instead.
 */
export class DriverBridge {
    constructor() {
        this._driver = null;
        this._tour = null;
        this._clickCleanup = null;

        // Destroy the overlay on any Odoo SPA navigation so it never
        // persists on the wrong page.
        this._onNav = () => this._destroyDriver();
        window.addEventListener("popstate", this._onNav);
        window.addEventListener("hashchange", this._onNav);
    }

    /** Resolve the Driver.js factory from the vendored global. */
    _factory() {
        const g = window.driver && window.driver.js && window.driver.js.driver;
        if (!g) {
            throw new Error(
                "Driver.js not loaded — check static/lib/driver.js.umd.js in " +
                    "the assets bundle."
            );
        }
        return g;
    }

    /** Tear down the Driver.js overlay and any pending click listener. */
    _destroyDriver() {
        if (this._clickCleanup) {
            this._clickCleanup();
            this._clickCleanup = null;
        }
        if (this._driver) {
            try {
                this._driver.destroy();
            } catch {
                // Driver.js throws if already destroyed — safe to ignore.
            }
            this._driver = null;
        }
    }

    /**
     * Returns true if the element should auto-advance on click.
     * Buttons and anchor links trigger an action when clicked, so advancing
     * makes sense. Input fields and generic widgets are used for data entry —
     * advancing on click would skip the step before the user is done.
     */
    _isClickAction(el) {
        const tag = el.tagName.toUpperCase();
        if (tag === "BUTTON" || tag === "A") return true;
        if (el.getAttribute("role") === "button") return true;
        // Driver.js spotlights the element but the real button may be a child.
        if (el.querySelector("button, a[href]")) return true;
        return false;
    }

    /**
     * Register a tour for use. Does NOT create a Driver.js instance yet.
     * @param {string} tourId
     * @returns {boolean} true if the tour was found
     */
    init(tourId) {
        const tour = getTour(tourId);
        if (!tour) {
            return false;
        }
        this.destroy();
        this._tour = tour;
        return true;
    }

    /**
     * Highlight the step identified by stepId.
     * @param {string} stepId
     * @param {Function|null} onComplete  Called when the user clicks the
     *   highlighted element (buttons/links only). Use this to advance the tour.
     * @returns {boolean} true if the target element was found and highlighted
     */
    highlightStep(stepId, onComplete) {
        if (!this._tour) {
            return false;
        }
        const step = this._tour.steps.find((s) => s.id === stepId);
        if (!step) {
            return false;
        }

        const el = document.querySelector(step.target);
        if (!el) {
            return false;
        }

        // Tear down previous highlight + click listener before creating new ones.
        this._destroyDriver();

        const driverObj = this._factory()({
            overlayOpacity: 0.5,
            allowClose: true,
            stagePadding: 4,
            stageRadius: 4,
        });
        this._driver = driverObj;
        driverObj.highlight({
            element: step.target,
            popover: {
                title: step.title,
                description: step.content,
                side: "left",
                align: "start",
            },
        });

        // Attach auto-advance listener for clickable elements.
        if (onComplete && this._isClickAction(el)) {
            const handler = () => {
                this._clickCleanup = null;
                onComplete();
            };
            el.addEventListener("click", handler, { once: true });
            this._clickCleanup = () => el.removeEventListener("click", handler);
        }

        return true;
    }

    /** Tear down everything and remove navigation listeners. */
    destroy() {
        window.removeEventListener("popstate", this._onNav);
        window.removeEventListener("hashchange", this._onNav);
        this._destroyDriver();
        this._tour = null;
    }
}
