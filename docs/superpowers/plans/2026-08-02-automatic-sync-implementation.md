# ZOS CEO OS Automatic Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver ZOS CEO OS v1.5.0 so WanJia, HuaHuo, projects, intelligence, and private cross-device data update without opening every company page, while preserving read-only Feishu and explicit write approvals.

**Architecture:** A browser `auto-refresh-controller` owns foreground scheduling, visibility/network recovery, single-flight refresh, retry, and unified status. A protected Supabase Edge Function refreshes the same read-only Feishu sources into owner-scoped cache on a 15-minute schedule; the browser keeps its direct refresh path as a fallback and never receives server credentials.

**Tech Stack:** Browser ES modules, Node built-in test runner, Supabase Edge Functions (Deno/TypeScript), PostgreSQL RLS + `pg_cron` + `pg_net`, GitHub Pages PWA.

## Global Constraints

- Target version is exactly `1.5.0`.
- Browser foreground interval is 15 minutes; foreground recovery threshold is 5 minutes; stale threshold is 30 minutes.
- One source failure must not cancel or clear successful sources or previous cached data.
- Feishu access remains read-only. Existing preview -> single confirmation -> readback verification remains the only write path.
- Lingli Education remains `pending_configuration`; do not generate metrics.
- Obsidian note bodies and Feishu credentials must never enter browser payloads, logs, or the repository.
- Keep all existing manual per-source refresh controls as rollback fallback.

---

### Task 1: Browser refresh scheduler

**Files:**
- Create: `src/app/auto-refresh-controller.mjs`
- Create: `tests/auto-refresh-controller.test.mjs`

**Interfaces:**
- Consumes: `refreshAll(reason): Promise<RefreshResult>` from Task 2.
- Produces: `createAutoRefreshController(config)` with `start()`, `stop()`, `refresh(reason)`, and `getStatus()`.

- [ ] **Step 1: Write failing scheduler tests**

```js
test('starts one refresh and reuses the in-flight promise', async () => {
  const pending = deferred();
  const controller = createAutoRefreshController({ refreshAll: () => pending.promise, clock, visibility, eventTarget });
  const first = controller.refresh('startup');
  const second = controller.refresh('manual');
  assert.equal(first, second);
  pending.resolve({ succeeded: ['wanjia'], failed: [] });
  await first;
});

test('does not refresh while hidden and catches up after five stale minutes', async () => {
  controller.start();
  visibility.visibilityState = 'hidden';
  clock.advance(15 * 60_000);
  assert.equal(calls.length, 0);
  visibility.visibilityState = 'visible';
  visibility.dispatchEvent(new Event('visibilitychange'));
  await flush();
  assert.deepEqual(calls, ['visibility']);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/auto-refresh-controller.test.mjs`

Expected: FAIL because `src/app/auto-refresh-controller.mjs` does not exist.

- [ ] **Step 3: Implement the minimal scheduler**

```js
export function createAutoRefreshController({
  refreshAll, eventTarget = globalThis, visibility = globalThis.document,
  clock = globalThis, intervalMs = 15 * 60_000, foregroundStaleMs = 5 * 60_000,
  now = () => Date.now(), jitterMs = 30_000, random = Math.random, onStatus = () => {},
} = {}) {
  let active = null;
  let timer = null;
  let lastSuccessAt = 0;
  async function refresh(reason) {
    if (active) return active;
    active = Promise.resolve(refreshAll(reason)).then((result) => {
      if (!result.failed?.length) lastSuccessAt = now();
      return result;
    }).finally(() => { active = null; });
    return active;
  }
  // start/stop register online and visibility handlers and recursively schedule
  // intervalMs + bounded jitter only while the document is visible and online.
  return { start, stop, refresh, getStatus };
}
```

- [ ] **Step 4: Run focused and scheduler-adjacent tests**

Run: `node --test tests/auto-refresh-controller.test.mjs tests/sync-controller.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/auto-refresh-controller.mjs tests/auto-refresh-controller.test.mjs
git commit -m "feat: add foreground auto refresh scheduler"
```

---

### Task 2: Refresh-all orchestration and unified UI status

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/app/browser-runtime.mjs`
- Modify: `src/app/views/dashboard-view.mjs`
- Modify: `src/app/views/health-view.mjs`
- Modify: `assets/ceo-os-v1.3.css`
- Create: `tests/automatic-refresh-integration.test.mjs`
- Modify: `tests/dashboard-view.test.mjs`

**Interfaces:**
- Consumes: `createAutoRefreshController()` from Task 1 and existing `operatingLoop`, `syncController`, `loadIntelligence`.
- Produces: application `refreshAllSources(reason)` and runtime `autoRefresh` status with `phase`, `reason`, `lastAttemptAt`, `lastSuccessAt`, `succeeded`, `failed`.

- [ ] **Step 1: Write failing integration and rendering tests**

```js
test('startup refreshes private sync, Wanjia, Huahuo, projects and intelligence without navigation', async () => {
  const app = createCeoOsApplication({ operatingRuntime, autoRefreshOptions: { jitterMs: 0 } });
  await app.start();
  await app.whenIdle();
  assert.deepEqual(new Set(businessCalls), new Set(['wanjia', 'huahuo', 'projects']));
  assert.equal(intelligenceCalls, 1);
  assert.equal(syncCalls, 1);
});

test('dashboard renders one refresh-all control and per-source result', () => {
  render(container, { autoRefresh: { phase: 'partial', succeeded: ['wanjia'], failed: [{ source: 'huahuo', safeCode: 'feishu_permission_denied' }] } });
  assert.match(container.innerHTML, /data-refresh-all/);
  assert.match(container.innerHTML, /万嘉/);
  assert.match(container.innerHTML, /花火/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/automatic-refresh-integration.test.mjs tests/dashboard-view.test.mjs`

Expected: FAIL because `refreshAllSources` and `data-refresh-all` are absent.

- [ ] **Step 3: Implement source-isolated refresh-all**

```js
async function refreshAllSources(reason = 'manual') {
  const jobs = {
    sync: () => operatingRuntime.syncController.sync(reason),
    wanjia: () => operatingRuntime.operatingLoop.refresh('wanjia'),
    huahuo: () => operatingRuntime.operatingLoop.refresh('huahuo'),
    projects: () => operatingRuntime.operatingLoop.refresh('projects'),
    intelligence: () => operatingRuntime.loadIntelligence({ refresh: reason !== 'startup-cache' }),
  };
  const entries = await Promise.all(Object.entries(jobs).map(async ([source, run]) => {
    try { await run(); return { source, ok: true }; }
    catch (error) { return { source, ok: false, safeCode: safeRefreshCode(error) }; }
  }));
  return summarizeRefresh(entries);
}
```

Use one controller instance for startup, periodic, online, visibility, and manual events. Keep existing per-source `refreshSource()` unchanged.

- [ ] **Step 4: Render and bind unified status**

Add `<button data-refresh-all>` on desktop and mobile views. Render old data while phase is `refreshing`; render `partial`, `offline`, `authentication_required`, and `stale` with safe codes only.

- [ ] **Step 5: Run focused tests and the complete browser suite**

Run: `node --test tests/automatic-refresh-integration.test.mjs tests/dashboard-view.test.mjs tests/app-integration.test.mjs tests/browser-runtime.test.mjs`

Run: `node --test tests/*.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app.mjs src/app/browser-runtime.mjs src/app/views/dashboard-view.mjs src/app/views/health-view.mjs assets/ceo-os-v1.3.css tests/automatic-refresh-integration.test.mjs tests/dashboard-view.test.mjs
git commit -m "feat: refresh all connected sources automatically"
```

---

### Task 3: Protected cloud cache refresh

**Files:**
- Create: `supabase/functions/_shared/business-data.ts`
- Modify: `supabase/functions/zos-business-data/index.ts`
- Create: `supabase/functions/zos-business-refresh/index.ts`
- Modify: `supabase/config.toml`
- Create: `supabase/migrations/006_automatic_business_refresh.sql`
- Create: `tests/business-refresh-security.test.mjs`

**Interfaces:**
- Consumes: server-only `FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ZOS_OWNER_USER_ID`, `ZOS_CRON_SECRET`.
- Produces: `readBusinessSources(source)` and internal POST `/functions/v1/zos-business-refresh` guarded by `x-zos-cron-secret`.

- [ ] **Step 1: Write failing static security and contract tests**

```js
test('internal refresh rejects requests without the cron secret before Feishu access', () => {
  const source = readFileSync('supabase/functions/zos-business-refresh/index.ts', 'utf8');
  assert.match(source, /x-zos-cron-secret/);
  assert.match(source, /ZOS_CRON_SECRET/);
  assert.match(source, /ZOS_OWNER_USER_ID/);
  assert.doesNotMatch(source, /app_secret\s*:/i);
});

test('scheduled SQL reads URL and secret from Vault instead of literals', () => {
  const sql = readFileSync('supabase/migrations/006_automatic_business_refresh.sql', 'utf8');
  assert.match(sql, /vault\.decrypted_secrets/);
  assert.doesNotMatch(sql, /dtwvyramgbwtlyhmkhkd\.supabase\.co\/functions/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/business-refresh-security.test.mjs`

Expected: FAIL because the internal function and migration do not exist.

- [ ] **Step 3: Extract the read-only business source builder**

Move field mapping and Feishu read logic from `zos-business-data/index.ts` into `readBusinessSources(requestedSource)`. The authenticated function calls it and returns the unchanged v1.3 response contract.

- [ ] **Step 4: Implement guarded cache upsert**

```ts
if (req.headers.get('x-zos-cron-secret') !== Deno.env.get('ZOS_CRON_SECRET')) {
  return response({ error: 'forbidden' }, 403);
}
const ownerId = Deno.env.get('ZOS_OWNER_USER_ID');
const payload = await readBusinessSources('all');
await supabase.from('zos_business_cache').upsert(
  ['wanjia', 'huahuo', 'projects'].map((source) => ({
    user_id: ownerId, source, payload: payload[source], fetched_at: now,
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  })),
  { onConflict: 'user_id,source' },
);
```

Return only source names, record counts, safe codes, duration, and timestamp.

- [ ] **Step 5: Add Vault-backed 15-minute schedule**

`006_automatic_business_refresh.sql` enables `pg_cron` and `pg_net`, removes an older job with the same name, then schedules `*/15 * * * *`. The job resolves `zos_business_refresh_url` and `zos_business_refresh_secret` from `vault.decrypted_secrets` at execution time.

- [ ] **Step 6: Run tests and local Supabase validation**

Run: `node --test tests/business-refresh-security.test.mjs tests/edge-function-auth.test.mjs tests/feishu-field-validation.test.mjs`

Run: `npx --yes supabase@latest functions serve zos-business-refresh --env-file supabase/.env.local`

Expected: missing/wrong secret returns 403; no response or log contains credentials.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/business-data.ts supabase/functions/zos-business-data/index.ts supabase/functions/zos-business-refresh/index.ts supabase/config.toml supabase/migrations/006_automatic_business_refresh.sql tests/business-refresh-security.test.mjs
git commit -m "feat: add protected scheduled business cache refresh"
```

---

### Task 4: Release, production migration, and three-pass acceptance

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/zos-ceo-os-v1.5.0-production-acceptance.md`
- Modify: `sw.js`

**Interfaces:**
- Consumes: passing Tasks 1-3 and production Supabase/GitHub access.
- Produces: deployed v1.5.0, active 15-minute job, and evidence-backed acceptance report.

- [ ] **Step 1: Configure server-only production values**

Discover the single authorized owner UUID from the linked Supabase project. Generate a new cron secret without printing it; set `ZOS_OWNER_USER_ID` and `ZOS_CRON_SECRET` as Supabase function secrets. Create matching Vault entries for the refresh URL and secret without committing their values.

- [ ] **Step 2: Push migration and deploy functions**

Run:

```bash
npx --yes supabase@latest db push --linked
npx --yes supabase@latest functions deploy zos-business-data --project-ref dtwvyramgbwtlyhmkhkd
npx --yes supabase@latest functions deploy zos-business-refresh --project-ref dtwvyramgbwtlyhmkhkd --no-verify-jwt
```

Expected: migration applied; both functions ACTIVE; unauthenticated business read is 401 and unauthenticated internal refresh is 403.

- [ ] **Step 3: Run acceptance pass 1 - automated contract**

Run: `node --test tests/*.test.mjs`

Expected: all tests PASS, zero failures.

- [ ] **Step 4: Run acceptance pass 2 - browser and PWA**

Run a local static server, open desktop and mobile widths, verify immediate cached render, automatic background status transition, one refresh-all button, no duplicate requests, and service-worker cache upgrade.

- [ ] **Step 5: Run acceptance pass 3 - production data and security**

Verify WanJia, HuaHuo, projects, and intelligence update without navigating to their pages; query cache timestamps after one scheduled cycle; verify Lingli remains pending; confirm Feishu audit shows read operations only.

- [ ] **Step 6: Publish and document rollback**

Update version/caches/docs, commit, push the feature branch, integrate to `main`, push GitHub Pages, then re-run the public smoke test. Document exact rollback commits and how to unschedule only `zos-business-refresh-15m` without deleting cache history.

- [ ] **Step 7: Commit release evidence**

```bash
git add README.md CHANGELOG.md sw.js docs/zos-ceo-os-v1.5.0-production-acceptance.md
git commit -m "docs: record v1.5.0 automatic sync acceptance"
```

## Self-Review

- Spec coverage: browser interval, foreground/network recovery, source isolation, manual fallback, cloud cache, unified status, Lingli/Obsidian boundaries, security, three-pass acceptance, and rollback are mapped to Tasks 1-4.
- Placeholder scan: no TBD/TODO or unspecified implementation steps remain.
- Type consistency: Task 1 produces `refresh(reason)` around Task 2 `refreshAllSources(reason)`; Task 3 exposes `readBusinessSources(source)` to both Edge Functions; UI consumes the same `autoRefresh` state produced by Task 2.
