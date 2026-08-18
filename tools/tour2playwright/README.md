# tour2playwright

Turn **Tour Recorder** guides into **Playwright end-to-end tests** and
**illustrated user manuals** — from the same JSON export.

```
Tour Recorder export (.json)
        │
        ├─►  generate  ─►  Playwright specs  (generated/specs/*.spec.ts)
        │                        │
        │                     npm test  ─►  screenshots  (generated/screenshots/…)
        │                        │
        └─►  manual  ────────────┴─►  Markdown manuals  (generated/manuals/*.md)
```

The pipeline goes **JSON → Playwright → manual** on purpose: running the flow both
**verifies the guide still works** and **captures a screenshot of every step**, which
the manuals embed. One manual is produced per language found in the export
(EN / SI / TA); screenshots are shared across languages.

Everything runs in Node/dev — this is **not** part of the Odoo module runtime.

## Prerequisites

- Node.js ≥ 18
- A reachable Odoo 17 instance to run tests against. **Use a staging / disposable
  database** — the specs perform real clicks and can create real records.

## Setup

```bash
cd tools/tour2playwright
npm install
npx playwright install chromium
cp .env.example .env      # then edit .env with your Odoo URL + credentials
```

`.env` keys:

| Key             | Meaning                                              |
| --------------- | ---------------------------------------------------- |
| `ODOO_URL`      | Origin of the Odoo instance (no trailing slash)      |
| `ODOO_DB`       | Database name (blank if the instance auto-selects)   |
| `ODOO_LOGIN`    | Login used to establish the Playwright session       |
| `ODOO_PASSWORD` | Password for that login                              |
| `ODOO_START_PATH` | *(optional)* landing path for specs (default `/web`) |

## Get a tour export

In Odoo: **Tour Recorder → Manage Tours →** select tours **→ Action → Export Tours**,
and download the `.json`.

## Usage

```bash
# 1) Generate Playwright specs from the export
npm run gen -- ../path/to/tour_export.json

# 2) Run them against Odoo — verifies the flow AND captures per-step screenshots
npm test

# 3) Build the illustrated manuals (uses the screenshots from step 2)
npm run manual -- ../path/to/tour_export.json

# …or do all three at once:
npm run build -- ../path/to/tour_export.json
```

Outputs (all under `generated/`, git-ignored):

- `specs/<tour>.spec.ts` — one Playwright test per tour
- `screenshots/<tour>/step-NN.png` — captured during `npm test`
- `manuals/<tour>.<lang>.md` — one manual per language
- `report/` — Playwright's HTML report
- `REVIEW.md` — every selector/action that couldn't be auto-translated (see below)

## Known limitations — read `generated/REVIEW.md`

Odoo tour steps don't all map 1:1 onto Playwright, so the generator is best-effort and
flags what it can't translate faithfully with `// TODO:` comments (collected in
`generated/REVIEW.md`):

- **jQuery-extended selectors.** `:contains('x')` → `.filter({ hasText })`,
  `:eq(n)`/`:first`/`:last` → `.nth(n)`/`.first()`/`.last()`, `:visible` is dropped
  (Playwright auto-waits on visibility). `:iframe`, `:has`, and other jQuery pseudos
  are left literal and flagged — fix them by hand.
- **Run DSL.** `click`, `edit/text VALUE` (→ `fill`), `check`/`uncheck`, `select VALUE`,
  `hover`, `press KEY`, and "Check only" (→ `expect(...).toBeVisible()`) are mapped.
  Editor/drag/custom-function runs become a `// TODO` stub asserting visibility.
- **Start point.** Specs open `ODOO_START_PATH` (default `/web`). If a guide begins on
  a specific screen, set that path or add a `page.goto(...)` at the top of the spec.
- **Localized screenshots.** Screenshots are captured once (in the run's UI language)
  and reused for every language's manual. Per-language screenshots would require
  re-running with each user language — a future enhancement.

Treat generated specs as a **strong first draft**: review `REVIEW.md`, fix flagged
steps, then keep them as regression tests.
