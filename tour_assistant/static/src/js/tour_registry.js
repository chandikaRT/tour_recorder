/** @odoo-module **/

/**
 * Tour registry — our own tour step definitions, decoupled from Odoo's
 * native web_tour.tours. The sidebar and driver_bridge read from here.
 *
 * To add a new tour: append an object to TOURS below. No sidebar component
 * changes are needed.
 *
 * Step shape:
 *   {
 *     id:          unique string within the tour,
 *     title:       short heading shown in the Driver.js popover + step list,
 *     content:     HTML description shown in the popover,
 *     target:      CSS selector of the element to spotlight,
 *     navigate_to: (optional) Odoo action XML ID to load before highlighting.
 *                  The sidebar navigates there automatically if the target
 *                  element is not found on the current page.
 *   }
 *
 * Tour shape:
 *   { id, title, module, description, steps: [...] }
 */

export const TOURS = [
    {
        id: "sales_quotation_basics",
        title: "Create a Quotation",
        module: "sale",
        description:
            "Walk through creating and sending a customer quotation in Sales.",
        steps: [
            {
                id: "new_quotation",
                title: "Start a new quotation",
                content:
                    "Click <b>New</b> to open a blank quotation form.",
                target: ".o_list_button_add",
                // Navigates to Sales > Quotations list if not already there.
                navigate_to: "sale.action_quotations_with_onboarding",
            },
            {
                id: "select_customer",
                title: "Pick a customer",
                content:
                    "Choose the customer this quotation is for. Start typing " +
                    "to search existing contacts.<br><br>" +
                    "<em>Open a new quotation first (Step 1 → click New).</em>",
                target: ".o_field_widget[name='partner_id']",
            },
            {
                id: "add_order_line",
                title: "Add products",
                content:
                    "Click <b>Add a product</b> to add order lines with " +
                    "quantities and prices.<br><br>" +
                    "<em>Must be on the quotation form view.</em>",
                target: ".o_field_x2many_list_row_add a",
            },
            {
                id: "send_quotation",
                title: "Send by email",
                content:
                    "Use <b>Send by Email</b> to deliver the quotation to the " +
                    "customer, or <b>Confirm</b> to turn it into a sales order.<br><br>" +
                    "<em>This button is visible on a draft quotation form.</em>",
                target: "button[name='action_quotation_send']",
            },
        ],
    },
];

/**
 * Look up a tour by id.
 * @param {string} tourId
 * @returns {object|undefined}
 */
export function getTour(tourId) {
    return TOURS.find((t) => t.id === tourId);
}

/**
 * Build the compact JSON catalog sent to the backend as LLM grounding context.
 * Keeps only the fields the model needs.
 * @returns {Array}
 */
export function getTourCatalog() {
    return TOURS.map((t) => ({
        id: t.id,
        title: t.title,
        module: t.module,
        description: t.description,
        steps: t.steps.map((s) => ({
            id: s.id,
            title: s.title,
            content: s.content,
        })),
    }));
}
