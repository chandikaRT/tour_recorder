/** @odoo-module **/

import { getTour } from "./tour_registry";

/**
 * Thin wrapper around the vendored Driver.js UMD build.
 *
 * Uses Driver.js in single-element highlight() mode. The sidebar controls
 * which step is active; Driver.js only renders the overlay + popover.
 *
 * Auto-advance uses two complementary mechanisms that share a "fire-once"
 * gate so only whichever fires first wins:
 *
 * 1. Coordinate-based document capture click listener.
 *    Driver.js places a stage <div> over the highlighted element, so a
 *    plain el.addEventListener("click") is never reached — clicks land on
 *    the stage. We listen at the capture phase on document instead and
 *    compare the click coordinates to the element's bounding rect.
 *    Applied to button/link steps only (not field widgets).
 *
 * 2. MutationObserver watching for the next step's target selector.
 *    When the next step's element is NOT yet in the DOM (cross-page
 *    navigation — e.g. the user clicked "New" and Odoo is loading the
 *    quotation form), we watch for it to appear. This fires independently
 *    of click mechanics and is reliable across all SPA transitions.
 */
export class DriverBridge {
    constructor() {
        this._driver = null;
        this._tour = null;
        // Auto-advance cleanup handles
        this._docClickCleanup = null;
        this._observer = null;
        this._observerTimeout = null;

        // Destroy the overlay on back/forward browser navigation.
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

    /** Remove all auto-advance listeners without advancing. */
    _cleanupAutoAdvance() {
        if (this._docClickCleanup) {
            this._docClickCleanup();
            this._docClickCleanup = null;
        }
        if (this._observerTimeout) {
            clearTimeout(this._observerTimeout);
            this._observerTimeout = null;
        }
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }
    }

    /** Tear down Driver.js overlay and all auto-advance listeners. */
    _destroyDriver() {
        this._cleanupAutoAdvance();
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
     * True for elements that trigger an action on click (buttons, links).
     * Field widgets and generic divs are excluded — clicking them starts
     * data entry, not a navigation, so auto-advance would skip prematurely.
     */
    _isClickAction(el) {
        const tag = el.tagName.toUpperCase();
        if (tag === "BUTTON" || tag === "A") return true;
        if (el.getAttribute("role") === "button") return true;
        if (el.querySelector("button, a[href]")) return true;
        return false;
    }

    /**
     * Wire up both auto-advance mechanisms for the current step.
     *
     * @param {Element} el          The highlighted DOM element.
     * @param {Function} advance    The fire-once advance callback.
     * @param {string|null} nextTarget  CSS selector for the next step's element.
     */
    _setupAutoAdvance(el, advance, nextTarget) {
        // ── Mechanism 1: coordinate-based document capture click ──────────────
        // Fires before any element handler, regardless of Driver.js overlays.
        if (this._isClickAction(el)) {
            const onClick = (e) => {
                const rect = el.getBoundingClientRect();
                if (
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                ) {
                    advance();
                }
            };
            document.addEventListener("click", onClick, true); // capture phase
            this._docClickCleanup = () =>
                document.removeEventListener("click", onClick, true);
        }

        // ── Mechanism 2: MutationObserver for next step's element ─────────────
        // Only set up when the next element is NOT already in the DOM.
        // This handles cross-page navigation reliably (e.g. list → form view).
        if (nextTarget && !document.querySelector(nextTarget)) {
            const observer = new MutationObserver(() => {
                if (document.querySelector(nextTarget)) {
                    advance();
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
            this._observer = observer;
            // Safety net: disconnect after 30 s to avoid zombie observers.
            this._observerTimeout = setTimeout(() => {
                observer.disconnect();
                this._observer = null;
                this._observerTimeout = null;
            }, 30000);
        }
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
     *
     * @param {string} stepId
     * @param {Function|null} onComplete  Advance callback (called once).
     * @param {string|null}   nextTarget  CSS selector for the next step's element.
     * @returns {boolean} true if the target element was found and highlighted
     */
    highlightStep(stepId, onComplete, nextTarget) {
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

        // Tear down previous highlight and any pending auto-advance listeners.
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

        // Wire auto-advance if a callback was provided.
        if (onComplete) {
            // Fire-once gate: whichever mechanism fires first wins; the other
            // is cleaned up immediately so it can't double-advance.
            let fired = false;
            const advance = () => {
                if (fired) return;
                fired = true;
                this._cleanupAutoAdvance();
                onComplete();
            };
            this._setupAutoAdvance(el, advance, nextTarget || null);
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
