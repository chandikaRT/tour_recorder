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
