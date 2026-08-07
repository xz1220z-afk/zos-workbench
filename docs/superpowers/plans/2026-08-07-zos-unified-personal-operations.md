# ZOS Unified Personal Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver v2.1.0 with durable batch decision handling, a useful private life dashboard, source-aware three-company operating pages, privacy-safe ritual reminders, and newest-first intelligence filtering.

**Architecture:** Keep domain behavior in focused pure ES modules and render all UI from the existing application view model. Reuse the current state store, Supabase private sync, business caches, PWA shell, and truth boundaries; add no framework and no new external dependency.

**Tech Stack:** Browser-native ES modules, static HTML/CSS, Node.js `node:test`, existing local state store and Supabase sync.

## Global Constraints

- Target version is `2.1.0`.
- Preserve IDs, revisions, tombstones, backups, restores, live-over-tombstone merge rules, and current private sync.
- Never bulk-write Feishu or upload Obsidian note bodies.
- Do not delete or move Vault content.
- Preserve root worktree files `.superpowers/` and `package-lock.json`.
- New behavior must be test-first and every focused test must be observed failing before production code is added.
- Release only after three complete acceptance passes.

---

### Task 1: Batch Decision Domain and UI

**Files:**
- Modify: `src/app/decision-center.mjs`
- Modify: `src/app/views/decision-view.mjs`
- Modify: `src/app.mjs`
- Modify: `assets/app.css`
- Test: `tests/decision-center.test.mjs`
- Create: `tests/decision-batch-ui.test.mjs`
- Test: `tests/app-composition.test.mjs`

**Interfaces:**
- Produces: `reviewDecisionHistory(decision, options)`, `applyDecisionBatch(decisions, action, note, options)`.
- Produces view-model state: `decisionUi.selectedIds`, `decisionUi.batchBusy`, `decisionUi.batchError`.

- [ ] Write failing domain tests proving history review preserves status/identity, reopen affects only `pending_resolution` and `deferred`, and mixed selections report skipped IDs.
- [ ] Run `node --test tests/decision-center.test.mjs` and verify the new tests fail because the batch APIs do not exist.
- [ ] Implement `reviewDecisionHistory` with `historyReviewedAt` and `historyReviewed: true`, and implement `applyDecisionBatch` as a pure planner returning `{ changed, skipped }` without mutating inputs.
- [ ] Run the focused domain test and require it to pass.
- [ ] Write failing renderer/application tests for row checkboxes, select-visible, sticky action bar, batch review, batch reopen, clear selection, error retention, and multi-record undo.
- [ ] Run `node --test tests/decision-batch-ui.test.mjs tests/app-composition.test.mjs` and verify failures are caused by missing batch controls/actions.
- [ ] Add selection state and delegated click/change handling to `src/app.mjs`; save each changed record through the existing state store, retain all `before` records for undo, signal one local change, and never call the Feishu write path.
- [ ] Render history checkboxes and batch controls in `decision-view.mjs`; only visible filtered history IDs participate in select-visible.
- [ ] Add 44px selection and batch-bar styles, mobile stacking, press/focus states and reduced-motion support.
- [ ] Re-run the focused tests and require all to pass.
- [ ] Commit with `git commit -m "feat: add batch decision review"`.

---

### Task 2: Ritual Calendar and Privacy-Safe Date Import

**Files:**
- Create: `src/app/ritual-calendar.mjs`
- Create: `src/app/private-date-import.mjs`
- Modify: `src/app/views/life-view.mjs`
- Modify: `src/app/life-os.mjs`
- Modify: `src/app.mjs`
- Modify: `assets/app.css`
- Create: `tests/ritual-calendar.test.mjs`
- Create: `tests/private-date-import.test.mjs`
- Modify: `tests/important-dates-view.test.mjs`

**Interfaces:**
- Produces: `upcomingRituals({ now, horizonDays, ignoredIds })`.
- Produces: `parsePrivateDateMetadata(input)` returning only `{ title, date, monthDay, category, reminderDays, recurring, privacy }` records.
- Produces view-model fields: `rituals`, `lifeNextSevenDays`, `privateDateSource`.

- [ ] Write failing tests for recurring month-day calculation, year rollover, lead-day calculation, ignored reminders, and deterministic chronological order.
- [ ] Write failing privacy tests that accept whitelisted date metadata and reject note bodies, contact details, unknown fields, non-private values, invalid dates and oversized imports.
- [ ] Run the two new test files and verify RED for missing modules.
- [ ] Implement a compact static ritual library and pure date calculation without third-party dependencies.
- [ ] Implement strict JSON metadata parsing with an allowlist, maximum 200 records, title length limit, forced `privacy: "private"`, and no preservation of unknown fields.
- [ ] Run the two new test files and require GREEN.
- [ ] Write failing life-view tests for the 7-day agenda, ritual cards, convert/ignore controls, six life domains, import privacy note, and useful empty states.
- [ ] Add view-model derivation and delegated actions: ignore a ritual locally, convert it to a private life task, and import selected JSON through an ephemeral file input.
- [ ] Render the new Life OS sections while keeping private titles out of the work dashboard.
- [ ] Add responsive life-dashboard and ritual-card styles.
- [ ] Run focused life tests and require GREEN.
- [ ] Commit with `git commit -m "feat: add private ritual planning"`.

---

### Task 3: Three-Company Operating Cockpits

**Files:**
- Create: `src/app/company-cockpit.mjs`
- Create: `src/app/views/company-cockpit-view.mjs`
- Modify: `src/app/views/lingli-view.mjs`
- Modify: `src/app.mjs`
- Modify: `index.html`
- Modify: `assets/app.css`
- Create: `tests/company-cockpit.test.mjs`
- Create: `tests/company-cockpit-view.test.mjs`
- Modify: `tests/company-operating-contract.test.mjs`

**Interfaces:**
- Consumes: `companyOperating`, source health, source records, company intelligence and current decisions.
- Produces: `buildCompanyCockpit(company, input)` with `summary`, `analysis`, `risks`, `intelligence`, `source`.

- [ ] Write failing pure-domain tests for the exact Wanjia, Huahuo and Lingli module sets and for truthful unavailable metrics.
- [ ] Run `node --test tests/company-cockpit.test.mjs` and verify RED.
- [ ] Implement source-aware cockpit derivation without inventing values or issuing network requests.
- [ ] Run the domain test and require GREEN.
- [ ] Write failing renderer tests for the three-tier headings, company-specific modules, data freshness, source gaps, and existing merchant/availability entry anchors.
- [ ] Add `wanjiaOperatingRoot` and `huahuoOperatingRoot`, reuse `lingliCenterRoot`, and render all three from the same pure view with company-specific labels.
- [ ] Preserve current merchant 360, availability query, raw record lists and source rails as level-three evidence.
- [ ] Add responsive KPI, analysis, risk and source-status styles.
- [ ] Run all company-focused tests and require GREEN.
- [ ] Commit with `git commit -m "feat: expand company operating cockpits"`.

---

### Task 4: Newest-First Intelligence Workbench

**Files:**
- Modify: `src/app/intelligence-center.mjs`
- Modify: `src/app/views/intelligence-view.mjs`
- Modify: `src/app.mjs`
- Modify: `assets/app.css`
- Modify: `tests/intelligence-center.test.mjs`
- Modify: `tests/intelligence-view.test.mjs`

**Interfaces:**
- Produces: `filterIntelligence(items, filters)` and `sortIntelligence(items, sortBy)`.
- Produces runtime filters: `company`, `source`, `credibility`, `status`, `age`, `search`, `sortBy`.

- [ ] Write failing tests proving the default is newest-first, invalid/missing dates sort last, score and credibility sorts are stable, and all filters combine with search.
- [ ] Run `node --test tests/intelligence-center.test.mjs` and verify RED.
- [ ] Implement normalization-safe filtering and stable sorting; keep `todayMustRead` capped to 72 hours.
- [ ] Run the domain test and require GREEN.
- [ ] Write failing renderer/application tests for search, five filters, three sorts, result count, reset, unread emphasis, ignore and action transitions.
- [ ] Replace the single company-only filter with the complete toolbar and bind input/change/click events in the application coordinator.
- [ ] Keep source URLs protocol-validated and keep the full list bounded to 100 records.
- [ ] Add compact desktop and mobile filter layouts.
- [ ] Run focused intelligence tests and require GREEN.
- [ ] Commit with `git commit -m "feat: add intelligence filtering and recency"`.

---

### Task 5: Version, PWA Graph, Regression and Release

**Files:**
- Modify: `index.html`
- Modify: `manifest.json`
- Modify: `sw.js`
- Modify: all changed browser import query versions under `src/`
- Modify: `CHANGELOG.md`
- Create: `docs/zos-ceo-os-v2.1.0-production-acceptance.md`
- Modify: version and PWA tests under `tests/`

**Interfaces:**
- Produces a coherent v2.1.0 static asset graph and production acceptance record.

- [ ] Write or update failing release tests requiring v2.1.0 in shell, manifest, service worker and every transitive browser import.
- [ ] Run the release/PWA tests and verify RED on v2.0.4.
- [ ] Bump the complete asset graph to v2.1.0 and update the changelog.
- [ ] Run release/PWA tests and require GREEN.
- [ ] Run `node --test tests/*.test.mjs`, then `node --check` on changed modules and service worker.
- [ ] Perform three acceptance passes at desktop 1440×900, tablet 1024×768 and phone 390×844 for decision, life, three company pages and intelligence; require non-empty content, no horizontal overflow and console errors = 0.
- [ ] Merge only the reviewed feature commits to `main`, push, and verify GitHub Pages deployment.
- [ ] Read back production `index.html`, `manifest.json`, `sw.js` and changed versioned modules; require HTTP 200 and v2.1.0.
- [ ] Create and push tag `zos-workbench-v2.1.0` only after production verification.
- [ ] Record exact test count, commit, production version and three-size results in the acceptance document.

## Self-Review

- Spec coverage: every approved module maps to one task; privacy and truth boundaries are repeated in global constraints and the relevant tasks.
- Placeholder scan: no `TBD`, `TODO`, “implement later”, or unspecified error-handling steps remain.
- Interface consistency: batch, ritual, importer, company cockpit and intelligence APIs are named once and consumed only after production in their defining task.
- Release safety: no production claim is allowed before remote asset readback and three acceptance passes.
