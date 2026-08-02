import test from 'node:test';
import assert from 'node:assert/strict';

import { createCeoOsApplication } from '../src/app.mjs';
import { render as renderDashboard } from '../src/app/views/dashboard-view.mjs';

function fakeStore() {
  const state = {
    schemaVersion: '1.4', deviceId: 'device-1', tombstones: [],
    collections: {
      tasks: [], inbox: [], projects: [], commands: [], decisions: [], targets: [],
      intelligence: [], calendar: [], life: [],
    },
  };
  return {
    load: () => structuredClone(state),
    subscribe() { return () => {}; },
    saveEntity(type, item) {
      state.collections[type] = [...(state.collections[type] || []).filter((row) => row.id !== item.id), structuredClone(item)];
      return structuredClone(item);
    },
  };
}

function fakeAutoRefreshFactory(log) {
  return ({ refreshAll, onStatus }) => ({
    start() { log.push('controller:start'); },
    stop() { log.push('controller:stop'); },
    async refresh(reason) {
      onStatus({ phase: 'refreshing', reason, succeeded: [], failed: [] });
      const result = await refreshAll(reason);
      onStatus({ phase: result.failed.length ? 'partial' : 'idle', reason, ...result, lastSuccessAt: '2026-08-02T08:00:00.000Z' });
      return result;
    },
    getStatus() { return { phase: 'idle', succeeded: [], failed: [] }; },
  });
}

test('startup refreshes every connected source without visiting company pages', async () => {
  const calls = [];
  const sources = {};
  const operatingLoop = {
    async refresh(source) {
      calls.push(`business:${source}`);
      sources[source] = { source, records: [], summary: {}, health: { recordCount: 0, lastSuccessAt: '2026-08-02T08:00:00.000Z' } };
    },
    confirmTargets() {},
    ensureDailyBrief() { return null; },
    getState() {
      return { decisions: [], targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [], sources };
    },
  };
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} },
    store: fakeStore(),
    operatingRuntime: {
      operatingLoop,
      syncController: { start() { calls.push('sync:start'); }, async sync(reason) { calls.push(`sync:${reason}`); } },
      async loadIntelligence({ refresh }) { calls.push(`intelligence:${refresh}`); return { items: [], state: 'cached' }; },
    },
    autoRefreshFactory: fakeAutoRefreshFactory(calls),
  });

  await app.start();
  await app.whenIdle();

  assert.deepEqual(calls, [
    'sync:start', 'controller:start', 'sync:startup',
    'business:wanjia', 'business:huahuo', 'business:projects', 'intelligence:true',
  ]);
  assert.equal(app.viewModel().autoRefresh.phase, 'idle');
  assert.deepEqual(app.viewModel().autoRefresh.succeeded.sort(), ['huahuo', 'intelligence', 'projects', 'sync', 'wanjia']);
});

test('one source failure keeps other sources successful and exposes only a safe code', async () => {
  const calls = [];
  const operatingLoop = {
    async refresh(source) {
      if (source === 'huahuo') throw new Error('Feishu app has no permission for the configured Bitable');
    },
    confirmTargets() {}, ensureDailyBrief() { return null; },
    getState() { return { decisions: [], targets: [], gaps: [], briefs: [], health: [], conflicts: [], approvals: [], sources: {} }; },
  };
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} }, store: fakeStore(),
    operatingRuntime: {
      operatingLoop,
      syncController: { start() {}, async sync() {} },
      async loadIntelligence() { return { items: [], state: 'cached' }; },
    },
    autoRefreshFactory: fakeAutoRefreshFactory(calls),
  });

  await app.start();
  await app.whenIdle();

  assert.equal(app.viewModel().autoRefresh.phase, 'partial');
  assert.deepEqual(app.viewModel().autoRefresh.failed, [{ source: 'huahuo', safeCode: 'feishu_permission_denied' }]);
  assert.ok(app.viewModel().autoRefresh.succeeded.includes('wanjia'));
  assert.doesNotMatch(JSON.stringify(app.viewModel().autoRefresh), /configured Bitable/);
});

test('dashboard renders a single refresh-all control and source-level status', () => {
  const container = { innerHTML: '' };
  renderDashboard(container, {
    today: '2026-08-02', health: [], decisions: [], gaps: [], todayTop3: [], mustRead: [],
    calendarConflicts: [], calendar: [], sources: {},
    autoRefresh: {
      phase: 'partial', lastSuccessAt: '2026-08-02T08:00:00.000Z',
      succeeded: ['wanjia', 'projects'],
      failed: [{ source: 'huahuo', safeCode: 'feishu_permission_denied' }],
    },
  });

  assert.equal((container.innerHTML.match(/data-refresh-all/g) || []).length, 1);
  assert.match(container.innerHTML, /自动更新/);
  assert.match(container.innerHTML, /万嘉/);
  assert.match(container.innerHTML, /花火/);
  assert.match(container.innerHTML, /部分来源未更新/);
});
