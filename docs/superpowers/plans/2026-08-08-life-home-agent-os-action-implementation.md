# ZOS Life Home and Agent Task Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing private Life home into a focused daily surface and make the existing dynamically indexed Agent OS directly taskable with per-Agent rules, local context candidates, and auditable task history.

**Architecture:** Preserve the modular browser-native application and existing routes. Add a small pure Agent task-context domain module, store its archives and long-context candidates in local-only collections, enrich the existing task draft handoff, and reshape only the existing `lifeCenterRoot` and `agentWorkbenchRoot` renderers.

**Tech Stack:** Browser-native ES modules, static HTML/CSS, Node.js `node:test`, existing local state store, existing authenticated OpenAI handler, existing Supabase sync boundary.

## Global Constraints

- Do not create a second workbench, replace navigation, migrate routes, or remove existing tasks, calendars, Agent runs, Vault files, or cloud records.
- Agent identity status (`draft` / `pilot` / `active` / `deprecated`) must remain distinct from runtime availability (`can_draft` / `can_analyze` / `pilot_limited` / `awaiting_external_confirmation`).
- Agent OS identity indexes, Agent task archives, Agent context candidates, and all private Agent work are local-only; do not upload Markdown bodies, raw knowledge, private relationship records, or context text to Supabase.
- Company tasks may retain only the existing minimal Agent reference in their synchronized task record.
- OpenAI may only produce structured read-only analysis; Feishu writes, external messages, calendar creation, publication, payment, permissions, Vault edits, and automation enabling must stay behind explicit per-action confirmation.
- REL-001, health, and personal-administration context must never appear in a company filter, shared history, or a cloud payload.
- New behavior is test-first. Focused tests must be observed failing before each production implementation step.
- Preserve `.superpowers/` and do not stage it.

---

### Task 1: Local Agent task archive and context candidate domain

**Files:**
- Create: `src/app/agent-task-context.mjs`
- Modify: `src/app/data-durability.mjs`
- Modify: `src/sync-engine.mjs`
- Test: `tests/agent-task-context.test.mjs`
- Test: `tests/v2-sync.test.mjs`

**Interfaces:**
- Produces `createAgentTaskArchive(input)`, `completeAgentTaskArchive(archive, result)`, `createContextCandidate(archive)`, `confirmContextCandidate(candidate, patch)`, and `agentRuntimeAvailability(agent, options)`.
- Adds local-only entity types `agent_task_archives` and `agent_contexts`.
- An archive contains only Agent ID, objective, selected references, structured-result summary, phase, privacy, timestamps, and task ID; it rejects raw Markdown body keys and all restricted personal fields.

- [ ] **Step 1: Write the failing domain and sync tests**

```js
test('a task archive keeps per-Agent rules and creates a pending local context candidate only after a result', () => {
  const archive = createAgentTaskArchive({ agentId: 'WANJIA-001', objective: '核验今日商家风险', agentRules: { outputContract: '事实、推断、建议、待确认、下一步。' } });
  assert.equal(archive.phase, 'draft');
  const completed = completeAgentTaskArchive(archive, { factSummary: '数据日期待校验', recommendationSummary: '先补齐日报' });
  assert.equal(createContextCandidate(completed).status, 'pending_confirmation');
});

test('private and Agent context collections never enter buildLocalSyncInput', () => {
  const input = buildLocalSyncInput({ collections: { agent_task_archives: [{ id: 'a1' }], agent_contexts: [{ id: 'c1' }] }, tombstones: [] });
  assert.equal(Object.hasOwn(input, 'agent_task_archives'), false);
  assert.equal(Object.hasOwn(input, 'agent_contexts'), false);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/agent-task-context.test.mjs tests/v2-sync.test.mjs`

Expected: failures because the Agent task-context module and local-only entity types do not exist.

- [ ] **Step 3: Implement only the validated local domain**

```js
export function agentRuntimeAvailability(agent, { aiReady = false } = {}) {
  if (agent?.status === 'deprecated') return 'can_draft';
  if (agent?.status === 'pilot') return aiReady ? 'pilot_limited' : 'can_draft';
  return aiReady ? 'can_analyze' : 'can_draft';
}
```

Implement strict allowlists for archive and candidate fields; `completeAgentTaskArchive` must preserve input references but never accept `body`, `content`, `chat`, `location`, `password`, `medical`, or `finance` keys. Register both collections in the durable-state entity list and in `LOCAL_ONLY_ENTITY_TYPES`.

- [ ] **Step 4: Run the focused tests and require GREEN**

Run: `node --test tests/agent-task-context.test.mjs tests/v2-sync.test.mjs`

Expected: PASS; local-only archives, context candidates, and their tombstones never produce cloud rows.

---

### Task 2: Controlled dispatch, per-Agent context, and Agent OS UI

**Files:**
- Modify: `src/app/agent-os-center.mjs`
- Modify: `src/app.mjs`
- Modify: `src/app/views/agent-workbench-view.mjs`
- Modify: `src/app/views/task-view.mjs`
- Modify: `assets/app.css`
- Test: `tests/v2-app-actions.test.mjs`
- Test: `tests/agent-os-center.test.mjs`
- Test: `tests/agent-os-view.test.mjs`

**Interfaces:**
- `buildAgentInvocationDraft(agent, options)` returns the existing task-drawer shape plus `agentContext.runtimeAvailability` and the immutable Agent rule snapshot.
- `saveTask(input)` stores the ordinary task as today, then creates or updates an `agent_task_archives` record when `agentContext.agentId` exists.
- `analyzeAgent(agentId, question, archiveId)` stores only a local structured-result summary in its archive; it never treats the answer as an external execution.
- `confirmAgentContext(id, patch)`, `rejectAgentContext(id)`, and `removeAgentContext(id)` only mutate local `agent_contexts` records.

- [ ] **Step 1: Write failing dispatch tests**

```js
test('saving an Agent task keeps the company task minimal but records a local Agent archive', () => {
  const draft = app.invokeAgent('WANJIA-001');
  const task = app.saveTask({ ...draft, title: '分析今日商家风险', description: '只读分析' });
  assert.equal(app.store.load().collections.tasks[0].agentContext.agentId, 'WANJIA-001');
  assert.equal(app.viewModel().agentTaskArchives[0].taskId, task.id);
  assert.equal(app.viewModel().agentTaskArchives[0].phase, 'draft');
});

test('REL-001 task archive and every context candidate remain local and hidden outside private relations', () => {
  app.setAgentOsFilter('private-relations');
  app.saveTask({ ...app.invokeAgent('REL-001'), title: '准备关怀草稿' });
  assert.equal(app.viewModel().agentTaskArchives[0].privacy, 'private');
  assert.equal(Object.hasOwn(buildLocalSyncInput(app.store.load()), 'agent_task_archives'), false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/v2-app-actions.test.mjs tests/agent-os-center.test.mjs tests/agent-os-view.test.mjs`

Expected: failures because no archive, availability, context-candidate, or dispatch controls are rendered.

- [ ] **Step 3: Implement controlled dispatch without changing task or external-action semantics**

Update the existing `invokeAgent`, `saveTask`, and `analyzeAgent` paths to use the new pure domain. Pass a sanitized Agent rule snapshot into the drawer. Only `objective`, selected reference labels, phase, and a compact structured result summary may be written to local archive state. Do not call Feishu, calendar mutation, Vault access, or OpenAI for private Agents.

Add delegated handlers for local candidate confirm/edit/reject/delete. The confirmation path may only promote a user-reviewed summary into `agent_contexts`; it must display `本机长期上下文` and never imply Vault memory was changed.

- [ ] **Step 4: Render the increment in the existing Agent OS page**

Use the existing cards and drawer. Rename the existing task action to `派任务`; render runtime availability as a separate badge next to identity status; add per-Agent “已确认上下文” count and last local task phase. In the detail drawer, render scope, fixed output contract, local task history, approved local context summaries, and candidate controls. Keep REL-001 in `private-relations` only and omit the OpenAI action for it.

- [ ] **Step 5: Improve the existing task drawer handoff**

Render the selected Agent’s identity status, allowed knowledge entry labels, fixed output contract, and local/cloud storage boundary. The submit button label is `保存到任务队列`; it must not say “执行” or “已派发”.

- [ ] **Step 6: Run focused tests and require GREEN**

Run: `node --test tests/v2-app-actions.test.mjs tests/agent-os-center.test.mjs tests/agent-os-view.test.mjs tests/v2-sync.test.mjs`

Expected: PASS; ordinary company records remain minimal, archives and contexts remain local, and private Agents are never remotely analyzed.

---

### Task 3: Focused private Life home and responsive interaction polish

**Files:**
- Modify: `src/app/homepage-presence.mjs`
- Modify: `src/app/views/life-view.mjs`
- Modify: `src/app.mjs`
- Modify: `assets/app.css`
- Test: `tests/homepage-presence.test.mjs`
- Test: `tests/important-dates-view.test.mjs`

**Interfaces:**
- `buildLifeHomepagePresence(model)` returns a data-derived title and action state without private titles in its summary.
- `buildLifeToday(model)` returns `{ selfAction, relationOrRitual, upcoming, management, timeline }` from current private life records without inventing any activity.
- Existing `data-life-capture`, calendar navigation, important-date drawer, ritual conversion, and private-date import identifiers remain usable.

- [ ] **Step 1: Write failing Life home tests**

```js
test('life home renders today first, then a bounded weekly rhythm and collapsed management instead of a flat card wall', () => {
  renderLife(node, { life: [{ title: '散步', area: 'health', status: 'open' }], lifeNextSevenDays: [], importantDates: { life: [] }, rituals: [] });
  assert.match(node.innerHTML, /给自己的一件事/);
  assert.match(node.innerHTML, /本周值得记住/);
  assert.match(node.innerHTML, /生活管理/);
  assert.doesNotMatch(node.innerHTML, /待处理 \/ 1 条记录/);
});

test('empty life data stays useful without inventing personal activity', () => {
  const presence = buildLifeHomepagePresence({ life: [], lifeNextSevenDays: [], importantDates: { life: [] }, rituals: [] });
  assert.match(presence.title, /记录|安排|空间/);
  assert.doesNotMatch(presence.summary, /自动/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/homepage-presence.test.mjs tests/important-dates-view.test.mjs`

Expected: failures because the current life renderer is a flat area-card layout.

- [ ] **Step 3: Implement data-derived three-layer life layout**

In `app.mjs`, derive small, bounded Life segments only from existing private records. In the renderer order: (1) Today with weather, one self action, one relationship/ritual prompt, primary capture and full-calendar actions; (2) “本周值得记住” merging next seven days, important dates, and rituals with at most five chronological rows; (3) collapsed health, learning, personal admin, and private materials entry points plus a filterable existing life timeline. Preserve all existing actions and privacy explanations.

- [ ] **Step 4: Add performance-safe visual polish**

Use existing dark tokens and compact glass surfaces. Limit `backdrop-filter` to heroes, use `transform`/`opacity` only for press feedback, add `:focus-visible`, 44px touch targets, and a `prefers-reduced-motion` override. Do not add a full-page blur, animated gradient, fixed background video, or `transition: all`.

- [ ] **Step 5: Run focused tests and require GREEN**

Run: `node --test tests/homepage-presence.test.mjs tests/important-dates-view.test.mjs tests/apple-interaction-system.test.mjs`

Expected: PASS; private titles remain confined to the Life page, actions are preserved, and interaction styles remain reduced-motion safe.

---

### Task 4: Release graph, three acceptance passes, backup, and production verification

**Files:**
- Modify: `index.html`
- Modify: `manifest.json`
- Modify: `sw.js`
- Modify: versioned browser imports in changed `src/` modules
- Modify: `CHANGELOG.md`
- Create: `docs/releases/zos-ceo-os-v2.7.0.md`
- Create: `docs/zos-ceo-os-v2.7.0-production-acceptance.md`
- Test: `tests/v2-release.test.mjs`
- Test: `tests/pwa-versioned-imports.test.mjs`

**Interfaces:**
- Produces one coherent static version `2.7.0` and a durable backup/release record for the committed source revision.

- [ ] **Step 1: Write failing release tests**

```js
test('v2.7.0 cache graph contains the life and Agent task-context modules', async () => {
  assert.match(serviceWorker, /agent-task-context\.mjs\?v=2\.7\.0/);
  assert.match(manifest, /2\.7\.0/);
});
```

- [ ] **Step 2: Run release tests and verify RED**

Run: `node --test tests/v2-release.test.mjs tests/pwa-versioned-imports.test.mjs`

Expected: failure on the old versioned asset graph.

- [ ] **Step 3: Bump and document the release**

Update every transitive browser import and service-worker cache entry to `2.7.0`; include a credential-free durable-backup verification, exact rollback commit, local test count, and user-visible limitations in the release documents.

- [ ] **Step 4: Run all automated verification**

Run: `node --test tests/*.test.mjs && node --check src/app.mjs && node --check src/app/agent-task-context.mjs && node --check sw.js`

Expected: all tests pass and syntax checks exit zero.

- [ ] **Step 5: Complete three visual acceptance passes**

At desktop 1440×900, tablet 1024×768, and mobile 390×844, verify Life and Agent OS routes show non-empty UI; cards, detail drawer, task handoff, private REL-001 visibility, and reduced-motion fallback work; no horizontal overflow; console errors equal zero. Verify backup export contains local Agent archives and contexts but no restricted fields.

- [ ] **Step 6: Commit, deploy only after verification, and read back production**

Commit the implementation and documents, push the approved branch, merge using the repository’s existing release route, and verify production `index.html`, `manifest.json`, `sw.js`, and the new Agent task-context module all return HTTP 200 with `2.7.0`. Create tag `zos-workbench-v2.7.0` only after remote verification succeeds.

## Self-Review

- Spec coverage: the first two tasks deliver controlled dispatch, independent rules, scoped context, history, candidate approval, and privacy isolation; Task 3 delivers the approved Life information hierarchy; Task 4 covers versioning, backup, desktop/tablet/mobile verification, and readback.
- Placeholder scan: no unresolved implementation marker or deferred step appears in any task.
- Type consistency: `agent_task_archives` and `agent_contexts` are created by the domain module, registered as local-only collections, exposed in the application model, and consumed by the Agent renderer.
- Safety: all real-world actions remain behind existing confirmation boundaries; no task adds a direct Feishu, Vault, calendar, payment, publication, or message call.
