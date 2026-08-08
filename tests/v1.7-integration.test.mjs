import test from 'node:test';
import assert from 'node:assert/strict';

import { createCeoOsApplication } from '../src/app.mjs';

function fakeStore(seed = {}) {
  const listeners = new Set();
  const names = [
    'tasks', 'inbox', 'projects', 'commands', 'decisions', 'targets',
    'intelligence', 'calendar', 'life', 'focus_sessions', 'countdowns',
  ];
  const state = {
    schemaVersion: '1.7', deviceId: 'device-v17', tombstones: [],
    collections: Object.fromEntries(names.map((name) => [name, structuredClone(seed[name] || [])])),
  };
  let counter = 0;
  return {
    load: () => structuredClone(state),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    saveEntity(entityType, fields) {
      const record = { ...structuredClone(fields), id: fields.id || `generated-${++counter}` };
      state.collections[entityType] = [
        ...state.collections[entityType].filter((item) => item.id !== record.id), record,
      ];
      listeners.forEach((listener) => listener(structuredClone(state)));
      return structuredClone(record);
    },
  };
}

function createApp(store, sources = {}) {
  const app = createCeoOsApplication({
    store,
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-v17', setItem() {} },
    now: () => '2026-08-03T09:00:00.000+08:00',
    createOperatingRuntime: false,
  });
  app.runtime.sources = sources;
  return app;
}

test('rich tasks and intelligence follow-up preserve execution and evidence fields', () => {
  const store = fakeStore();
  const app = createApp(store);
  const task = app.saveTask({
    title: '  跟进商家经营方案  ', description: '核对本周数据', priority: 3,
    dueAt: '2026-08-04T18:00:00+08:00', tags: ['万嘉', '经营'], company: 'wanjia',
    businessEntityType: 'merchant', businessEntityId: 'merchant-1', estimateMinutes: 45,
    reminderAt: '2026-08-04T17:00:00+08:00', recurrence: 'weekly',
    subtasks: [{ title: '联系老板' }, { title: '复核 GMV' }],
  });
  assert.equal(task.title, '跟进商家经营方案');
  assert.equal(task.priority, 3);
  assert.equal(task.subtasks.length, 2);
  assert.equal(store.load().collections.tasks.length, 1);

  const intelligenceTask = app.convertIntelligenceToTask({
    externalId: 'intel-1', title: '平台新规', sourceUrl: 'https://example.com/policy',
    relevantCompanies: ['wanjia'], followUpAt: '2026-08-05T09:30:00+08:00',
  });
  assert.equal(intelligenceTask.title, '跟进情报：平台新规');
  assert.equal(intelligenceTask.businessEntityType, 'intelligence');
  assert.equal(intelligenceTask.businessEntityId, 'intel-1');
  assert.equal(intelligenceTask.sourceUrl, 'https://example.com/policy');
  assert.equal(intelligenceTask.company, 'wanjia');
});

test('countdown and completed focus session persist and update the bound task', () => {
  const store = fakeStore({ tasks: [{ id: 'task-1', title: '写经营复盘', status: 'todo' }] });
  const app = createApp(store);
  const countdown = app.saveCountdown({ title: '花火周年', date: '2026-08-20', recurrence: 'yearly' });
  assert.equal(countdown.date, '2026-08-20');

  const session = app.createFocus({ taskId: 'task-1', title: '写经营复盘', durationMinutes: 25 }, { now: '2026-08-03T01:00:00.000Z', id: 'focus-1' });
  assert.equal(session.state, 'planned');
  assert.equal(app.transitionCurrentFocus('start', { now: '2026-08-03T01:00:00.000Z' }).state, 'running');
  assert.equal(app.transitionCurrentFocus('finish', { now: '2026-08-03T01:25:00.000Z' }).state, 'completed');
  const state = store.load();
  assert.equal(state.collections.focus_sessions[0].actualMinutes, 25);
  assert.equal(state.collections.tasks[0].focusMinutes, 25);
  assert.equal(state.collections.tasks[0].focusCount, 1);
});

test('Wanjia merchant search and Huahuo availability query consume current source records', () => {
  const store = fakeStore({
    tasks: [{ id: 'task-m1', title: '更新团购', businessEntityId: 'm1', status: 'todo' }],
    life: [{ id: 'life-1', title: '看医生', startAt: '2026-08-05T10:00:00+08:00', endAt: '2026-08-05T11:00:00+08:00', privacy: 'private' }],
  });
  const app = createApp(store, {
    wanjia: {
      dataStatus: {
        state: 'realtime_validated', dataDate: '2026-08-03', validation: 'passed',
        lastSyncedAt: '2026-08-03T08:55:00+08:00', sourceTables: ['01.04.04｜林客每日汇总'],
      },
      records: [{
        id: 'm1', merchantId: 'M001', merchantName: '海景餐厅', paymentGmv: 8800,
        dataDate: '2026-08-03', updatedAt: '2026-08-03T08:55:00+08:00', actions: [],
      }],
    },
    huahuo: { records: [{
      id: 'p1', projectName: '婚礼跟拍', shootingDate: '2026-08-05',
      startAt: '2026-08-05T09:00:00+08:00', endAt: '2026-08-05T12:00:00+08:00',
      location: '阳西', members: ['阿杰'], roles: ['摄影师'],
    }] },
  });

  const merchant = app.queryMerchant('海景餐厅');
  assert.equal(merchant.state, 'matched');
  assert.equal(app.viewModel().merchantProfile.metrics.paymentGmv, 8800);
  assert.equal(app.viewModel().merchantProfile.actions.pending[0].title, '更新团购');

  const availability = app.queryHuahuoAvailability({ date: '2026-08-05' });
  assert.equal(availability.assignments[0].projectName, '婚礼跟拍');
  assert.equal(availability.occupancy[0].person, '阿杰');
  assert.equal(availability.privateBusyBlocks[0].title, '个人安排');
});

test('focus timer refreshes locally every second without persisting heartbeat writes', async () => {
  const store = fakeStore({
    focus_sessions: [{
      id: 'focus-running', state: 'running', durationMinutes: 25,
      startedAt: '2026-08-03T00:55:00.000Z', pausedSeconds: 0,
    }],
  });
  const intervals = [];
  const cleared = [];
  const document = {
    visibilityState: undefined,
    getElementById: () => null,
    addEventListener() {},
    defaultView: {
      setInterval(callback, delay) { intervals.push({ callback, delay }); return 17; },
      clearInterval(id) { cleared.push(id); },
    },
  };
  const app = createCeoOsApplication({
    store, document,
    storage: { getItem: () => 'device-v17', setItem() {} },
    now: () => '2026-08-03T09:00:00.000+08:00',
    createOperatingRuntime: false,
  });
  await app.start();
  assert.equal(intervals.length, 1);
  assert.equal(intervals[0].delay, 1000);
  const before = store.load().collections.focus_sessions;
  intervals[0].callback();
  assert.deepEqual(store.load().collections.focus_sessions, before);
  app.stop();
  assert.deepEqual(cleared, [17]);
});
