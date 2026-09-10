/** @odoo-module **/

/**
 * Best-effort generation of a CSS selector for a DOM element, used by the tour
 * recorder. Selectors produced here are a starting point; a manager can always
 * refine them afterwards in the "Edit Steps" dialog.
 */

function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
        return window.CSS.escape(value);
    }
    return String(value).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

function isUnique(selector) {
    try {
        return document.querySelectorAll(selector).length === 1;
    } catch {
        return false;
    }
}

/**
 * Classes we never want to include in a selector because they change with the
 * element state and would make playback brittle.
 */
const VOLATILE_CLASS = /^(o_selected|o_current|active|show|focus|hover|disabled|o_dirty|o_field_invalid|d-none|collapsed|collapsing)$/;

/**
 * Purely visual / decorative tags that should never be the selector target.
 * When the user right-clicks one of these (e.g. a Font Awesome <i> icon or
 * a <span> label inside a button), we walk up to the nearest interactive
 * ancestor.  Recording the icon's selector produces a spotlight the size of
 * the icon; recording the button's selector produces a spotlight that covers
 * the full button as the user expects.
 */
const DECORATIVE_TAGS = new Set([
    "SPAN", "I", "EM", "B", "STRONG", "SMALL", "SUP", "SUB",
    "IMG", "SVG", "PATH", "USE", "G", "CIRCLE", "RECT", "POLYGON",
]);

const INTERACTIVE_SELECTOR = [
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "label",
    "[role='button']",
    "[role='link']",
    "[role='menuitem']",
    "[role='option']",
    "[role='tab']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='switch']",
].join(", ");

function classSelector(el) {
    if (!el.classList || !el.classList.length) {
        return "";
    }
    const classes = [...el.classList]
        .filter((c) => c && !VOLATILE_CLASS.test(c))
        .slice(0, 2)
        .map((c) => "." + cssEscape(c))
        .join("");
    return classes;
}

function nthOfType(el) {
    const parent = el.parentElement;
    if (!parent) {
        return "";
    }
    const sameTag = [...parent.children].filter((c) => c.tagName === el.tagName);
    if (sameTag.length <= 1) {
        return "";
    }
    const index = sameTag.indexOf(el) + 1;
    return `:nth-of-type(${index})`;
}

function localSelector(el) {
    return el.tagName.toLowerCase() + classSelector(el);
}

/**
 * Build a descendant selector by climbing up the DOM tree until the selector is
 * unique or we reach the body.
 */
function buildPath(el) {
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && node.tagName !== "BODY" && depth < 6) {
        let part = localSelector(node);
        // If this local selector matches several siblings, disambiguate.
        const parent = node.parentElement;
        if (parent && parent.querySelectorAll(":scope > " + part).length > 1) {
            part += nthOfType(node);
        }
        parts.unshift(part);
        const candidate = parts.join(" > ");
        if (isUnique(candidate)) {
            return candidate;
        }
        node = parent;
        depth++;
    }
    return parts.join(" > ");
}

export function getCssSelector(el) {
    if (!el || el.nodeType !== 1) {
        return "";
    }

    // 0. Normalise: walk up to interactive ancestor when the right-clicked
    //    element is a decorative inline node (icon, label span, SVG path…).
    //    Recording button > span.oi.oi-save produces a selector for a tiny
    //    icon; recording the button itself produces a selector for the full
    //    interactive element, which is always what the tour should target.
    if (DECORATIVE_TAGS.has(el.tagName)) {
        const interactiveParent = el.closest(INTERACTIVE_SELECTOR);
        if (interactiveParent) {
            el = interactiveParent;
        }
    }

    // 1. Semantic xmlid / hotkey — the most stable identifiers in Odoo.
    //    Checked BEFORE id because Odoo auto-generates positional ids like
    //    "result_app_3" that change whenever apps are installed/removed.
    for (const attr of ["data-menu-xmlid", "data-hotkey"]) {
        const val = el.getAttribute && el.getAttribute(attr);
        if (val) {
            const sel = `[${attr}="${val}"]`;
            if (isUnique(sel)) {
                return sel;
            }
        }
    }

    // 2. A stable id.
    if (el.id) {
        const sel = `#${cssEscape(el.id)}`;
        if (isUnique(sel)) {
            return sel;
        }
    }

    // 3. Odoo fields/buttons usually carry a "name" attribute.
    const nameAttr = el.getAttribute && el.getAttribute("name");
    if (nameAttr) {
        const tag = el.tagName.toLowerCase();
        const sel = `${tag}[name="${nameAttr}"]`;
        if (isUnique(sel)) {
            return sel;
        }
    }

    // 4. Ancestor bubble-up for semantic attributes.
    //    When the user right-clicks an inner element (e.g. the <img> or
    //    <div class="o_caption"> inside an app icon <a data-menu-xmlid="...">),
    //    ev.target is that child and not the parent anchor. Climb up the DOM
    //    (max 5 levels) to find a parent that carries a stable semantic attribute.
    let ancestor = el.parentElement;
    let depth = 0;
    while (ancestor && ancestor.nodeType === 1 && ancestor.tagName !== "BODY" && depth < 5) {
        for (const attr of ["data-menu-xmlid", "data-hotkey"]) {
            const val = ancestor.getAttribute && ancestor.getAttribute(attr);
            if (val) {
                const sel = `[${attr}="${val}"]`;
                if (isUnique(sel)) {
                    return sel;
                }
            }
        }
        ancestor = ancestor.parentElement;
        depth++;
    }

    // 5. Fall back to a structural path.
    return buildPath(el);
}

/**
 * Infer the tour "run" command from the element the user right-clicked.
 */
export function inferRun(el) {
    if (!el) {
        return "click";
    }
    const tag = el.tagName ? el.tagName.toLowerCase() : "";

    // Native <select>: the meaningful action is picking a value, not just
    // opening the OS dropdown. We use the sentinel "select" so buildSteps()
    // can set consumeEvent:"change" — the tour then advances only after the
    // user has actually chosen an option, not on the initial click-to-open.
    if (tag === "select") {
        return "select";
    }

    // Odoo dropdown field widgets: the user clicks to open the picker, not type.
    // Returning "edit" here causes the playback engine to wait for an "input"
    // event, which never fires on a plain click — leaving the step stuck.
    if (el.closest(".o_field_many2one, .o_field_many2many, .o_field_selection, .o_field_tags")) {
        return "click";
    }

    const editable =
        tag === "input" ||
        tag === "textarea" ||
        el.isContentEditable ||
        el.closest("input, textarea, [contenteditable=true]");
    return editable ? "edit" : "click";
}

/**
 * Suggest a human friendly default title from the element's text/label.
 */
export function suggestTitle(el) {
    if (!el) {
        return "";
    }
    const text = (el.innerText || el.value || el.getAttribute("aria-label") || el.getAttribute("title") || "")
        .trim()
        .replace(/\s+/g, " ");
    return text.slice(0, 40);
}

/**
 * Parse Odoo's `data-tooltip-info` JSON attribute and extract the help text.
 *
 * Odoo uses a template-based tooltip system: `data-tooltip-template` names a
 * QWeb template (e.g. "web.FieldTooltip") and `data-tooltip-info` carries a
 * JSON payload for that template.  In non-debug mode the payload is:
 *   { "field": { "help": "Human-readable help text" } }
 * In debug mode extra keys appear (resModel, technical_name, …) but `field.help`
 * is still the user-visible text we want.
 *
 * Returns "" when the attribute is absent, malformed, or has no help text.
 */
function parseTooltipInfo(node) {
    const raw = node.getAttribute("data-tooltip-info");
    if (!raw) {
        return "";
    }
    try {
        const info = JSON.parse(raw);
        const help = (info.field && info.field.help) || info.help || "";
        return help.trim();
    } catch {
        return "";
    }
}

/**
 * Read any recognised tooltip text from a single DOM node.
 *
 * Priority:
 *   1. data-tooltip            (plain string — most Odoo buttons / menus)
 *   2. data-tooltip-template   (template-based; payload parsed from data-tooltip-info)
 *   3. title
 *   4. aria-label
 *   5. placeholder             (only on the original clicked element, not parents)
 */
function readTooltipAttr(node, checkPlaceholder) {
    const tooltip = (node.getAttribute("data-tooltip") || "").trim();
    if (tooltip) {
        return tooltip;
    }
    if (node.getAttribute("data-tooltip-template")) {
        const info = parseTooltipInfo(node);
        if (info) {
            return info;
        }
    }
    const title = (node.getAttribute("title") || "").trim();
    if (title) {
        return title;
    }
    const ariaLabel = (node.getAttribute("aria-label") || "").trim();
    if (ariaLabel) {
        return ariaLabel;
    }
    if (checkPlaceholder) {
        const ph = (node.getAttribute("placeholder") || "").trim();
        if (ph) {
            return ph;
        }
    }
    return "";
}

/**
 * Read a human-readable tooltip string from a DOM element's attributes.
 *
 * The right-click target is frequently a decorative child element (e.g. a
 * Font Awesome <i> or a <span> inside a button) while the actual tooltip
 * attribute lives on the interactive parent or on a sibling/child of it.
 *
 * Strategy:
 *  1. Walk up from decorative elements to the nearest interactive ancestor
 *     (same logic as getCssSelector).
 *  2. Check the resolved "start" element's own attributes.
 *  3. Check start's DIRECT CHILDREN — this handles the Odoo form-label pattern
 *     where the `<sup data-tooltip-template … data-tooltip-info …>?</sup>` help
 *     icon is a child of `<label class="o_form_label">`, not an ancestor.
 *  4. Walk up to 5 more ancestor levels, checking attributes at each level.
 *
 * Attributes checked per element (in priority order):
 *   data-tooltip → data-tooltip-template (JSON parsed) → title → aria-label
 * placeholder is only checked on the originally clicked element (inputs).
 */
export function suggestTooltip(el) {
    if (!el) {
        return "";
    }

    // Step 1: resolve the interactive starting element.
    let start = el;
    if (DECORATIVE_TAGS.has(el.tagName)) {
        const interactive = el.closest(INTERACTIVE_SELECTOR);
        if (interactive) {
            start = interactive;
        }
    }

    // Step 2: check the start element itself.
    const startResult = readTooltipAttr(start, true);
    if (startResult) {
        return startResult;
    }

    // Step 3: check start's direct children.
    // Handles the Odoo form-label tooltip pattern:
    //   <label class="o_form_label">
    //     Field Name
    //     <sup data-tooltip-template="web.FieldTooltip"
    //          data-tooltip-info='{"field":{"help":"…"}}'>?</sup>
    //   </label>
    for (const child of start.children) {
        const childResult = readTooltipAttr(child, false);
        if (childResult) {
            return childResult;
        }
    }

    // Step 4: walk up the ancestor chain.
    let node = start.parentElement;
    for (let depth = 0; depth < 5 && node && node !== document.body; depth++, node = node.parentElement) {
        const result = readTooltipAttr(node, false);
        if (result) {
            return result;
        }
    }

    return "";
}
