# ZOS CEO OS Decision Center Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reclassify the inflated decision queue into CEO decisions, owner follow-ups, and resolved history without deleting or migrating user data.

**Architecture:** Add one pure decision-classification boundary in `decision-center.mjs` and make every consumer use it. Keep the persisted lifecycle untouched, render bounded sections in the decision center, and bump browser assets to v2.0.3 so GitHub Pages and the service worker update coherently.

**Tech Stack:** Browser ES modules, Node.js built-in test runner, static GitHub Pages PWA.

## Global Constraints

- Do not delete or rewrite existing decision records.
- Do not modify Feishu ERP source data.
- Preserve the current decision status machine and sync/tombstone behavior.
- Only CEO decisions count in navigation, dashboard, brief, review, priority, and mobile summaries.
- Limit DOM rendering for follow-up and history collections.
- Release version is `2.0.3`.

---

### Task 1: Pure Decision Classification

**Files:**
- Modify: `src/app/decision-center.mjs`
- Test: `tests/decision-center.test.mjs`

**Interfaces:**
- Produces: `classifyDecision(item) -> 'ceo' | 'follow_up' | 'history'`
- Produces: `partitionDecisions(items) -> { ceo, followUp, history }`
- Consumes: existing persisted decision fields only.

- [ ] **Step 1: Write failing tests**

Add tests proving that `pending_resolution` becomes history, normal stale/unfinished work becomes follow-up, payment/high-risk/explicit CEO items become CEO decisions, and partitioning does not mutate the input.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/decision-center.test.mjs`

Expected: FAIL because `classifyDecision` and `partitionDecisions` are not exported.

- [ ] **Step 3: Implement minimal classifier**

Use explicit overrides first, then lifecycle, category, and normalized keyword rules. Return new arrays without modifying records.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/decision-center.test.mjs`

Expected: all decision-center tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat: classify decision center queues`

### Task 2: Unify Every Decision Consumer

**Files:**
- Modify: `src/app/views/decision-view.mjs`
- Modify: `src/app/views/dashboard-view.mjs`
- Modify: `src/app/views/mobile-view.mjs`
- Modify: `src/app/review-center.mjs`
- Modify: `src/app/priority-engine.mjs`
- Modify: `src/app/daily-brief.mjs`
- Modify: `src/app.mjs`
- Test: `tests/decision-center.test.mjs`
- Test: relevant dashboard, brief, review, and priority tests.

**Interfaces:**
- Consumes: `partitionDecisions(items)` from Task 1.
- Produces: all CEO counts and lists based only on `partition.ceo`.

- [ ] **Step 1: Write failing consumer tests**

Assert that dashboard, badge, mobile summary, review facts, daily brief, and priority candidates exclude follow-up/history records. Assert that decision center renders three counts and bounded history.

- [ ] **Step 2: Verify RED**

Run targeted tests and confirm old `open + pending_resolution` logic fails the new expectations.

- [ ] **Step 3: Implement minimal consumer changes**

Import the shared classifier and replace local status filters. Render CEO cards first, follow-up cards second, history cards last; only CEO cards retain preview actions.

- [ ] **Step 4: Verify GREEN**

Run targeted tests and confirm zero failures.

- [ ] **Step 5: Commit**

Commit message: `feat: separate ceo decisions from follow-up history`

### Task 3: Release Version and Responsive Styling

**Files:**
- Modify: `index.html`
- Modify: `manifest.json`
- Modify: `sw.js`
- Modify: `src/*.mjs` version query references touched by this release
- Modify: `styles/*.css` if needed for decision sections
- Test: PWA/module graph and responsive contract tests.

**Interfaces:**
- Produces: consistent v2.0.3 browser asset graph.

- [ ] **Step 1: Add or update failing release assertions**

Require v2.0.3 in the shell, manifest, service worker cache, and imported module graph.

- [ ] **Step 2: Verify RED**

Run the release/PWA tests and confirm they fail on v2.0.2.

- [ ] **Step 3: Update versioned assets and bounded responsive layout**

Change only the necessary version references and decision-center styles.

- [ ] **Step 4: Verify GREEN**

Run release/PWA/responsive tests and confirm zero failures.

- [ ] **Step 5: Commit**

Commit message: `chore: release decision cleanup v2.0.3`

### Task 4: Three-Round Acceptance and Production Release

**Files:**
- Create: `docs/zos-ceo-os-v2.0.3-production-acceptance.md`

**Interfaces:**
- Consumes: completed v2.0.3 tree.
- Produces: auditable local and production evidence.

- [ ] **Step 1: Acceptance round one**

Run all automated tests, syntax checks, and `git diff --check`.

- [ ] **Step 2: Acceptance round two**

Serve locally and inspect decision center on desktop, tablet, and phone. Verify non-empty content, no horizontal overflow, bounded DOM, and console errors equal zero.

- [ ] **Step 3: Merge and push**

Merge the clean feature branch into `main`, rerun the full suite, push `main`, and wait for GitHub Pages to publish.

- [ ] **Step 4: Acceptance round three**

Read back production `index.html`, `manifest.json`, `sw.js`, `src/app.mjs`, and decision modules as HTTP 200/v2.0.3. Recheck desktop, tablet, and phone decision center plus dashboard badge.

- [ ] **Step 5: Record and tag**

Write the acceptance report, commit and push it, then create and push tag `zos-workbench-v2.0.3`.
