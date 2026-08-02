# ZOS CEO OS v1.4.3 Startup Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the cached CEO dashboard immediately, refresh authenticated sources concurrently in the background, and prevent Service Worker updates from forcing a second page load.

**Architecture:** `createCeoOsApplication.start()` becomes a fast shell-and-cache bootstrap. A separately tracked startup promise performs authentication restoration, four-device sync, intelligence loading, and company refreshes concurrently; each completed source triggers an incremental render while the final brief is regenerated only after the background batch settles. The Service Worker continues to update its cache but no longer reloads the active page automatically.

**Tech Stack:** Browser ES modules, Node.js built-in test runner, Supabase Auth/REST/Edge Functions, GitHub Pages PWA Service Worker.

## Global Constraints

- Preserve read-only Feishu data access and existing human-confirmation write gates.
- Never persist passwords, access tokens, refresh tokens, or service credentials in domain state.
- Keep local cached data visible while remote refreshes are pending or fail.
- Preserve `.superpowers/` and `package-lock.json` in the main checkout as user-owned untracked files.
- Release version is `1.4.3` and Service Worker cache is `zos-workbench-v1.4.3`.

---

### Task 1: Immediate cached first render and concurrent startup

**Files:**
- Modify: `src/app.mjs:303-348`
- Modify: `tests/app-composition.test.mjs`

**Interfaces:**
- Consumes: existing `renderAll()`, `createBrowserOperatingRuntime()`, `syncController.sync()`, `operatingLoop.refresh(source)`, and `loadIntelligence()`.
- Produces: `start(): Promise<ViewModel>` that resolves after the cached first render and `whenIdle(): Promise<ViewModel>` that resolves after background startup work settles.

- [x] **Step 1: Write a failing first-render test**

Add a deferred startup test that starts the app with unresolved sync, intelligence, Wanjia, and Huahuo promises. Assert `start()` resolves before those promises and the dashboard root has rendered cached content.

- [x] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="renders cached content before remote startup settles" tests/app-composition.test.mjs`

Expected: FAIL because the current `start()` waits for every remote promise.

- [x] **Step 3: Implement the minimal background startup flow**

Move subscription, action binding, and the first `renderAll()` to the beginning of `start()`. Track remote initialization in `startupWork`; run sync, intelligence, Wanjia, and Huahuo jobs with `Promise.allSettled`, render after each completion, then regenerate targets and the daily brief. Return `whenIdle()` from the application API for deterministic acceptance tests.

- [x] **Step 4: Verify GREEN and preserve completed-state tests**

Run: `node --test tests/app-composition.test.mjs`

Expected: all composition tests pass. Existing tests that inspect remote results must call `await app.whenIdle()` after `await app.start()`.

### Task 2: Remove forced Service Worker reload and release v1.4.3

**Files:**
- Modify: `src/legacy-app.mjs:2364-2389`
- Modify: `src/app.mjs:22`
- Modify: `src/app/monitoring.mjs`
- Modify: `sw.js:1`
- Modify: `index.html:653`
- Modify: `.github/workflows/healthcheck.yml`
- Modify: `tests/pwa-baseline.test.mjs`
- Modify: `tests/monitoring.test.mjs`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: Service Worker `skipWaiting()` and `clients.claim()` lifecycle.
- Produces: cache revision `zos-workbench-v1.4.3` without a `controllerchange -> window.location.reload()` loop.

- [x] **Step 1: Write failing PWA assertions**

Require cache/version `1.4.3` and assert the Service Worker update handler does not force `window.location.reload()` on `controllerchange`.

- [x] **Step 2: Run the PWA test and verify RED**

Run: `node tests/pwa-baseline.test.mjs`

Expected: FAIL on the old `1.4.2` cache/version and forced reload handler.

- [x] **Step 3: Apply the minimal lifecycle and version changes**

Remove the forced reload listener, retain update checks, bump all monitored version references to `1.4.3`, and record the startup-performance release in the changelog.

- [x] **Step 4: Verify GREEN**

Run: `node tests/pwa-baseline.test.mjs && node --test tests/monitoring.test.mjs`

Expected: both checks pass.

### Task 3: Full verification, production publication, and three-pass acceptance

**Files:**
- Verify: all JavaScript modules, PWA contract, GitHub workflows, and public deployment.

**Interfaces:**
- Consumes: the completed v1.4.3 branch.
- Produces: a verified commit on `codex/v1.4.3-startup-performance`, merged and pushed to `main`, with public GitHub Pages evidence.

- [x] **Step 1: Run local acceptance**

Run: `node --test tests/*.test.mjs`, syntax-check every `src/*.mjs`, `node --check sw.js`, and `git diff --check`.

Expected: zero failures and zero syntax/diff errors.

- [ ] **Step 2: Commit the isolated branch**

Stage only the plan, source, tests, version, and release documentation. Commit message: `perf: render CEO dashboard before remote refresh`.

- [ ] **Step 3: Merge and push production**

Fast-forward `main` from the clean primary checkout and push `origin main`. No Supabase function redeploy is needed because this release changes only the static frontend startup path.

- [ ] **Step 4: Run production acceptance three times**

Verify the GitHub Actions healthcheck and Pages deployment succeed, compare public file content/version with the commit, and open the public page three times to confirm the dashboard shell renders without `[object Object]`, long GMV decimals, forced reload errors, or console errors.
