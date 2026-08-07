import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createCeoOsApplication } from '../src/app.mjs';

function fakeStore(targets = []) {
  const listeners = new Set();
  let sequence = 0;
  const state = {
    schemaVersion: '1.4', deviceId: 'device-1', tombstones: [],
    collections: {
      tasks: [], inbox: [], projects: [], commands: [], decisions: [], targets,
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
  assert.match(serviceWorker, /asset\.endsWith\('\.mjs'\) \? `\$\{asset\}\?v=2\.0\.3`/);
});

test('the shell captures raw pre-upgrade state before either application module can migrate it', async () => {
  const root = new URL('../', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  const capture = html.indexOf('window.__ZOS_PRE_UPGRADE_RAW__');
  assert.ok(capture >= 0);
  assert.ok(capture < html.indexOf('src/legacy-app.mjs?v=2.0.3'));
  assert.ok(capture < html.indexOf('src/app.mjs?v=2.0.3'));
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
