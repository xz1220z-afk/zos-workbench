import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createCeoOsApplication } from '../src/app.mjs';

function fakeStore(targets = [], decisions = []) {
  const listeners = new Set();
  let sequence = 0;
  const state = {
    schemaVersion: '1.4', deviceId: 'device-1', tombstones: [],
    collections: {
      tasks: [], inbox: [], projects: [], commands: [], decisions, targets,
      intelligence: [], calendar: [], life: [], focus_sessions: [], countdowns: [],
    },
  };
  return {
    load: () => structuredClone(state),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    saveEntity(entityType, fields) {
      const existing = state.collections[entityType].find((item) => item.id === fields.id);
      const record = {
        ...existing,
        ...structuredClone(fields),
        id: fields.id || `fake-${entityType}-${++sequence}`,
        revision: (existing?.revision || 0) + 1,
        deletedAt: null,
      };
      state.collections[entityType] = [
        ...state.collections[entityType].filter((item) => item.id !== record.id),
        record,
      ];
      listeners.forEach((listener) => listener(structuredClone(state)));
      return structuredClone(record);
    },
    deleteEntity(entityType, id) {
      const previous = state.collections[entityType].find((item) => item.id === id);
      if (!previous) throw new Error('record not found');
      const tombstone = {
        ...previous, entity: entityType, revision: previous.revision + 1,
        deletedAt: '2026-08-03T09:00:00.000Z',
      };
      state.collections[entityType] = state.collections[entityType].filter((item) => item.id !== id);
      state.tombstones = [...state.tombstones.filter((item) => !(item.entity === entityType && item.id === id)), tombstone];
      listeners.forEach((listener) => listener(structuredClone(state)));
      return structuredClone(tombstone);
    },
    restoreEntity(entityType, id) {
      const tombstone = state.tombstones.find((item) => item.entity === entityType && item.id === id);
      if (!tombstone) throw new Error('tombstone_not_found');
      const restored = { ...tombstone, revision: tombstone.revision + 1, deletedAt: null };
      delete restored.entity;
      state.tombstones = state.tombstones.filter((item) => !(item.entity === entityType && item.id === id));
      state.collections[entityType] = [...state.collections[entityType], restored];
      listeners.forEach((listener) => listener(structuredClone(state)));
      return structuredClone(restored);
    },
  };
}

function decisionLoop(initialDecision) {
  let decisions = [structuredClone(initialDecision)];
  return {
    async refresh() {}, confirmTargets() {}, ensureDailyBrief() { return null; },
    updateDecision(decision) {
      decisions = decisions.map((item) => item.id === decision.id ? structuredClone(decision) : item);
      return structuredClone(decision);
    },
    getState() {
      return { decisions: structuredClone(decisions), targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [], sources: {} };
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

function activePageDocument(pageId) {
  const document = renderDocument();
  const writes = new Map();
  document.querySelector = (selector) => selector === '.page.active' ? { id: `page-${pageId}` } : null;
  document.getElementById = (id) => {
    if (!document.nodes.has(id)) {
      let html = '';
      document.nodes.set(id, {
        get innerHTML() { return html; },
        set innerHTML(value) { html = value; writes.set(id, (writes.get(id) || 0) + 1); },
        textContent: '', style: {},
      });
    }
    return document.nodes.get(id);
  };
  document.writes = writes;
  return document;
}

test('renders cached content before remote startup settles', async () => {
  const calls = [];
  const syncGate = deferred();
  const intelligenceGate = deferred();
  const sourceGates = { wanjia: deferred(), huahuo: deferred(), lingli: deferred(), projects: deferred() };
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
      async loadExternalCalendar() { calls.push('calendar'); return { items: [], state: 'pending_configuration' }; },
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
  sourceGates.lingli.resolve();
  sourceGates.projects.resolve();
  await startPromise;
  await app.whenIdle();

  assert.equal(startedBeforeRemote, true);
  assert.deepEqual(calls, ['sync', 'wanjia', 'huahuo', 'lingli', 'projects', 'intelligence', 'calendar']);
  assert.ok(document.nodes.get('ceoDashboardRoot').innerHTML.length > 0);
});

test('wanjia history query reports when it only filters missing local history', () => {
  const app = createCeoOsApplication({
    document: renderDocument(),
    now: () => '2026-08-08T09:00:00.000Z',
    storage: { getItem: () => 'device-1', setItem() {} },
    store: fakeStore(),
  });

  app.applyWanjiaHistoryQuery({ range: { preset: 'today', startDate: '2026-08-08', endDate: '2026-08-08' } });

  assert.match(app.viewModel().wanjiaOps.history.queryFeedback, /已应用查询：2026-08-08 至 2026-08-08/);
  assert.match(app.viewModel().wanjiaOps.history.queryFeedback, /暂无已校验历史数据/);
});

test('Wanjia console switches context without changing operating data or user collections', () => {
  const app = createCeoOsApplication({
    document: renderDocument(), storage: { getItem: () => 'device-1', setItem() {} }, store: fakeStore(),
  });

  assert.equal(app.viewModel().wanjiaOps.navigation.active.id, 'overview');
  assert.equal(app.setWanjiaOpsPane('data_analysis'), 'data_analysis');
  assert.equal(app.viewModel().wanjiaOps.navigation.active.id, 'data_analysis');
  assert.equal(app.setWanjiaOpsPane('not-a-real-pane'), 'overview');
  assert.deepEqual(app.store.load().collections.tasks, []);
});

test('rendering a Wanjia interaction does not repaint hidden workspace pages', () => {
  const document = activePageDocument('local-life');
  const app = createCeoOsApplication({
    document, storage: { getItem: () => 'device-1', setItem() {} }, store: fakeStore(),
  });

  app.render();

  assert.ok((document.writes.get('wanjiaOperatingRoot') || 0) > 0);
  assert.ok((document.writes.get('merchantCenterRoot') || 0) > 0);
  assert.equal(document.writes.get('ceoDashboardRoot') || 0, 0);
  assert.equal(document.writes.get('lifeCenterRoot') || 0, 0);
  assert.equal(document.writes.get('calendarCenterRoot') || 0, 0);
});

test('switching Wanjia context repaints only the active panel after first render', () => {
  const document = activePageDocument('local-life');
  let panelWrites = 0;
  let rootWrites = 0;
  const panelHost = { set innerHTML(value) { panelWrites += 1; this.value = value; } };
  const root = {
    get innerHTML() { return this.value || ''; },
    set innerHTML(value) { rootWrites += 1; this.value = value; },
    querySelector: (selector) => selector === '[data-wanjia-panel-host]' ? panelHost : null,
    querySelectorAll: () => [],
  };
  document.getElementById = (id) => id === 'wanjiaOperatingRoot' ? root : document.nodes.get(id) || { innerHTML: '', textContent: '', style: {} };
  const app = createCeoOsApplication({
    document, storage: { getItem: () => 'device-1', setItem() {} }, store: fakeStore(),
  });

  app.setWanjiaOpsPane('merchant_ops');

  assert.equal(panelWrites, 1);
  assert.equal(rootWrites, 0);
  assert.match(panelHost.value, /商家作战/);
});

test('switching Wanjia context reuses the existing operating model', () => {
  const document = activePageDocument('local-life');
  const panelHost = { innerHTML: '' };
  const root = {
    innerHTML: '',
    querySelector: (selector) => selector === '[data-wanjia-panel-host]' ? panelHost : null,
    querySelectorAll: () => [],
  };
  document.getElementById = (id) => id === 'wanjiaOperatingRoot' ? root : document.nodes.get(id) || { innerHTML: '', textContent: '', style: {} };
  const store = fakeStore();
  let loads = 0;
  const originalLoad = store.load;
  store.load = () => { loads += 1; return originalLoad(); };
  const app = createCeoOsApplication({ document, storage: { getItem: () => 'device-1', setItem() {} }, store });

  app.render();
  const loadsAfterFirstRender = loads;
  app.setWanjiaOpsPane('merchant_ops');
  const loadsAfterMerchant = loads;
  app.setWanjiaOpsPane('growth_review');

  assert.ok(loadsAfterFirstRender > 0);
  assert.equal(loadsAfterMerchant - loadsAfterFirstRender, 1);
  assert.equal(loads - loadsAfterMerchant, 1);
});

test('rendering from a legacy-only route does not repaint modular workspace pages', () => {
  const document = activePageDocument('settings');
  const app = createCeoOsApplication({
    document, storage: { getItem: () => 'device-1', setItem() {} }, store: fakeStore(),
  });

  app.render();

  assert.equal(document.writes.get('ceoDashboardRoot') || 0, 0);
  assert.equal(document.writes.get('wanjiaOperatingRoot') || 0, 0);
  assert.equal(document.writes.get('agentWorkbenchRoot') || 0, 0);
});

test('application badge counts only decisions that require CEO judgment', async () => {
  const document = renderDocument();
  const operatingLoop = {
    async refresh() {}, confirmTargets() {}, ensureDailyBrief() { return null; },
    getState() {
      return {
        decisions: [
          { id: 'ceo', status: 'open', category: 'revenue_pending', factSummary: '确认待回款方案' },
          { id: 'follow', status: 'open', category: 'stale', factSummary: '普通项目超过 7 天未更新' },
          { id: 'history', status: 'pending_resolution', decisionNote: '来源风险已消失' },
        ],
        targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [], sources: {},
      };
    },
  };
  const app = createCeoOsApplication({
    document,
    storage: { getItem: () => 'device-1', setItem() {} },
    store: fakeStore(),
    operatingRuntime: { operatingLoop, syncController: { start() {} } },
  });

  await app.start();
  await app.whenIdle();

  assert.equal(document.nodes.get('decisionBadge').textContent, '1');
  assert.equal(document.nodes.get('decisionBadge').style.display, '');
});

test('decision actions persist, move between queues and undo as a newer revision', async () => {
  const decision = {
    id: 'decision-action-1', status: 'open', source: 'wanjia', sourceRecordId: 'rec-1',
    category: 'revenue_pending', severity: 'high', factSummary: '确认待回款方案',
    recommendedAction: '按回款计划推进', decisionScope: 'ceo', requiresCeoDecision: true,
    revision: 1,
  };
  const store = fakeStore([], [decision]);
  const operatingLoop = decisionLoop(decision);
  const app = createCeoOsApplication({
    document: renderDocument(), storage: { getItem: () => 'device-1', setItem() {} }, store,
    operatingRuntime: { operatingLoop, syncController: { start() {} } },
    now: () => '2026-08-07T10:00:00.000Z',
  });
  await app.start(); await app.whenIdle();

  app.openDecisionAction(decision.id, 'delegate');
  await app.confirmDecisionAction('交负责人跟进');
  assert.equal(app.viewModel().decisionQueues.ceo.length, 0);
  assert.equal(app.viewModel().decisionQueues.followUp.length, 1);
  assert.equal(store.load().collections.decisions[0].decisionScope, 'owner');
  assert.equal(operatingLoop.getState().decisions[0].requiresCeoDecision, false);

  const delegatedRevision = store.load().collections.decisions[0].revision;
  await app.undoDecisionAction();
  const restored = store.load().collections.decisions[0];
  assert.equal(restored.decisionScope, 'ceo');
  assert.equal(restored.requiresCeoDecision, true);
  assert.ok(restored.revision > delegatedRevision);
});

test('decision confirmation keeps drawer open on failure and ignores duplicate busy confirmation', async () => {
  const decision = {
    id: 'decision-action-2', status: 'open', source: 'huahuo', sourceRecordId: 'rec-2',
    category: 'high_risk', factSummary: '确认交付资源', recommendedAction: '安排负责人', revision: 1,
  };
  const working = fakeStore([], [decision]);
  let saves = 0;
  const countedStore = {
    ...working,
    saveEntity(...args) { saves += 1; return working.saveEntity(...args); },
  };
  const app = createCeoOsApplication({
    document: renderDocument(), storage: { getItem: () => 'device-1', setItem() {} }, store: countedStore,
    operatingRuntime: { operatingLoop: decisionLoop(decision), syncController: { start() {} } },
  });
  await app.start(); await app.whenIdle();
  app.openDecisionAction(decision.id, 'approve');
  const first = app.confirmDecisionAction('确认');
  const second = app.confirmDecisionAction('确认');
  await Promise.all([first, second]);
  assert.equal(saves, 1);

  const failing = fakeStore([], [decision]);
  const failedApp = createCeoOsApplication({
    document: renderDocument(), storage: { getItem: () => 'device-1', setItem() {} },
    store: { ...failing, saveEntity() { throw new Error('quota'); } },
    operatingRuntime: { operatingLoop: decisionLoop(decision), syncController: { start() {} } },
  });
  await failedApp.start(); await failedApp.whenIdle();
  failedApp.openDecisionAction(decision.id, 'approve');
  await assert.rejects(() => failedApp.confirmDecisionAction('确认'), /quota/);
  assert.equal(failedApp.runtime.decisionUi.action.decisionId, decision.id);
  assert.equal(failedApp.runtime.decisionUi.error, '保存失败，请重试；原记录未被删除。');

  failedApp.openDecisionAction(decision.id, 'defer');
  await assert.rejects(() => failedApp.confirmDecisionAction(''), /暂缓前请填写原因/);
  assert.equal(failedApp.runtime.decisionUi.error, '暂缓前请填写原因。');
});

test('decision history supports visible selection, safe batch review and one-step undo', async () => {
  const decisions = [
    { id: 'history-1', status: 'approved', source: 'wanjia', sourceRecordId: 'rec-1', category: 'review', factSummary: '已完成事项', revision: 1 },
    { id: 'history-2', status: 'deferred', source: 'huahuo', sourceRecordId: 'rec-2', category: 'review', factSummary: '暂缓事项', revision: 1 },
  ];
  const store = fakeStore([], decisions);
  const app = createCeoOsApplication({
    document: renderDocument(), storage: { getItem: () => 'device-1', setItem() {} }, store,
    now: () => '2026-08-07T10:00:00.000Z',
  });
  await app.start(); await app.whenIdle();

  app.setDecisionSelection(['history-1', 'history-2']);
  const result = await app.executeDecisionBatch('review_history');
  assert.equal(result.changed.length, 2);
  assert.equal(store.load().collections.decisions.every((item) => item.historyReviewed), true);
  assert.deepEqual(app.runtime.decisionUi.selectedIds, []);

  await app.undoDecisionAction();
  assert.equal(store.load().collections.decisions.every((item) => !item.historyReviewed), true);
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
    ['sync'], ['refresh', 'wanjia'], ['refresh', 'huahuo'], ['refresh', 'lingli'], ['refresh', 'projects'], ['targets', ['target-1']], ['brief'],
  ]);
  assert.equal(app.viewModel().decisions[0].id, 'decision-1');
  assert.equal(app.viewModel().gaps[0].gap, 2000);
  assert.equal(app.viewModel().brief.id, 'brief-1');
});

test('dashboard desktop and mobile roots receive the same dynamic homepage presence', () => {
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} },
    store: fakeStore(),
  });

  assert.equal(app.viewModel().homePresence.title, '今天的节奏已排好');
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
    'src/app/daily-digest.mjs',
  ]) assert.match(serviceWorker, new RegExp(asset.replaceAll('.', '\\.')), `${asset} must be cached`);
  assert.match(serviceWorker, /asset\.endsWith\('\.mjs'\) \? `\$\{asset\}\?v=2\.11\.0`/);
});

test('Wanjia operations keeps legacy numbers historical and opens only a merchant task draft', () => {
  const document = renderDocument();
  const app = createCeoOsApplication({
    document,
    now: () => '2026-08-08T09:00:00+08:00',
    storage: { getItem: () => 'device-1', setItem() {} },
    store: fakeStore(),
  });
  app.runtime.sources = {
    wanjia: {
      summary: { totalMerchants: 342, activeMerchants: 218, paymentGmv: 2882884 },
      records: { records: [{
        id: 'm1', merchantId: 'L-001', merchantName: '老街奶茶', owner: '阿林',
        paymentGmv: 0, redeemedGmv: 0, dataDate: '2026-07-31', updatedAt: '2026-07-31T10:00:00Z',
      }] },
      fetchedAt: '2026-08-07T02:00:00Z',
    },
  };
  const model = app.viewModel().wanjiaOps;
  assert.equal(model.status.state, 'historical_snapshot');
  assert.equal(model.kpis.every((item) => item.display === '待同步'), true);
  assert.equal(model.merchants.length, 0, 'historical rows must not enter the current merchant work queue');
  app.runtime.sources.wanjia = {
    dataStatus: {
      state: 'realtime_validated', dataDate: '2026-08-08', validation: 'passed',
      lastSyncedAt: '2026-08-08T08:55:00+08:00', sourceTables: ['01.04.04｜林客每日汇总'],
    },
    summary: {
      totalMerchants: 1, activeMerchants: 0, todayPaymentGmv: 0, todayRedeemedGmv: 0,
      averageRedemptionRate: 0, exceptionMerchants: 1, pendingExceptions: 1, completedTasksToday: 0,
    },
    records: { records: [{
      id: 'm1', merchantId: 'L-001', merchantName: '老街奶茶', owner: '阿林',
      paymentGmv: 0, redeemedGmv: 0, dataDate: '2026-08-08', updatedAt: '2026-08-08T08:55:00+08:00',
    }] },
  };
  const draft = app.openWanjiaTaskDraft('m1');
  assert.equal(draft.company, 'wanjia');
  assert.equal(draft.businessEntityId, 'm1');
  assert.match(draft.description, /仅为草案，不会自动派单或写回飞书/);
  assert.equal(app.store.load().collections.tasks.length, 0, 'opening a draft must not persist or dispatch it');
});

test('the shell captures raw pre-upgrade state before either application module can migrate it', async () => {
  const root = new URL('../', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  const capture = html.indexOf('window.__ZOS_PRE_UPGRADE_RAW__');
  assert.ok(capture >= 0);
  assert.ok(capture < html.indexOf('src/legacy-app.mjs?v=2.11.0'));
  assert.ok(capture < html.indexOf('src/app.mjs?v=2.11.0'));
});

test('enabled closed-app reminders synchronize current tasks calendar deadlines and daily digests', async () => {
  const scheduled = [];
  const store = fakeStore();
  store.saveEntity('tasks', {
    id: 'task-1', title: '确认回款', status: 'todo', reminderAt: '2026-08-05T09:00:00+08:00',
  });
  store.saveEntity('calendar', {
    id: 'calendar-1', title: '团队周会', status: 'scheduled', source: 'user_calendar', privacy: 'work',
    startAt: '2026-08-05T10:00:00+08:00', endAt: '2026-08-05T11:00:00+08:00', reminders: [30],
  });
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} }, store,
    now: () => '2026-08-04T00:00:00.000Z',
    operatingRuntime: {
      session: { userId: 'owner-1' },
      pushClient: {
        async status() { return { state: 'enabled', publicKey: 'AQID' }; },
        async schedule(jobs) { scheduled.push(structuredClone(jobs)); return { state: 'enabled', scheduled: jobs.length }; },
      },
    },
    autoRefreshFactory: () => ({ start() {}, stop() {}, async refresh() {} }),
  });
  await app.start();
  await app.whenIdle();
  assert.equal(app.runtime.reminderScheduleState, 'synced');
  assert.ok(scheduled.at(-1).some((item) => item.entityType === 'task' && item.entityId === 'task-1'));
  assert.ok(scheduled.at(-1).some((item) => item.entityType === 'calendar' && item.entityId === 'calendar-1'));
  assert.ok(scheduled.at(-1).some((item) => item.entityType === 'evening_digest'));
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

test('application calendar actions edit delete restore copy and move only local events', () => {
  const store = fakeStore();
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} },
    store,
    createOperatingRuntime: false,
    now: () => '2026-08-03T08:00:00.000Z',
  });
  const created = app.saveCalendar({
    title: '周会', startAt: '2026-08-03T10:00:00+08:00', endAt: '2026-08-03T11:00:00+08:00',
  });
  assert.equal(app.saveCalendar({ id: created.id, title: '经营周会' }).title, '经营周会');
  assert.equal(app.moveCalendar(created.id, {
    startAt: '2026-08-04T10:00:00+08:00', endAt: '2026-08-04T11:00:00+08:00',
  }).startAt.slice(0, 10), '2026-08-04');
  const copy = app.copyCalendar(created.id);
  assert.notEqual(copy.id, created.id);
  assert.equal(copy.title, '经营周会（副本）');
  app.deleteCalendar(created.id);
  assert.equal(app.restoreCalendar(created.id).title, '经营周会');
  assert.throws(() => app.deleteCalendar('external-event'), /calendar_local_event_required/);
});

test('calendar navigation changes anchors and requests only the visible range', async () => {
  const calls = [];
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {}, visibilityState: 'visible' },
    storage: { getItem: () => 'device-1', setItem() {} },
    store: fakeStore(),
    now: () => '2026-08-03T08:00:00.000Z',
    operatingRuntime: {
      async loadExternalCalendar(range) { calls.push(range); return { items: [], state: 'synced' }; },
    },
  });
  app.setCalendarView('month');
  await app.navigateCalendar(1);
  assert.equal(app.runtime.calendarAnchor, '2026-09-03');
  assert.equal(calls.at(-1).start, '2026-08-31T00:00:00+08:00');
  assert.equal(calls.at(-1).end, '2026-10-12T00:00:00+08:00');
});

test('external events cannot be dragged or deleted through public actions', () => {
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} }, store: fakeStore(),
    createOperatingRuntime: false,
  });
  app.runtime.externalCalendar = [{
    id: 'feishu:event-1', source: 'feishu_calendar', title: '飞书会议',
    startAt: '2026-08-04T02:00:00.000Z', endAt: '2026-08-04T03:00:00.000Z',
  }];
  assert.throws(() => app.deleteCalendar('feishu:event-1'), /calendar_local_event_required/);
  assert.throws(() => app.moveCalendar('feishu:event-1', { startAt: '2026-08-05T10:00' }), /calendar_local_event_required/);
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
