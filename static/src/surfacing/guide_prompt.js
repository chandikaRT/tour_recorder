/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { useService } from "@web/core/utils/hooks";
import { onMounted, onPatched } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

/**
 * Contextual guide surfacing.
 *
 * When a user opens a document that has a matching contextual guide for their
 * role and the record's current state (see `tour.recorder.get_guides_for`), a
 * non-blocking sticky notification offers to play it — e.g. a technician
 * opening a repair order that is "Under Repair" is offered the "Log the repair"
 * guide. This is how a multi-user workflow reaches the right person at the
 * right stage without them hunting through the Guides menu.
 *
 * Cost control: the list of models that have any contextual guide is fetched
 * once per session; forms of every other model skip the per-record RPC.
 * Everything is defensive — if an internal API shifts, it fails silently
 * rather than breaking the form.
 */

// Cached once per session (a Promise resolving to an array of model names).
let contextualModelsPromise = null;
function contextualModels(orm) {
    if (!contextualModelsPromise) {
        contextualModelsPromise = orm
            .call("tour.recorder", "get_contextual_models", [])
            .catch(() => []);
    }
    return contextualModelsPromise;
}

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        this._trOrm = useService("orm");
        this._trNotification = useService("notification");
        this._trTourPlayer = useService("tour_player");
        this._trLastKey = null; // `${model}:${id}` already handled
        this._trCloseNotif = null; // dismiss fn for the active prompt
        onMounted(() => this._trMaybePromptGuides());
        onPatched(() => this._trMaybePromptGuides());
    },

    _trDismissPrompt() {
        if (this._trCloseNotif) {
            try {
                this._trCloseNotif();
            } catch {
                // ignore
            }
            this._trCloseNotif = null;
        }
    },

    async _trMaybePromptGuides() {
        let resModel;
        let resId;
        try {
            resModel = this.props.resModel;
            resId = this.model.root.resId;
        } catch {
            return;
        }
        // Only saved records have a stable id + state to match against.
        if (!resModel || !resId) {
            return;
        }
        const key = `${resModel}:${resId}`;
        if (this._trLastKey === key) {
            return; // already handled this record (onPatched fires repeatedly)
        }
        // Navigating to a different record: retire the previous prompt.
        this._trLastKey = key;
        this._trDismissPrompt();

        // Skip the RPC entirely for models that have no contextual guide.
        let models;
        try {
            models = await contextualModels(this._trOrm);
        } catch {
            return;
        }
        if (!models.includes(resModel)) {
            return;
        }

        // The record may have changed again while awaiting — bail if stale.
        if (this._trLastKey !== key) {
            return;
        }

        let guides = [];
        try {
            guides = await this._trOrm.call("tour.recorder", "get_guides_for", [resModel, resId]);
        } catch {
            return;
        }
        if (this._trLastKey !== key || !guides || !guides.length) {
            return;
        }

        const play = (guide) => {
            this._trDismissPrompt();
            try {
                this._trTourPlayer.play(guide.id);
            } catch {
                // ignore
            }
        };

        let message;
        let buttons;
        if (guides.length === 1) {
            message = _t('A guide is available for this step: "%s"', guides[0].name);
            buttons = [{ name: _t("Show me"), primary: true, onClick: () => play(guides[0]) }];
        } else {
            message = _t("%s guides are available for this step:", guides.length);
            // Cap the inline buttons so the toast stays readable.
            buttons = guides.slice(0, 3).map((guide) => ({
                name: guide.name,
                onClick: () => play(guide),
            }));
        }

        this._trCloseNotif = this._trNotification.add(message, {
            type: "info",
            sticky: true,
            buttons,
        });
    },
});
