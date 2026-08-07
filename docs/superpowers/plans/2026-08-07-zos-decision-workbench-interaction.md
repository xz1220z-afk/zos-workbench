# ZOS Decision Workbench Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the ZOS decision center into an actionable, durable CEO inbox and apply a restrained, consistent premium interaction system across desktop, tablet, and phone.

**Architecture:** Keep decision rules in the existing pure decision domain module, add one operating-loop setter so user decisions survive refreshes, and let the application coordinator own drawers, undo, persistence, and sync signaling. The view remains a pure renderer driven by explicit view-model state, while CSS supplies shared motion, focus, and tactile tokens without changing the information architecture.

**Tech Stack:** Browser-native ES modules, Node.js `node:test`, static HTML/CSS, existing local state store, Supabase private sync, existing Feishu preview/approval client.

## Global Constraints

- Target version is `2.0.4`.
- Do not delete or migrate existing decision records.
- Do not modify Feishu ERP facts unless the user separately previews and confirms the existing single-field write flow.
- Preserve current IDs, revisions, tombstones, backup, restore, and sync semantics.
- Initial DOM limits are 6 owner records and 6 history records; each load-more action adds 12.
- All interactive targets are at least 44px on touch layouts.
- Motion uses only opacity and transform, and honors `prefers-reduced-motion`.
- Preserve user-owned untracked `.superpowers/` and `package-lock.json`.

---

### Task 1: Decision Action Domain

**Files:**
- Modify: `src/app/decision-center.mjs`
- Modify: `src/app/operating-loop.mjs`
- Test: `tests/decision-center.test.mjs`
- Test: `tests/v1.3-integration.test.mjs`

**Interfaces:**
- Consumes: existing `transitionDecision(decision, nextStatus, note, options)` and record metadata callbacks.
- Produces: `applyDecisionAction(decision, action, note, options)` and `operatingLoop.updateDecision(decision)`.

- [ ] **Step 1: Write failing domain tests**

Add literal behavior tests for all supported actions:

```js
test('decision actions approve, delegate, defer, resolve, reopen and escalate without deleting identity', () => {
  const callbacks = { touchRecord: (value) => ({ ...value, revision: 2 }) };
  const open = { id: 'd1', status: 'open', decisionScope: 'ceo', requiresCeoDecision: true };
  assert.equal(applyDecisionAction(open, 'approve', '按建议推进', { now: NOW, ...callbacks }).status, 'approved');
  assert.deepEqual(
    applyDecisionAction(open, 'delegate', '交阿涛跟进', { now: NOW, ...callbacks }),
    { ...open, status: 'open', decisionScope: 'owner', requiresCeoDecision: false, decisionNote: '交阿涛跟进', revision: 2 },
  );
  assert.equal(applyDecisionAction(open, 'defer', '下周再看', { now: NOW, ...callbacks }).status, 'deferred');
  assert.equal(applyDecisionAction({ ...open, status: 'pending_resolution' }, 'resolve', '确认解除', { now: NOW, ...callbacks }).status, 'resolved');
  assert.equal(applyDecisionAction({ ...open, status: 'pending_resolution' }, 'reopen', '仍需处理', { now: NOW, ...callbacks }).status, 'open');
  assert.equal(applyDecisionAction({ ...open, status: 'deferred' }, 'reopen', '提前恢复', { now: NOW, ...callbacks }).status, 'open');
  assert.equal(applyDecisionAction({ ...open, decisionScope: 'owner' }, 'escalate', '需要朱帅拍板', { now: NOW, ...callbacks }).decisionScope, 'ceo');
});
```

Add negative tests proving invalid action/status pairs fail and empty IDs are never accepted.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test tests/decision-center.test.mjs tests/v1.3-integration.test.mjs
```

Expected: failure because `applyDecisionAction` and `updateDecision` do not exist.

- [ ] **Step 3: Implement the minimal domain action API**

Implement an explicit action switch:

```js
export function applyDecisionAction(decision, action, note = '', options = {}) {
  const next = requiredText(action, 'decision action');
  if (next === 'approve') return transitionDecision(decision, 'approved', note, options);
  if (next === 'defer') return transitionDecision(decision, 'deferred', note, options);
  if (next === 'resolve') return transitionDecision(decision, 'resolved', note, options);
  if (next === 'reopen') return transitionDecision(decision, 'open', note, options);
  const { touchRecord } = callbacks(options);
  if (next === 'delegate' && decision.status === 'open') return touchRecord({
    ...decision, decisionScope: 'owner', requiresCeoDecision: false, decisionNote: String(note || '').trim(),
  }, { now: requiredText(options.now, 'now'), deviceId: options.deviceId || 'decision-engine' });
  if (next === 'escalate' && decision.status === 'open') return touchRecord({
    ...decision, decisionScope: 'ceo', requiresCeoDecision: true, decisionNote: String(note || '').trim(),
  }, { now: requiredText(options.now, 'now'), deviceId: options.deviceId || 'decision-engine' });
  throw new Error(`invalid decision action: ${next}`);
}
```

Add `updateDecision(decision)` to the operating loop, replacing only the matching ID and returning a clone.

The lifecycle must explicitly allow `deferred -> open`, because reopening a deferred decision is part of the approved history workflow.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same focused test command and require all tests to pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/app/decision-center.mjs src/app/operating-loop.mjs tests/decision-center.test.mjs tests/v1.3-integration.test.mjs
git commit -m "feat: add durable decision actions"
```

---

### Task 2: Actionable Decision Inbox and Undo

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/app/views/decision-view.mjs`
- Test: `tests/app-composition.test.mjs`
- Test: `tests/dashboard-production-fixes.test.mjs`

**Interfaces:**
- Consumes: `applyDecisionAction`, `operatingLoop.updateDecision`, `store.saveEntity`, and existing `previewDecision`.
- Produces: application methods `openDecisionAction`, `confirmDecisionAction`, `undoDecisionAction`, `setDecisionFilter`, `loadMoreDecisions`, and view-model fields under `runtime.decisionUi`.

- [ ] **Step 1: Write failing renderer tests**

Create fixtures with one CEO decision, one owner decision, and 20 history rows. Assert:

```js
assert.match(html, /data-decision-action="approve"/);
assert.match(html, /data-decision-action="delegate"/);
assert.match(html, /data-decision-action="defer"/);
assert.match(html, /data-decision-source="ceo"/);
assert.equal((html.match(/class="decision-history-row/g) || []).length, 6);
assert.match(html, /data-decision-load-more="history"/);
assert.match(html, /role="dialog"/);
```

Add a pending-resolution fixture and assert `resolve` and `reopen` controls exist, while owner/history cards never render the Feishu preview action.

- [ ] **Step 2: Write failing application tests**

Use the real fake store and operating-loop stub to prove:

- approving moves a CEO decision to history immediately;
- delegating moves it to owner follow-up and updates both the store and operating loop;
- undo writes a newer revision restoring the exact pre-action business fields;
- a failed save leaves the drawer open and exposes an inline safe error;
- repeated confirmation while busy saves once.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
node --test tests/app-composition.test.mjs tests/dashboard-production-fixes.test.mjs
```

Expected: failure because the actions, drawer, undo, and DOM limits are missing.

- [ ] **Step 4: Implement application coordination**

Add explicit runtime state:

```js
decisionUi: {
  action: null, busy: false, error: null, search: '', company: 'all', status: 'all',
  followUpLimit: 6, historyLimit: 6, undo: null,
},
```

On confirmation, capture the complete `before` record, call `applyDecisionAction`, save through `store.saveEntity`, call `operatingLoop.updateDecision(saved)` when connected, signal local change, and render. Undo must save the previous business fields as a newer revision rather than replacing the snapshot or deleting anything. Cancel the undo timeout in `stop()`.

- [ ] **Step 5: Implement the pure decision inbox renderer**

Render:

- clickable summary buttons that jump to the matching section;
- CEO cards with four clear actions;
- owner cards with “转回待我决策” and source details;
- compact history rows limited by view-model counts;
- a right-side drawer / mobile bottom sheet driven entirely by `decisionUi.action`;
- a local notification with an 8-second undo button;
- inline errors beside the drawer confirmation action.

Search and filter before slicing. Never call network or mutate records from the renderer.

- [ ] **Step 6: Bind click, input, Escape, and source actions**

Route all `data-decision-*` controls in the existing delegated listeners. Source links use only validated `http:` or `https:` URLs; otherwise open the source-detail drawer. Add `input` handling for search and `keydown` handling for Escape.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run the same focused command and require all tests to pass.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/app.mjs src/app/views/decision-view.mjs tests/app-composition.test.mjs tests/dashboard-production-fixes.test.mjs
git commit -m "feat: make decision center actionable"
```

---

### Task 3: Premium Interaction Foundation

**Files:**
- Modify: `assets/app.css`
- Modify: `tests/v1.3-ui.test.mjs`
- Create: `tests/decision-interaction-ui.test.mjs`

**Interfaces:**
- Consumes: semantic classes and data attributes from Task 2.
- Produces: shared CSS tokens and responsive styles for tactile buttons, interactive cards, drawers, history rows, notification, focus, loading, and reduced motion.

- [ ] **Step 1: Write failing UI contract tests**

Read the stylesheet and assert behavior-bearing selectors exist:

```js
assert.match(css, /--motion-fast:\s*140ms/);
assert.match(css, /\.v13-action:active[^}]*transform:\s*scale\(\.98\)/s);
assert.match(css, /:focus-visible[^}]*outline/s);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.decision-action-drawer/);
assert.match(css, /min-height:\s*44px/);
```

Also render 343 history fixtures and assert only 6 history rows enter the HTML before load-more.

- [ ] **Step 2: Run UI tests and verify RED**

```bash
node --test tests/v1.3-ui.test.mjs tests/decision-interaction-ui.test.mjs
```

Expected: failure because the shared interaction tokens and decision surfaces are absent.

- [ ] **Step 3: Implement restrained global interaction tokens**

Add motion/elevation/focus variables and apply them to buttons, navigation, interactive rows, cards, and overlays. Use warm gold only for the primary action and critical attention; preserve the current dark CEO palette. Keep transforms to 2px lift / 0.98 press and avoid animating layout properties.

- [ ] **Step 4: Implement responsive decision surfaces**

Desktop uses a right drawer; mobile uses a bottom sheet. History uses a compact list. Add 44px touch targets, three-line clamping, clear disabled/busy states, local error treatment, and reduced-motion overrides.

- [ ] **Step 5: Run UI and full tests**

```bash
node --test tests/v1.3-ui.test.mjs tests/decision-interaction-ui.test.mjs
node --test tests/*.test.mjs
```

Expected: all tests pass, no warnings or unhandled rejections.

- [ ] **Step 6: Commit Task 3**

```bash
git add assets/app.css tests/v1.3-ui.test.mjs tests/decision-interaction-ui.test.mjs
git commit -m "feat: add premium interaction foundation"
```

---

### Task 4: Version, Regression, Three-Pass Acceptance, and Release

**Files:**
- Modify: version references in `index.html`, `manifest.json`, `sw.js`, `src/**/*.mjs`, and tests through the repository's existing version update pattern.
- Create: `docs/zos-ceo-os-v2.0.4-production-acceptance.md`

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: v2.0.4 release commit, successful GitHub Pages deployment, production verification, and release tag `zos-workbench-v2.0.4`.

- [ ] **Step 1: Update cache/version references to 2.0.4**

Run the repository-scoped mechanical replacement, then inspect every changed file. Do not include `.superpowers/` or `package-lock.json`.

```bash
rg -l '2\.0\.3' index.html manifest.json sw.js src tests | xargs perl -pi -e 's/2\.0\.3/2.0.4/g'
rg -n '2\.0\.3|2\.0\.4' index.html manifest.json sw.js src tests
```

- [ ] **Step 2: Run acceptance pass 1 — automated behavior**

```bash
node --test tests/*.test.mjs
node --check src/app.mjs
node --check src/legacy-app.mjs
git diff --check
```

Require zero failures.

- [ ] **Step 3: Run acceptance pass 2 — local visual and interaction**

At 1440×900, 1024×768, and 390×844 verify:

- CEO, owner, and history sections render non-empty;
- CEO action drawer opens and closes;
- history initial DOM count is 6 and load-more adds 12;
- no horizontal overflow;
- console error count is zero;
- pressing buttons produces visible busy/success feedback;
- reduced-motion mode removes transforms/transitions.

- [ ] **Step 4: Commit the release candidate**

```bash
git add index.html manifest.json sw.js src assets tests docs/zos-ceo-os-v2.0.4-production-acceptance.md
git commit -m "release: prepare ZOS CEO OS v2.0.4"
```

- [ ] **Step 5: Merge and push only after all local gates pass**

Fast-forward the reviewed feature branch into `main`, push `main`, and wait for GitHub Pages success. Do not claim deployment from the push result alone.

- [ ] **Step 6: Run acceptance pass 3 — formal URL**

Verify `index.html`, `manifest.json`, `sw.js`, `src/app.mjs`, and `src/legacy-app.mjs` return HTTP 200 and version 2.0.4. Repeat the three viewport checks against `https://xz1220z-afk.github.io/zos-workbench/?v=2.0.4#decisions`, confirm non-empty content, no horizontal overflow, and zero console errors.

- [ ] **Step 7: Tag the accepted release**

```bash
git tag zos-workbench-v2.0.4
git push origin zos-workbench-v2.0.4
```

- [ ] **Step 8: Final status audit**

Confirm `main` matches `origin/main`, the release tag points to the accepted commit, and only the preserved user-owned untracked files remain.
