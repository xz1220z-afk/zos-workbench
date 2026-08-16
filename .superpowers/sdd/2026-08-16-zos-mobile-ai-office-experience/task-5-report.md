# Task 5 Report — Mobile High-Frequency Flows

## Status

Completed as an incremental mobile-flow refinement. No business collections, Vault, Feishu, production data, framework, version number, or new static browser module were changed.

## Delivered

- Tasks: mobile quick filters are limited to `今日`、`逾期`、`我创建的`; complete status filters are in an accessible disclosure. Tapping a task card uses the existing task drawer, including local Agent-task context.
- Calendar: `month` remains the default. Mobile date tap opens a selected-day bottom sheet; the sheet reuses existing event detail/edit/delete actions and can create an arrangement. Touch long-press on a local task opens its existing action preview; desktop pointer-drag selection remains available.
- Intelligence: filter controls are in a mobile disclosure while question/read/source/task-draft actions remain reachable in the same cards/drawer. Existing question error state retains the question text and retry path.
- More: `index.html` now contains only the three group mount points. `src/app.mjs` dynamically renders `business`, `knowledge-ai`, and `personal-system` through `buildMobileMoreGroups()` and marks preferred entries without a second hard-coded route list.
- Motion: no `transition: all` was introduced; existing reduced-motion rules continue to apply. No new static module was introduced, so no service-worker precache change is required.

## TDD evidence

### RED

Command: `node --test tests/mobile-high-frequency-flows.test.mjs`

Result: exit `1`; expected assertion failure because `index.html` did not contain `data-mobile-more-group="business"` (the first missing dynamic More-group hook).

### GREEN

Command: `node --test tests/mobile-high-frequency-flows.test.mjs tests/task-center.test.mjs tests/calendar-default-month.test.mjs tests/calendar-view.test.mjs tests/intelligence-view.test.mjs tests/intelligence-question-actions.test.mjs tests/intelligence-responsive-layout.test.mjs tests/mobile-navigation.test.mjs tests/calendar-selection-integration.test.mjs`

Result: exit `0`; `35/35` passing.

Additional checks passed: `node --check src/app.mjs`, `node --check src/app/views/task-view.mjs`, `node --check src/app/views/calendar-view.mjs`, `node --check src/app/views/intelligence-view.mjs`, and `git diff --check`.

## Full-suite note

`node --test tests/*.test.mjs` completed with `665/670` passing. The 5 failures are pre-existing static-contract tests that expect all More routes to be repeated in `index.html`, or expect retired bottom-nav labels (`添加` / `专注`). This task deliberately replaces the duplicated static More-route list with the required dynamic `buildMobileMoreGroups()` renderer and preserves the current approved bottom navigation. The brief-directed regression suite is green; the stale historical assertions need coordinated baseline updates outside this task’s requested test set.

## Fix round 1/5 — Important findings

### TDD RED

Command: `node --test tests/mobile-high-frequency-flows.test.mjs`

Result: exit `1`, with four intended behavioral failures:

- mobile intelligence disclosure did not retain `open` across a `setIntelligenceFilter()` redraw;
- selected-day sheet was empty for a visible recurring occurrence / later day of a multi-day event;
- `我创建的` admitted both an explicit other creator and an unknown creator;
- delegated dynamic More navigation called `navigateTo(page)` without `{ focusPage: true }`.

### Implementation and GREEN

- Intelligence now records `details[data-intelligence-filters]` toggle state in runtime, renders it back after a filter redraw, and restores the active search/select focus plus text selection without scrolling. The card question, read, safe source link, task-draft, error/retry paths remain in the existing card/drawer.
- The calendar day sheet receives the existing `calendarLayout` and selects its `day.events` / list group directly, so recurrence expansion and multi-day coverage match the visible calendar.
- Dynamic More buttons carry `data-mobile-more-item`; its delegated branch requests the legacy page handoff with `{ focusPage: true }`, so the closing/replaced menu control is not retained as focus.
- The task quick filter now accepts only an explicit `creatorId`, `createdBy`, or legacy persisted `deviceId` equal to the actual local device id. Explicit creator fields take precedence; records with no owner identity are excluded.
- Added event-level touch long-press coverage: `pointerdown` → 450 ms threshold → existing detail preview, plus `pointercancel` cancellation. This is covered in the Node harness; no remaining browser-only acceptance item is required.
- Updated four genuinely stale static More/bottom-navigation assertions to validate the dynamic `buildMobileMoreGroups()` route model, the current five labels, retained routes, and explicit focus handoff. No old routes were removed from the navigation contract.

GREEN commands:

```sh
node --test tests/mobile-high-frequency-flows.test.mjs tests/task-center.test.mjs tests/calendar-default-month.test.mjs tests/calendar-view.test.mjs tests/calendar-selection.test.mjs tests/calendar-selection-integration.test.mjs tests/intelligence-view.test.mjs tests/intelligence-question-actions.test.mjs tests/intelligence-responsive-layout.test.mjs tests/mobile-navigation.test.mjs tests/navigation-preferences.test.mjs tests/v2-app-actions.test.mjs
# 61/61 passing

node --test tests/command-center-ui.test.mjs tests/v1.3-ui.test.mjs tests/v1.4-ui.test.mjs tests/v1.7-ui.test.mjs tests/mobile-high-frequency-flows.test.mjs tests/mobile-navigation.test.mjs
# 32/32 passing

node --test tests/*.test.mjs
# 676/676 passing
```

`git diff --check` passed. Version remains `2.9.0`; no static module was added, so the service-worker precache manifest did not need a change.

### Deferred deployment boundary

The existing v2.9.0 service worker is cache-first for the changed module URLs. The required Task 7 atomic `2.10.0` version/cache/import upgrade is therefore the release gate for already-installed PWA clients to receive this source fix. This Task intentionally does not change that version/cache boundary, per scope constraint.
