/** @odoo-module **/

import { Component, useState, onWillUnmount } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { TOURS, getTourCatalog } from "./tour_registry";
import { DriverBridge } from "./driver_bridge";

/**
 * Persistent right-docked sidebar available across the whole webclient.
 * Registered in the "main_components" registry so it lives outside any view.
 *
 * Tour progression is controlled entirely by the sidebar. Driver.js is used
 * only for the overlay + popover of the currently active step (highlight mode).
 *
 * Auto-advance: when the user clicks a highlighted button or link the sidebar
 * automatically moves to the next step (with DOM-wait retry so the new view
 * has time to load). Field widgets require the user to click Next manually.
 */
export class TourSidebar extends Component {
    static template = "tour_assistant.TourSidebar";
    static props = {};

    setup() {
        this.rpc = useService("rpc");
        this.action = useService("action");
        this.tours = TOURS;
        this.driver = new DriverBridge();

        this.state = useState({
            open: false,
            activeTab: "tour", // 'tour' | 'chat'
            currentTour: null, // tour id
            currentStepIndex: 0,
            stepNotFound: false, // true when the target element isn't in the DOM
            messages: [], // [{role: 'user'|'assistant', text}]
            chatInput: "",
            chatLoading: false,
        });

        onWillUnmount(() => this.driver.destroy());
    }

    // ---- panel ----------------------------------------------------------
    toggle() {
        this.state.open = !this.state.open;
        if (!this.state.open) {
            this.driver.destroy();
        }
    }

    setTab(tab) {
        this.state.activeTab = tab;
    }

    // ---- tour tab -------------------------------------------------------
    get activeTour() {
        return this.tours.find((t) => t.id === this.state.currentTour) || null;
    }

    async startTour(tourId) {
        if (this.driver.init(tourId)) {
            this.state.currentTour = tourId;
            this.state.currentStepIndex = 0;
            this.state.stepNotFound = false;
            await this.goToStep(0);
        }
    }

    /**
     * Activate step at the given index.
     *
     * Flow:
     *  1. Try to highlight the element immediately.
     *  2. If not found and the step has navigate_to, navigate via the action
     *     service first, then retry.
     *  3. Even without navigate_to, always enter a retry loop when the element
     *     isn't found — the user's preceding click may have triggered Odoo's
     *     SPA navigation and the new view is still loading.
     *
     * A one-shot onComplete callback is passed to the bridge so that clicking
     * a highlighted button/link automatically advances to the next step.
     */
    async goToStep(index) {
        const tour = this.activeTour;
        if (!tour || !tour.steps[index]) {
            return;
        }
        this.state.currentStepIndex = index;
        const step = tour.steps[index];

        // Build the auto-advance callback for this step.
        const onComplete =
            index < tour.steps.length - 1
                ? () => this.goToStep(index + 1)
                : null;

        // Attempt immediate highlight.
        let highlighted = this.driver.highlightStep(step.id, onComplete);

        if (!highlighted) {
            // Navigate to the declared action first (if any).
            if (step.navigate_to) {
                try {
                    await this.action.doAction(step.navigate_to, {
                        clearBreadcrumbs: true,
                    });
                } catch {
                    // Non-fatal — continue to retry loop.
                }
            }

            // Retry every 250 ms for up to 2 s.
            // This handles both explicit navigate_to navigations and
            // user-triggered SPA transitions (e.g. clicking "New" opens a form).
            for (let i = 0; i < 8 && !highlighted; i++) {
                await new Promise((r) => setTimeout(r, 250));
                highlighted = this.driver.highlightStep(step.id, onComplete);
            }
        }

        this.state.stepNotFound = !highlighted;
    }

    async nextStep() {
        await this.goToStep(this.state.currentStepIndex + 1);
    }

    async prevStep() {
        await this.goToStep(this.state.currentStepIndex - 1);
    }

    stopTour() {
        this.driver.destroy();
        this.state.currentTour = null;
        this.state.currentStepIndex = 0;
        this.state.stepNotFound = false;
    }

    // ---- chat tab -------------------------------------------------------
    async sendMessage() {
        const question = (this.state.chatInput || "").trim();
        if (!question || this.state.chatLoading) {
            return;
        }
        this.state.messages.push({ role: "user", text: question });
        this.state.chatInput = "";
        this.state.chatLoading = true;

        try {
            const result = await this.rpc("/tour_assistant/ask", {
                question,
                current_module: this._currentModule(),
                tours: getTourCatalog(),
            });
            this.state.messages.push({
                role: "assistant",
                text: result.answer || "",
                action: result.action || null,
            });
        } catch {
            this.state.messages.push({
                role: "assistant",
                text: "Sorry, something went wrong reaching the assistant.",
                action: null,
            });
        } finally {
            this.state.chatLoading = false;
        }
    }

    /** Follow an assistant action: jump into the suggested tour/step. */
    async followAction(action) {
        if (!action || !action.tour) {
            return;
        }
        this.state.activeTab = "tour";
        await this.startTour(action.tour);
        if (action.step) {
            const tour = this.activeTour;
            const idx = tour ? tour.steps.findIndex((s) => s.id === action.step) : -1;
            if (idx !== -1) {
                await this.goToStep(idx);
            }
        }
    }

    onChatKeydown(ev) {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            this.sendMessage();
        }
    }

    /** Best-effort current module/action name for grounding context. */
    _currentModule() {
        const hash = window.location.hash || "";
        const match = hash.match(/model=([\w.]+)/);
        return match ? match[1] : "unknown";
    }
}

registry.category("main_components").add("tour_assistant.TourSidebar", {
    Component: TourSidebar,
});
