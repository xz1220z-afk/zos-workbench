import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createCeoOsApplication } from '../src/app.mjs';

function fakeStore(targets = []) {
  const listeners = new Set();
  const state = {
    schemaVersion: '1.4', deviceId: 'device-1', tombstones: [],
    collections: { tasks: [], inbox: [], projects: [], commands: [], decisions: [], targets, intelligence: [], calendar: [], life: [] },
  };
  return {
    load: () => structuredClone(state),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    saveEntity(entityType, fields) {
      state.collections[entityType] = [
        ...state.collections[entityType].filter((item) => item.id !== fields.id),
        structuredClone(fields),
      ];
      listeners.forEach((listener) => listener(structuredClone(state)));
      return structuredClone(fields);
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function renderDocument() {
  const nodes = new Map();
  return {
    nodes,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', style: {} });
      return nodes.get(id);
    },
    addEventListener() {},
  };
}

test('renders cached content before remote startup settles', async () => {
  const calls = [];
  const syncGate = deferred();
  const intelligenceGate = deferred();
  const sourceGates = { wanjia: deferred(), huahuo: deferred(), projects: deferred() };
  const document = renderDocument();
  const operatingLoop = {
    async refresh(source) { calls.push(source); await sourceGates[source].promise; },
    confirmTargets() {},
    ensureDailyBrief() { return null; },
    getState() {
      return { decisions: [], targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [], sources: {} };
    },
  };
  const app = createCeoOsApplication({
    document,
    storage: { getItem: () => 'device-1', setItem() {} },
    store: fakeStore(),
    operatingRuntime: {
      operatingLoop,
      syncController: { start() {}, async sync() { calls.push('sync'); await syncGate.promise; } },
      async loadIntelligence() { calls.push('intelligence'); await intelligenceGate.promise; return { items: [] }; },
    },
  });

  const startPromise = app.start();
  const startedBeforeRemote = await Promise.race([
    startPromise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 20)),
  ]);
  syncGate.resolve();
  intelligenceGate.resolve();
  sourceGates.wanjia.resolve();
  sourceGates.huahuo.resolve();
  sourceGates.projects.resolve();
  await startPromise;
  await app.whenIdle();

  assert.equal(startedBeforeRemote, true);
  assert.deepEqual(calls, ['sync', 'wanjia', 'huahuo', 'projects', 'intelligence']);
  assert.ok(document.nodes.get('ceoDashboardRoot').innerHTML.length > 0);
});

test('production application drives the authenticated operating loop on startup', async () => {
  const calls = [];
  const target = { id: 'target-1', metricKey: 'wanjia.paymentGmv', value: 10000, confirmation: 'confirmed' };
  const operatingLoop = {
    async refresh(source) { calls.push(['refresh', source]); },
    confirmTargets(targets) { calls.push(['targets', targets.map((item) => item.id)]); },
    ensureDailyBrief() { calls.push(['brief']); return { id: 'brief-1', date: '2026-08-02', kind: 'daily_brief', reviewStatus: 'pending_review', sections: { todayTop3: [] } }; },
    getState() {
      return {
        decisions: [{ id: 'decision-1', status: 'open', source: 'wanjia', sourceRecordId: 'rec-1', factSummary: '测试事实', recommendedAction: '联系负责人' }],
        targets: [target], gaps: [{ metricKey: target.metricKey, target: 10000, actual: 8000, gap: 2000 }],
        briefs: [], health: [{ source: 'wanjia', state: 'synced' }], conflicts: [], approvals: [], sources: {},
      };
    },
  };
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage: { getItem: () => 'device-1', setItem() {} },
    store: fakeStore([target]), operatingRuntime: { operatingLoop, syncController: { start() { calls.push(['sync']); } } },
  });

  await app.start();
  await app.whenIdle();

  assert.deepEqual(calls, [
    ['sync'], ['refresh', 'wanjia'], ['refresh', 'huahuo'], ['refresh', 'projects'], ['targets', ['target-1']], ['brief'],
  ]);
  assert.equal(app.viewModel().decisions[0].id, 'decision-1');
  assert.equal(app.viewModel().gaps[0].gap, 2000);
  assert.equal(app.viewModel().brief.id, 'brief-1');
});

test('application exposes the source-aware three-company operating contract', async () => {
  const operatingLoop = {
    async refresh() {}, confirmTargets() {}, ensureDailyBrief() { return null; },
    getState() {
      return {
        decisions: [], targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [],
        sources: {
          wanjia: { fetchedAt: '2026-08-03T01:00:00.000Z', summary: { paymentGmv: 8800, activeMerchants: 3, totalMerchants: 4 } },
          huahuo: { fetchedAt: '2026-08-03T01:00:00.000Z', summary: { contractAmount: 12000, receivedAmount: 5000, outstandingAmount: 7000 } },
          lingli: { fetchedAt: '2026-08-03T01:00:00.000Z', summary: { received: 3000, students: 9 } },
        },
      };
    },
  };
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} },
    store: fakeStore(), operatingRuntime: { operatingLoop, syncController: { start() {} } },
  });

  await app.start();
  await app.whenIdle();
  const companies = app.viewModel().companyOperating;
  assert.equal(companies.wanjia.businessVolume.value, 8800);
  assert.equal(companies.wanjia.finance.cashIn.value, null);
  assert.equal(companies.huahuo.finance.outstanding.value, 7000);
  assert.equal(companies.lingli.operations.students.value, 9);
});

test('application actions keep targets local and require preview before an individual Feishu execution', async () => {
  const targetCalls = [];
  const previewCalls = [];
  const executeCalls = [];
  const store = fakeStore();
  const operatingLoop = {
    async refresh() {},
    confirmTargets(targets) { targetCalls.push(structuredClone(targets)); return []; },
    ensureDailyBrief() { return null; },
    async previewFeishu(proposal) { previewCalls.push(proposal); return { approvalId: 'approval-1', fieldName: '下一步动作', before: '旧动作', after: proposal.value }; },
    async executeFeishu(approvalId) { executeCalls.push(approvalId); return { approvalId, verified: true, status: 'executed' }; },
    getState() {
      return {
        decisions: [{ id: 'decision-1', status: 'open', source: 'wanjia', sourceRecordId: 'rec-1', recommendedAction: '联系负责人' }],
        targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [], sources: {},
      };
    },
  };
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage: { getItem: () => 'device-1', setItem() {} },
    store, operatingRuntime: { operatingLoop, syncController: { start() {} } }, now: () => '2026-08-02T08:00:00.000Z',
  });
  await app.start();
  await app.whenIdle();

  app.confirmTarget({ metricKey: 'wanjia.paymentGmv', value: 12000, period: '2026-08' });
  assert.equal(store.load().collections.targets[0].confirmation, 'confirmed');
  assert.equal(targetCalls.at(-1)[0].value, 12000);

  const preview = await app.previewDecision('decision-1');
  assert.equal(preview.approvalId, 'approval-1');
  assert.deepEqual(previewCalls[0], { source: 'wanjia', recordId: 'rec-1', action: 'set_next_action', value: '联系负责人' });
  assert.deepEqual(executeCalls, [], 'preview must not execute the Feishu write');
  await app.executeApproval('approval-1');
  assert.deepEqual(executeCalls, ['approval-1']);
});

test('service worker caches the complete transitive browser module graph', async () => {
  const root = new URL('../', import.meta.url);
  const serviceWorker = await readFile(new URL('sw.js', root), 'utf8');
  for (const asset of [
    'src/app/browser-runtime.mjs', 'src/business-data-client.mjs', 'src/supabase-auth.mjs',
    'src/supabase-transport.mjs', 'src/sync-engine.mjs', 'src/data-model.mjs',
    'src/app/auto-refresh-controller.mjs',
  ]) assert.match(serviceWorker, new RegExp(asset.replaceAll('.', '\\.')), `${asset} must be cached`);
});

test('calendar creation and review generation stay in private synchronized collections', () => {
  const store = fakeStore();
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} }, store, createOperatingRuntime: false,
    now: () => '2026-08-02T08:00:00.000Z',
  });
  const event = app.captureCalendar({ title: '团队周会', startAt: '2026-08-03 10:00' });
  const review = app.generateReview('weekly_business');
  assert.equal(event.privacy, 'work');
  assert.equal(store.load().collections.calendar.length, 1);
  assert.equal(review.status, 'pending_review');
  assert.equal(store.load().collections.inbox.at(-1).kind, 'review_draft');
});

test('company agent output is stored only as an Inbox review draft', async () => {
  const store = fakeStore();
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} }, store,
    createOperatingRuntime: false, now: () => '2026-08-03T09:00:00.000Z',
  });

  const draft = await app.generateAgentDraft('ceo');
  assert.equal(draft.reviewStatus, 'pending_review');
  assert.equal(store.load().collections.inbox[0].kind, 'agent_draft');
  assert.deepEqual(draft.sideEffects, []);
});

test('signed-out startup reports intelligence authentication instead of loading forever', async () => {
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} }, store: fakeStore(),
  });

  await app.start();
  await app.whenIdle();

  assert.equal(app.viewModel().intelligenceState, 'authentication_required');
});

test('intelligence source configuration state is preserved from the protected endpoint', async () => {
  const operatingLoop = {
    async refresh() {}, confirmTargets() {}, ensureDailyBrief() { return null; },
    getState() { return { decisions: [], targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [], sources: {} }; },
  };
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} }, store: fakeStore(),
    operatingRuntime: {
      operatingLoop, syncController: { start() {} },
      async loadIntelligence() { return { items: [], state: 'pending_configuration' }; },
    },
  });

  await app.start();
  await app.whenIdle();

  assert.equal(app.viewModel().intelligenceState, 'pending_configuration');
});
