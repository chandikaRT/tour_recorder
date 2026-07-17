/** @odoo-module **/

import { getTour } from "./tour_registry";

/**
 * Thin wrapper around the vendored Driver.js UMD build. The IIFE bundle
 * registers a global `window.driver.js.driver` factory.
 *
 * This is intentionally a plain class (not an Odoo service) so the sidebar
 * component can own one instance and tear it down cleanly on unmount.
 */
export class DriverBridge {
    constructor() {
        this._driver = null;
        this._tour = null;
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

    /**
     * Initialise a Driver.js instance for the given tour id.
     * @param {string} tourId
     * @returns {boolean} whether init succeeded (tour found + lib present)
     */
    init(tourId) {
        const tour = getTour(tourId);
        if (!tour) {
            return false;
        }
        this.destroy();
        this._tour = tour;
        const driver = this._factory();
        this._driver = driver({
            showProgress: true,
            allowClose: true,
            steps: tour.steps.map((s) => ({
                element: s.target,
                popover: {
                    title: s.title,
                    description: s.content,
                },
            })),
        });
        return true;
    }

    /** Highlight a specific step by its registry id. */
    highlightStep(stepId) {
        if (!this._driver || !this._tour) {
            return;
        }
        const index = this._tour.steps.findIndex((s) => s.id === stepId);
        if (index === -1) {
            return;
        }
        this._driver.drive(index);
    }

    /** Advance to the next step. */
    next() {
        if (this._driver) {
            this._driver.moveNext();
        }
    }

    /** Go back to the previous step. */
    prev() {
        if (this._driver) {
            this._driver.movePrevious();
        }
    }

    /** Tear down the active Driver.js instance and clear the overlay. */
    destroy() {
        if (this._driver) {
            try {
                this._driver.destroy();
            } catch {
                // Driver.js throws if already destroyed — safe to ignore.
            }
            this._driver = null;
        }
        this._tour = null;
    }
}
