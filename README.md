# Interactive User Guide & Tour Recorder (Odoo 17)

Record no-code interactive guides directly in the Odoo interface, assign them to
users, play them back through Odoo's **native** tour engine (animated pointer +
tooltips) and track each user's completion progress.

This is a **clean-room reimplementation for Odoo 17 Enterprise** of the
`custom_tour_recorder` app (originally sold for Odoo 19), rebuilt from its public
screenshots and description.

## Features

- **Systray "Record"** (managers only): start recording, **right-click** any UI
  element to capture a step (title, tooltip, position, "check only"), **left-click**
  to keep navigating normally. A live counter shows captured steps.
- **Save & manage**: name/describe the guide, then manage all guides from the
  systray **"Guides"** button — play ▶, edit steps ✎, or delete 🗑.
- **Edit Steps**: reorder steps and fine-tune CSS selectors, positions, run
  commands and tooltips.
- **Assignment & progress**: assign guides to users; the backend **Tour Recorder**
  app shows a **Steps** tab and a live **User Progress** tab
  (Not Started / In Progress / Completed with step counts).
- **Native playback**: guides run in Odoo's manual tour mode, ending with the
  usual rainbow-man "Tour completed!" effect.
- **Data-type validation**: a step can require the user's input to be a valid
  type before the tour will advance — *required, whole number, decimal, email,
  phone, URL, date, letters, letters+numbers,* or a **custom regex**. Wrong input
  shows an inline error and the tour is blocked until it's corrected. Configure it
  in the recording **Step Details** dialog or in **Edit Steps**.
- **Import / Export** (managers): back up or move guides between databases as a
  JSON file.
  - *Export*: in **Tour Recorder → Manage Tours**, select tours → **Action →
    Export Tours** → download the `.json` (includes all languages).
  - *Import*: **Tour Recorder → Import Tours** → upload a previously exported
    `.json`.
- **Multi-language** (English / Sinhala / Tamil): tour text (name, description,
  step titles, tooltips, validation messages) is translated per-record using
  Odoo's native field translation.
  - *Playback language*: each user sees the guide in **their own Odoo language**
    automatically; the **Guides** dialog has a *"Play in"* picker to override.
  - *Translating*: open **Edit Steps**, choose a language in the **Language**
    switcher, translate each step's text and **Save** (structure/selectors are
    shared across languages — edit those in your main language).
  - Sinhala (`si_LK`) and Tamil (`ta_IN`) are activated automatically on install;
    the recorder/player UI itself is translated via `i18n/` PO files.
- **Contextual / workflow guides** (managers): a guide can be **bound to a
  document model, a stage condition and a role** so the right guide reaches the
  right person on the right record. On the guide form (**Workflow Context**) set
  **Applies To** (e.g. *Repair Order*), an optional **For Role**, and a **Trigger
  Condition** domain (e.g. the record's current stage). When a user opens a
  matching record, a **non-blocking prompt** (*"A guide is available for this
  step — Show me"*) offers to play the guide right there. A multi-user workflow
  (a record passing between several roles) is modelled as **one contextual guide
  per stage**; each guide surfaces for its role when the record reaches that
  stage. Guides with no model set behave exactly as before.

## Install

1. Copy the `custom_tour_recorder/` folder into your odoo.sh repository's addons
   path (e.g. the repo root) and push.
2. In Odoo: **Apps → Update Apps List**, then install
   *Interactive User Guide & Tour Recorder*.
3. Grant users the security roles (Settings → Users):
   - **Tour Recorder / Manager** — record, edit, assign, delete, see all progress.
   - **Tour Recorder / User** — implied for every internal user; can play assigned
     guides. (The **Record** button only appears for Managers.)

## Models

| Model | Purpose |
|-------|---------|
| `tour.recorder` | A guide: name, description, assigned users, steps, progress |
| `tour.recorder.step` | One step: title, CSS selector, position, run, tooltip, check-only |
| `tour.recorder.progress` | Per-user status (not started / in progress / completed) |

## Odoo 17 porting notes

This module was written against Odoo **17.0** and deliberately differs from a
19.0 build:

- Views use `<tree>` and direct `invisible="…"` expressions (no `attrs`/`states`).
- Tours are registered dynamically in `registry.category("web_tour.tours")` and
  started with `tour_service.startTour(key, { mode: "manual" })`.
- Odoo 17 has **no `isCheck`** step property — "check only" steps are emulated with
  an empty `run: () => {}` (assert-visible, no interaction).
- There is no completion callback, so progress is derived by polling `tourState`
  (`currentIndex` / `getActiveTourNames`) from
  `@web_tour/tour_service/tour_state`.

> ⚠️ **Validate the tour internals on your exact 17.x point release.** The
> `tour_service` / `tourState` APIs are internal to `web_tour` and can shift
> between minor releases. If playback or progress ever stops working after an
> odoo.sh upgrade, check `addons/web_tour/static/src/tour_service/` first.

## Known limitations

- Auto-generated CSS selectors are best-effort; refine brittle ones in **Edit
  Steps**.
- A guide must be played from a screen where its first step's element exists
  (same as any Odoo tour).
