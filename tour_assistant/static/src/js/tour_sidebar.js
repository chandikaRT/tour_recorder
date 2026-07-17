/** @odoo-module **/

import { Component, useState, onWillUnmount } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { TOURS, getTourCatalog } from "./tour_registry";
import { DriverBridge } from "./driver_bridge";

/**
 * Persistent right-docked sidebar available across the whole webclient.
 * Registered in the "main_components" registry so it lives outside any view.
 */
export class TourSidebar extends Component {
    static template = "tour_assistant.TourSidebar";
    static props = {};

    setup() {
        this.rpc = useService("rpc");
        this.tours = TOURS;
        this.driver = new DriverBridge();

        this.state = useState({
            open: false,
            activeTab: "tour", // 'tour' | 'chat'
            currentTour: null, // tour id
            currentStepIndex: 0,
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

    startTour(tourId) {
        if (this.driver.init(tourId)) {
            this.state.currentTour = tourId;
            this.state.currentStepIndex = 0;
            this.driver.highlightStep(this.activeTour.steps[0].id);
        }
    }

    goToStep(index) {
        const tour = this.activeTour;
        if (!tour || !tour.steps[index]) {
            return;
        }
        this.state.currentStepIndex = index;
        this.driver.highlightStep(tour.steps[index].id);
    }

    nextStep() {
        this.goToStep(this.state.currentStepIndex + 1);
    }

    prevStep() {
        this.goToStep(this.state.currentStepIndex - 1);
    }

    stopTour() {
        this.driver.destroy();
        this.state.currentTour = null;
        this.state.currentStepIndex = 0;
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
    followAction(action) {
        if (!action || !action.tour) {
            return;
        }
        this.state.activeTab = "tour";
        this.startTour(action.tour);
        if (action.step) {
            const tour = this.activeTour;
            const idx = tour ? tour.steps.findIndex((s) => s.id === action.step) : -1;
            if (idx !== -1) {
                this.goToStep(idx);
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
