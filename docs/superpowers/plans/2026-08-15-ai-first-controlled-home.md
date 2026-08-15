# ZOS AI First Controlled Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyboard-and-user-initiated-voice AI command surface to the existing ZOS work homepage, with deterministic source routing and C-level controlled execution, while preserving all current pages and user data.

**Architecture:** Add four focused pure modules for command state, intent routing, controlled execution, and browser voice recognition, plus one view module for the command surface. The existing `app.mjs` remains the orchestrator and reuses the current OpenAI client, state store, Agent OS index, task/inbox collections, navigation, backup, and dashboard render path.

**Tech Stack:** Browser-native ES modules, Node test runner, static HTML/CSS PWA, existing Supabase/OpenAI Edge Function client, GitHub Pages.

## Global Constraints

- Keep the existing ZOS CEO Operating System, navigation, routes, company pages, Agent OS, storage schema, and visual system.
- Phase 1 remains a four-end PWA; native iOS, background wake words, continuous listening, and background recording are excluded.
- Voice starts only after press or click, writes an editable transcript, and never stores raw audio.
- The existing OpenAI backend answers both typed and transcribed tasks.
- L0 read-only actions run directly; L1 reversible local drafts run directly with undo; L2 external/high-risk actions require an exact preview and explicit confirmation.
- Never claim an action executed when only a draft or preview exists.
- Feishu ERP and current business systems are real-time facts; Enterprise Brain is knowledge and decision support.
- REL-001 and private Agent context remain local-only and absent from company views.
- Do not add React, a second framework, a second workbench, or a second business-data store.
- Do not persist unsubmitted transcripts, raw Feishu rows, Vault bodies, raw audio, credentials, or internal stack traces.
- Preserve the rollback point `zos-workbench-v2.8.4` at commit `29cb3ab`.

---

## File Structure

- Create `src/app/ai-command-center.mjs`: normalize command input, command state, result contract, and safe activity summaries.
- Create `src/app/intent-router.mjs`: deterministic intent, scope, source, Agent, and risk routing.
- Create `src/app/controlled-execution.mjs`: classify L0/L1/L2 actions and construct preview/undo contracts.
- Create `src/app/voice-input.mjs`: adapter around `SpeechRecognition`/`webkitSpeechRecognition` with explicit lifecycle states.
- Create `src/app/views/ai-command-view.mjs`: render the AI-first home surface with accessible controls and states.
- Modify `src/app/views/dashboard-view.mjs`: mount the command surface above current business modules.
- Modify `src/app.mjs`: orchestrate submission, OpenAI answer, navigation, L1 draft save/undo, L2 preview, and voice events.
- Modify `assets/app.css`: responsive Apple-like command surface and restrained press/listening feedback.
- Modify `index.html`, `manifest.json`, `sw.js`, and versioned module imports: publish one coherent new PWA version.
- Add focused tests under `tests/ai-command-*.test.mjs` and update release/PWA assertions.

---

### Task 1: Deterministic command and routing contracts

**Files:**
- Create: `tests/ai-command-center.test.mjs`
- Create: `tests/intent-router.test.mjs`
- Create: `src/app/ai-command-center.mjs`
- Create: `src/app/intent-router.mjs`

**Interfaces:**
- Produces: `createAiCommand(input, options)`, `transitionAiCommand(command, event)`, `normalizeAiCommandResult(payload, context)`, `sanitizeAiActivity(command)`.
- Produces: `routeIntent(text, options)` returning `{ intent, scope, sourcePlan, agentId, riskLevel, requestedAction }`.

- [ ] **Step 1: Write failing command contract tests**

```js
test('command results distinguish facts, inference, advice, pending items and next step', () => {
  const result = normalizeAiCommandResult({ answer: '先核验日报', sources: ['林客日报'] }, { task: '今天万嘉有什么风险' });
  assert.equal(result.task, '今天万嘉有什么风险');
  assert.deepEqual(result.sources, ['林客日报']);
  assert.equal(result.sections.facts.length > 0, true);
  assert.equal(result.execution.level, 'L0');
});

test('safe activity summary excludes transcript and raw source bodies', () => {
  const item = sanitizeAiActivity(createAiCommand('读取私人正文', { scope: 'life' }));
  assert.equal(Object.hasOwn(item, 'text'), false);
  assert.equal(Object.hasOwn(item, 'rawSources'), false);
});
```

- [ ] **Step 2: Run command tests and verify RED**

Run: `node --test tests/ai-command-center.test.mjs`
Expected: FAIL because `src/app/ai-command-center.mjs` does not exist.

- [ ] **Step 3: Implement the minimal command contract**

```js
export function createAiCommand(text, options = {}) {
  return { id: options.id || `cmd-${Date.now()}`, text: String(text || '').trim(), scope: options.scope || 'auto', state: 'idle', createdAt: options.now || new Date().toISOString() };
}

export function transitionAiCommand(command, state) {
  return { ...command, state };
}

export function normalizeAiCommandResult(payload = {}, context = {}) {
  const answer = String(payload.answer || '').trim();
  return { task: context.task || '', sources: payload.sources || [], sections: { facts: answer ? [answer] : [], inference: [], advice: [], pending: [], next: [] }, execution: { level: 'L0', actions: [] } };
}

export function sanitizeAiActivity(command = {}) {
  return { id: command.id, scope: command.scope, state: command.state, createdAt: command.createdAt };
}
```

- [ ] **Step 4: Write failing route tests**

```js
test('real-time Wanjia questions route to the current business source', () => {
  assert.deepEqual(routeIntent('查一下万嘉今天支付 GMV').sourcePlan, ['wanjia_business']);
});

test('knowledge lookup routes to Enterprise Brain without overriding business facts', () => {
  const route = routeIntent('查以前沉淀的商家诊断 SOP');
  assert.equal(route.intent, 'knowledge_lookup');
  assert.deepEqual(route.sourcePlan, ['enterprise_brain_index']);
});

test('external writes are always L2', () => {
  assert.equal(routeIntent('把任务写进飞书并发给运营').riskLevel, 'L2');
});
```

- [ ] **Step 5: Run route tests and verify RED**

Run: `node --test tests/intent-router.test.mjs`
Expected: FAIL because `src/app/intent-router.mjs` does not exist.

- [ ] **Step 6: Implement deterministic route rules and make both test files GREEN**

```js
export function routeIntent(text, options = {}) {
  const value = String(text || '').trim();
  const external = /写进飞书|发给|发布|付款|删除|归档|改价|权限|自动化/.test(value);
  const knowledge = /以前|知识库|SOP|案例|复盘|方法/.test(value);
  const wanjia = /万嘉|商家|GMV|核销|退款/.test(value);
  return {
    intent: knowledge ? 'knowledge_lookup' : wanjia ? 'business_query' : 'general_assistant',
    scope: options.scope && options.scope !== 'auto' ? options.scope : wanjia ? 'wanjia' : knowledge ? 'knowledge' : 'auto',
    sourcePlan: knowledge ? ['enterprise_brain_index'] : wanjia ? ['wanjia_business'] : ['workspace_context'],
    agentId: options.agentId || null,
    riskLevel: external ? 'L2' : 'L0',
    requestedAction: external ? 'external_write' : 'read_analysis',
  };
}
```

- [ ] **Step 7: Verify and commit Task 1**

Run: `node --test tests/ai-command-center.test.mjs tests/intent-router.test.mjs`
Expected: PASS.

Commit: `git add src/app/ai-command-center.mjs src/app/intent-router.mjs tests/ai-command-center.test.mjs tests/intent-router.test.mjs && git commit -m "feat: add AI command routing contracts"`

---

### Task 2: Controlled execution with reversible L1 drafts

**Files:**
- Create: `tests/controlled-execution.test.mjs`
- Create: `src/app/controlled-execution.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Consumes: `routeIntent(text, options)`.
- Produces: `classifyControlledAction(action)`, `buildExecutionPreview(action)`, `executeControlledAction(action, adapters)`, and app methods `submitAiCommand`, `confirmAiCommandAction`, `undoAiCommandAction`.

- [ ] **Step 1: Write failing execution policy tests**

```js
test('read-only navigation is L0 and executes without confirmation', async () => {
  const result = await executeControlledAction({ type: 'navigate', target: 'local-life' }, { navigate: (page) => page });
  assert.equal(result.status, 'completed');
  assert.equal(result.level, 'L0');
});

test('local task draft is L1 and returns an undo contract', async () => {
  const result = await executeControlledAction({ type: 'save_task_draft', title: '核验商家数据' }, { saveDraft: (draft) => ({ ...draft, id: 't-1' }) });
  assert.equal(result.level, 'L1');
  assert.equal(result.undo.recordId, 't-1');
});

test('Feishu write is L2 and only returns an exact preview', async () => {
  const result = await executeControlledAction({ type: 'feishu_write', target: '04.03 任务管理', changes: { title: '跟进商家' } }, {});
  assert.equal(result.status, 'preview_required');
  assert.equal(result.preview.target, '04.03 任务管理');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/controlled-execution.test.mjs`
Expected: FAIL because `src/app/controlled-execution.mjs` does not exist.

- [ ] **Step 3: Implement L0/L1/L2 classification and execution**

```js
const L2 = new Set(['feishu_write', 'send_message', 'publish', 'external_calendar', 'delete', 'payment', 'contract', 'permission', 'automation']);
const L1 = new Set(['save_task_draft', 'save_inbox_draft', 'save_reminder_draft']);

export function classifyControlledAction(action = {}) {
  return L2.has(action.type) ? 'L2' : L1.has(action.type) ? 'L1' : 'L0';
}

export function buildExecutionPreview(action = {}) {
  return { target: action.target || '', changes: action.changes || {}, impact: action.impact || 'external', rollback: action.rollback || 'manual_review' };
}

export async function executeControlledAction(action, adapters = {}) {
  const level = classifyControlledAction(action);
  if (level === 'L2') return { level, status: 'preview_required', preview: buildExecutionPreview(action) };
  if (action.type === 'save_task_draft') {
    const record = adapters.saveDraft(action);
    return { level, status: 'completed', record, undo: { entityType: 'tasks', recordId: record.id } };
  }
  const value = action.type === 'navigate' ? adapters.navigate?.(action.target) : null;
  return { level, status: 'completed', value };
}
```

- [ ] **Step 4: Write an application integration test for OpenAI, L1 undo, and L2 preview**

```js
test('AI command uses existing OpenAI, saves a reversible draft and never performs L2 directly', async () => {
  const requests = [];
  const app = application({ askAi: async (request) => { requests.push(request); return { answer: '先核验商家日报', sources: ['林客日报'], actions: [{ type: 'save_task_draft', title: '核验商家日报' }] }; } });
  await app.submitAiCommand('今天万嘉有什么风险');
  assert.equal(requests.length, 1);
  const saved = await app.confirmAiCommandAction(0);
  assert.equal(saved.level, 'L1');
  app.undoAiCommandAction();
  assert.equal(app.viewModel().tasks.length, 0);

  const preview = await app.previewAiCommandAction({ type: 'feishu_write', target: '04.03 任务管理', changes: { title: '跟进' } });
  assert.equal(preview.status, 'preview_required');
});
```

- [ ] **Step 5: Run the integration test and verify RED**

Run: `node --test tests/ai-command-integration.test.mjs`
Expected: FAIL because app command methods are absent.

- [ ] **Step 6: Add minimal app orchestration and verify GREEN**

The orchestrator must call `config.askAi || operatingRuntime?.aiAssistant?.ask`, preserve the typed task on failure, use `store.saveEntity('tasks', draft, { action: 'ai_command_draft' })` for L1, use `store.deleteEntity('tasks', id)` for undo, and never call an external writer for L2.

Run: `node --test tests/controlled-execution.test.mjs tests/ai-command-integration.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Commit: `git add src/app/controlled-execution.mjs src/app.mjs tests/controlled-execution.test.mjs tests/ai-command-integration.test.mjs && git commit -m "feat: add controlled AI execution"`

---

### Task 3: User-initiated voice adapter

**Files:**
- Create: `tests/voice-input.test.mjs`
- Create: `src/app/voice-input.mjs`
- Modify: `src/app.mjs`

**Interfaces:**
- Produces: `createVoiceInput(options)` with `supported`, `state()`, `start()`, `stop()`, and `destroy()`.
- Consumes callbacks `onState`, `onTranscript`, and `onError`.

- [ ] **Step 1: Write failing adapter tests with a complete recognition fake**

```js
test('voice input starts only after the explicit start call and returns an editable transcript', () => {
  const transcripts = [];
  const voice = createVoiceInput({ Recognition: FakeRecognition, onTranscript: (text) => transcripts.push(text) });
  assert.equal(FakeRecognition.instances.length, 1);
  assert.equal(FakeRecognition.instances[0].started, false);
  voice.start();
  FakeRecognition.instances[0].emitResult('查一下万嘉今天的数据');
  assert.deepEqual(transcripts, ['查一下万嘉今天的数据']);
  voice.stop();
  assert.equal(FakeRecognition.instances[0].stopped, true);
});

test('unsupported or denied recognition preserves keyboard mode', () => {
  assert.equal(createVoiceInput({ Recognition: null }).supported, false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/voice-input.test.mjs`
Expected: FAIL because `src/app/voice-input.mjs` does not exist.

- [ ] **Step 3: Implement the browser recognition adapter**

```js
export function createVoiceInput(options = {}) {
  const Recognition = options.Recognition || globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!Recognition) return { supported: false, state: () => 'unsupported', start() {}, stop() {}, destroy() {} };
  const recognition = new Recognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;
  let state = 'idle';
  recognition.onresult = (event) => options.onTranscript?.(Array.from(event.results).map((result) => result[0]?.transcript || '').join('').trim());
  recognition.onerror = (event) => { state = event.error === 'not-allowed' ? 'permission_denied' : 'failed'; options.onError?.(state); };
  recognition.onend = () => { if (state !== 'permission_denied') state = 'idle'; options.onState?.(state); };
  return {
    supported: true,
    state: () => state,
    start() { state = 'listening'; options.onState?.(state); recognition.start(); },
    stop() { state = 'transcribing'; options.onState?.(state); recognition.stop(); },
    destroy() { recognition.abort?.(); state = 'idle'; },
  };
}
```

- [ ] **Step 4: Verify adapter behavior and commit**

Run: `node --test tests/voice-input.test.mjs`
Expected: PASS with no microphone access during the Node test.

Commit: `git add src/app/voice-input.mjs src/app.mjs tests/voice-input.test.mjs && git commit -m "feat: add explicit voice input adapter"`

---

### Task 4: AI-first homepage view and interaction

**Files:**
- Create: `tests/ai-command-view.test.mjs`
- Create: `src/app/views/ai-command-view.mjs`
- Modify: `src/app/views/dashboard-view.mjs`
- Modify: `src/app.mjs`
- Modify: `assets/app.css`

**Interfaces:**
- Consumes: command model `{ input, scope, state, voice, result, preview, undo }`.
- Produces stable event hooks: `data-ai-command-form`, `data-ai-command-input`, `data-ai-command-scope`, `data-ai-voice-toggle`, `data-ai-command-action`, `data-ai-command-confirm`, `data-ai-command-undo`.

- [ ] **Step 1: Write failing render and accessibility tests**

```js
test('work homepage renders the AI command surface before business modules', () => {
  const root = { innerHTML: '' };
  renderDashboard(root, dashboardFixture({ aiCommand: { input: '', scope: 'auto', state: 'idle', voice: { supported: true } } }));
  assert.ok(root.innerHTML.indexOf('data-ai-command-form') < root.innerHTML.indexOf('v14-kpi-grid'));
  assert.match(root.innerHTML, /aria-label="按住说话或点击麦克风"/);
  assert.match(root.innerHTML, /事实.*推断.*建议.*待确认.*下一步/s);
});

test('unsupported voice shows text fallback without disabling submission', () => {
  const root = { innerHTML: '' };
  renderAiCommand(root, { input: '查询知识库', state: 'unsupported', voice: { supported: false } });
  assert.match(root.innerHTML, /当前浏览器不支持语音/);
  assert.doesNotMatch(root.innerHTML, /data-ai-command-submit[^>]*disabled/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/ai-command-view.test.mjs`
Expected: FAIL because the view does not exist and the dashboard lacks the command surface.

- [ ] **Step 3: Implement the focused view and dashboard mount**

Render one semantic `<section class="ai-command-surface">` containing the label, editable textarea, 48px microphone button, context chips, submit button, privacy note, progressive state message, structured result sections, L1 undo, and L2 preview. `dashboard-view.mjs` imports the renderer as an HTML-producing helper and places it immediately after the sync rail; all existing hero/KPI/business markup remains below it.

- [ ] **Step 4: Add delegated event handling without full-page double render**

In `app.mjs`, handle `submit`, `pointerdown`, `pointerup`, `pointercancel`, `click`, and input/change events through the existing root listeners. A microphone click toggles; press-and-hold starts on pointerdown and stops on pointerup. The event branch updates only the command model and calls the existing single modular render path once.

- [ ] **Step 5: Add restrained responsive styling**

Use existing color tokens and glass material. Requirements: textarea readable at 390px, microphone target at least 48px, focus-visible ring, pressed scale no lower than `0.97`, listening pulse limited to the microphone, `prefers-reduced-motion` disables the pulse, and no `transition: all`.

- [ ] **Step 6: Verify view and existing no-double-render regressions**

Run: `node --test tests/ai-command-view.test.mjs tests/homepage-presence.test.mjs tests/app-composition.test.mjs tests/apple-interaction-system.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Commit: `git add src/app/views/ai-command-view.mjs src/app/views/dashboard-view.mjs src/app.mjs assets/app.css tests/ai-command-view.test.mjs && git commit -m "feat: add AI-first home command surface"`

---

### Task 5: Version, cache, backup, and regression protection

**Files:**
- Modify: `index.html`
- Modify: `manifest.json`
- Modify: `sw.js`
- Modify: all changed versioned ESM imports under `src/`
- Modify: `tests/pwa-baseline.test.mjs`
- Modify: `tests/pwa-versioned-imports.test.mjs`
- Modify: `tests/v2-release.test.mjs`
- Create: `docs/releases/zos-workbench-v2.9.0.md`

**Interfaces:**
- Produces one coherent `2.9.0` browser asset graph and rollback record.

- [ ] **Step 1: Update release tests first and verify RED**

Change literal expected version values from `2.8.4` to `2.9.0` and add the new command modules to the PWA asset graph assertion.

Run: `node --test tests/pwa-baseline.test.mjs tests/pwa-versioned-imports.test.mjs tests/v2-release.test.mjs`
Expected: FAIL because production files still identify `2.8.4` and the new assets are not cached.

- [ ] **Step 2: Update the complete version graph**

Update `APP_VERSION`, HTML metadata, manifest version, service worker cache name and precache list, and every startup-critical query suffix to `2.9.0`. Include the five new modules and their tests in the release record.

- [ ] **Step 3: Write the release and rollback record**

Document scope, excluded phase-2 features, data preservation, privacy boundary, automated verification, Browser/Chrome/Computer Use checklist, deployment procedure, and rollback to tag `zos-workbench-v2.8.4` / commit `29cb3ab`.

- [ ] **Step 4: Verify release tests and commit**

Run: `node --test tests/pwa-baseline.test.mjs tests/pwa-versioned-imports.test.mjs tests/v2-release.test.mjs`
Expected: PASS.

Commit: `git add index.html manifest.json sw.js src tests docs/releases/zos-workbench-v2.9.0.md && git commit -m "chore: prepare ZOS v2.9.0 release"`

---

### Task 6: Full verification, real UI acceptance, GitHub publication

**Files:**
- Modify only if a verified failure requires a TDD fix.
- Tag after all gates pass: `zos-workbench-v2.9.0`.

**Interfaces:**
- Consumes the complete v2.9.0 build.
- Produces test evidence, three-device acceptance evidence, GitHub backup, production URL, and rollback reference.

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
node --test tests/*.test.mjs
git diff --check
node --check src/app.mjs
node --check src/app/ai-command-center.mjs
node --check src/app/intent-router.mjs
node --check src/app/controlled-execution.mjs
node --check src/app/voice-input.mjs
node --check src/app/views/ai-command-view.mjs
```

Expected: at least 619 tests, zero failures, zero syntax errors, and clean diff check.

- [ ] **Step 2: Browser acceptance at 1440, 834, and 390 widths**

Verify: AI surface is first, body is non-empty, no horizontal overflow, typed request reaches OpenAI, unsupported voice keeps keyboard enabled, L1 shows undo, L2 shows preview, existing dashboard modules remain accessible, and console errors equal zero.

- [ ] **Step 3: Chrome logged-in acceptance**

Using the existing Chrome session, verify Supabase-authenticated OpenAI response and current data sources. Do not expose access tokens, raw responses, or credentials.

- [ ] **Step 4: Computer Use tactile acceptance**

Verify real focus, press, hold/release, click toggle, drawer, navigation, reduced-motion behavior, and no double flash. If browser permissions block microphone automation, verify the safe permission/fallback state and perform no hidden permission changes.

- [ ] **Step 5: Commit any TDD fixes, then publish through GitHub**

Confirm branch scope, push `codex/ai-first-home-v2.9`, integrate through the repository's existing GitHub Pages release path, and wait for the deployment result. Do not alter unrelated branches or user files.

- [ ] **Step 6: Verify production resources and tag**

Confirm HTTP 200 and version `2.9.0` for:

- `https://xz1220z-afk.github.io/zos-workbench/`
- `https://xz1220z-afk.github.io/zos-workbench/manifest.json`
- `https://xz1220z-afk.github.io/zos-workbench/sw.js`
- `https://xz1220z-afk.github.io/zos-workbench/src/app.mjs`

Repeat Browser acceptance on production, then create and push `zos-workbench-v2.9.0` only after the live checks pass.

- [ ] **Step 7: Report exact evidence and rollback**

Report commit, tag, GitHub Pages URL, test counts, three viewport results, Browser/Chrome/Computer Use evidence, exclusions for phase 2, and rollback to `zos-workbench-v2.8.4` / `29cb3ab`.
