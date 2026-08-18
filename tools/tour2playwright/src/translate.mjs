// Translate Odoo tour step semantics into Playwright.
//
// Two independent concerns:
//   1. SELECTORS — Odoo triggers use jQuery-extended CSS (:contains, :visible,
//      :eq(n), :first/:last, :iframe …) which Playwright's engine does not
//      understand. We rewrite what we safely can and flag the rest.
//   2. RUN DSL — Odoo's `run` string ("click", "edit VALUE", "text VALUE",
//      "check", "select VALUE", …) maps to a Playwright action.
//
// Anything we cannot map faithfully is emitted with a `// TODO:` note so a
// human reviews it, rather than silently producing a broken test.

/** JS string literal escaping for values we inline into generated code. */
export function jsString(s) {
  return JSON.stringify(String(s == null ? "" : s));
}

/**
 * Convert a jQuery/Odoo selector into a Playwright locator expression.
 * Returns { expr, todos } where `expr` is a JS snippet evaluating to a Locator
 * (e.g. `page.locator("...")` possibly with `.first()`/`.nth(2)`), and `todos`
 * is an array of human-readable warnings.
 */
export function selectorToLocator(selector) {
  const todos = [];
  let sel = (selector || "").trim();

  if (!sel) {
    todos.push("empty selector — step has no trigger");
    return { expr: `page.locator("body")`, todos };
  }

  // Positional suffix modifiers we can express as Locator methods.
  // These are applied to the tail of the selector only.
  let tail = "";
  const applyTail = (method) => {
    tail += method;
  };

  // :first / :last
  sel = sel.replace(/:first\b/g, () => {
    applyTail(".first()");
    return "";
  });
  sel = sel.replace(/:last\b/g, () => {
    applyTail(".last()");
    return "";
  });
  // :eq(n)  /  :nth(n)
  sel = sel.replace(/:(?:eq|nth)\((\d+)\)/g, (_m, n) => {
    applyTail(`.nth(${n})`);
    return "";
  });

  // :contains('text') / :contains("text") / :contains(text)
  // → Playwright text engine  :has-text("text")
  let hasText = null;
  sel = sel.replace(/:contains\((['"]?)(.*?)\1\)/g, (_m, _q, txt) => {
    hasText = txt;
    return "";
  });

  // :visible — Playwright auto-waits for visibility on actions; drop it.
  sel = sel.replace(/:visible\b/g, "");
  // :hidden — cannot be actioned; flag.
  if (/:hidden\b/.test(sel)) {
    todos.push(":hidden pseudo cannot be actioned in Playwright — verify intent");
    sel = sel.replace(/:hidden\b/g, "");
  }

  // :iframe — Odoo uses this to descend into website/editor iframes.
  // Playwright needs frameLocator(); we cannot infer the frame boundary safely.
  if (/:iframe\b/.test(sel)) {
    todos.push(
      ":iframe in selector — use page.frameLocator(<iframe>) then .locator(rest); left as raw text"
    );
  }

  // Any remaining jQuery pseudo we don't handle (:has, :parent, :input …).
  const leftoverPseudo = sel.match(
    /:(has|parent|input|checked|selected|enabled|disabled|not|even|odd|gt|lt|header|animated|button|submit|text|password|radio|checkbox|file|image|reset)\b/g
  );
  if (leftoverPseudo) {
    todos.push(
      `unsupported jQuery pseudo(s) ${[...new Set(leftoverPseudo)].join(", ")} — verify selector`
    );
  }

  sel = sel.trim().replace(/\s{2,}/g, " ");

  let expr;
  if (hasText != null) {
    if (sel) {
      expr = `page.locator(${jsString(sel)}).filter({ hasText: ${jsString(hasText)} })`;
    } else {
      expr = `page.getByText(${jsString(hasText)})`;
    }
  } else {
    expr = `page.locator(${jsString(sel || "body")})`;
  }
  return { expr: expr + tail, todos };
}

/**
 * Parse an Odoo `run` string into an action descriptor.
 * Returns { kind, value } where kind is one of:
 *   click | fill | check | uncheck | select | hover | press | noop | manual
 */
export function parseRun(run, isCheck) {
  if (isCheck) return { kind: "noop", value: "" };
  const raw = (run == null ? "click" : String(run)).trim();
  if (!raw || raw === "click") return { kind: "click", value: "" };

  // "edit VALUE" / "text VALUE"  → fill
  let m = raw.match(/^(?:edit|text|edit_input)\s+([\s\S]+)$/i);
  if (m) return { kind: "fill", value: m[1] };

  // "select VALUE" / "selectByLabel VALUE" → selectOption
  m = raw.match(/^select(?:ByLabel|ByIndex)?\s+([\s\S]+)$/i);
  if (m) return { kind: "select", value: m[1] };

  m = raw.match(/^check$/i);
  if (m) return { kind: "check", value: "" };
  m = raw.match(/^uncheck$/i);
  if (m) return { kind: "uncheck", value: "" };

  m = raw.match(/^hover$/i);
  if (m) return { kind: "hover", value: "" };

  // "press KEY"
  m = raw.match(/^press\s+([\s\S]+)$/i);
  if (m) return { kind: "press", value: m[1] };

  // Editor-specific / drag / custom function bodies → needs a human.
  return { kind: "manual", value: raw };
}

/**
 * Produce the Playwright action statement(s) for a step.
 * @param {string} locExpr JS expression evaluating to a Locator
 * @param {object} step normalized step
 * @returns {{ code: string, todos: string[] }}
 */
export function actionFor(locExpr, step) {
  const todos = [];
  const { kind, value } = parseRun(step.run, step.is_check);

  switch (kind) {
    case "noop":
      // "Check only" — assert the element is visible, do not interact.
      return { code: `await expect(loc).toBeVisible();`, todos };
    case "click":
      return { code: `await loc.click();`, todos };
    case "fill":
      return { code: `await loc.fill(${jsString(value)});`, todos };
    case "select":
      return {
        code: `await loc.selectOption({ label: ${jsString(value)} }).catch(() => loc.selectOption(${jsString(value)}));`,
        todos,
      };
    case "check":
      return { code: `await loc.check();`, todos };
    case "uncheck":
      return { code: `await loc.uncheck();`, todos };
    case "hover":
      return { code: `await loc.hover();`, todos };
    case "press":
      return { code: `await loc.press(${jsString(value)});`, todos };
    case "manual":
    default:
      todos.push(
        `run "${value}" is not auto-translatable (Odoo tour DSL / custom fn) — implement manually`
      );
      return {
        code: `// TODO: implement action for run: ${value}\n    await expect(loc).toBeVisible();`,
        todos,
      };
  }
}
