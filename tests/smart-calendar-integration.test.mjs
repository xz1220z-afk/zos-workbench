import test from 'node:test';
import assert from 'node:assert/strict';

import { createCeoOsApplication } from '../src/app.mjs';

function integrationStore() {
  const state = {
    schemaVersion: '1.7', deviceId: 'd1', tombstones: [],
    collections: {
      tasks: [], inbox: [], projects: [], commands: [], decisions: [], targets: [],
      intelligence: [], calendar: [], life: [], focus_sessions: [], countdowns: [],
    },
  };
  return {
    load: () => structuredClone(state),
    subscribe: () => () => {},
    saveEntity(type, fields) {
      const existing = state.collections[type].find((item) => item.id === fields.id);
      const row = {
        revision: (existing?.revision || 0) + 1,
        createdAt: existing?.createdAt || '2026-08-03T00:00:00.000Z',
        updatedAt: '2026-08-03T00:00:00.000Z', deletedAt: null, deviceId: 'd1',
        ...existing, ...structuredClone(fields),
        id: fields.id || `id-${state.collections[type].length + 1}`,
      };
      state.collections[type] = [...state.collections[type].filter((item) => item.id !== row.id), row];
      return structuredClone(row);
    },
    deleteEntity(type, id) {
      const row = state.collections[type].find((item) => item.id === id);
      if (!row) throw new Error('record_not_found');
      state.collections[type] = state.collections[type].filter((item) => item.id !== id);
      const tombstone = { ...row, revision: row.revision + 1, deletedAt: '2026-08-03T01:00:00.000Z', entity: type };
      state.tombstones.push(tombstone);
      return structuredClone(tombstone);
    },
    restoreEntity(type, id) {
      const tombstone = state.tombstones.find((item) => item.entity === type && item.id === id);
      if (!tombstone) throw new Error('tombstone_not_found');
      state.tombstones = state.tombstones.filter((item) => item !== tombstone);
      const restored = { ...tombstone, revision: tombstone.revision + 1, deletedAt: null };
      delete restored.entity;
      state.collections[type].push(restored);
      return structuredClone(restored);
    },
  };
}

test('smart calendar keeps local CRUD synchronized while external events remain read only', () => {
  const store = integrationStore();
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'd1', setItem() {} }, store,
    createOperatingRuntime: false,
    now: () => '2026-08-03T08:00:00.000Z',
  });
  app.runtime.externalCalendar = [{
    id: 'feishu:1', source: 'feishu', title: '飞书会议',
    startAt: '2026-08-04T02:00:00.000Z', endAt: '2026-08-04T03:00:00.000Z',
    sourceUrl: 'https://open.feishu.cn/',
  }];
  const local = app.saveCalendar({
    title: '本地安排', startAt: '2026-08-03T10:00', endAt: '2026-08-05T11:00',
    recurrenceRule: { frequency: 'weekly', interval: 1 },
  });
  assert.deepEqual(app.store.load().collections.calendar[0].recurrenceRule, { frequency: 'weekly', interval: 1 });
  const visibleDays = app.viewModel().calendarLayout.days
    .filter((day) => day.events.some((row) => row.seriesId === local.id || row.id === local.id));
  assert.equal(visibleDays.length >= 3, true, 'a multi-day local event must cover every visible day');
  app.deleteCalendar(local.id);
  assert.equal(app.store.load().tombstones.some((row) => row.id === local.id), true);
  app.restoreCalendar(local.id);
  assert.equal(app.store.load().collections.calendar.some((row) => row.id === local.id), true);
  assert.throws(() => app.deleteCalendar('feishu:1'), /calendar_local_event_required/);
});

test('calendar task deletion creates a synchronized tombstone and restore advances revision', () => {
  const store = integrationStore();
  const localChanges = [];
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'd1', setItem() {} }, store,
    eventTarget: { dispatchEvent(event) { localChanges.push(event.type); } },
    createOperatingRuntime: false,
    now: () => '2026-08-03T08:00:00.000Z',
  });
  const task = app.saveTask({
    title: '跨端删除验收任务', startAt: '2026-08-10T09:00:00.000Z',
    dueAt: '2026-08-10T10:30:00.000Z', occupyCalendar: true,
  });

  const deleted = app.deleteTask(task.id);
  assert.equal(deleted.entity, 'tasks');
  assert.equal(store.load().collections.tasks.length, 0);
  assert.equal(store.load().tombstones[0].id, task.id);
  assert.equal(localChanges.at(-1), 'zos:local-change');

  const restored = app.restoreTask(task.id);
  assert.equal(restored.revision, deleted.revision + 1);
  assert.equal(store.load().collections.tasks[0].id, task.id);
  assert.equal(store.load().tombstones.length, 0);
});

test('calendar task actions complete copy and reschedule without converting it into a calendar event', () => {
  const store = integrationStore();
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'd1', setItem() {} }, store,
    createOperatingRuntime: false,
    now: () => '2026-08-03T08:00:00.000Z',
  });
  const task = app.saveTask({
    title: '万嘉回款跟进', startAt: '2026-08-10T09:00:00.000Z',
    dueAt: '2026-08-10T10:30:00.000Z', company: 'wanjia', occupyCalendar: true,
  });

  const completed = app.toggleTask(task.id);
  assert.equal(completed.status, 'done');
  const moved = app.moveTask(task.id, { startAt: '2026-08-12T14:00:00.000Z' });
  assert.equal(moved.startAt, '2026-08-12T14:00:00.000Z');
  assert.equal(moved.dueAt, '2026-08-12T15:30:00.000Z');
  const copy = app.copyTask(task.id);
  assert.equal(copy.title, '万嘉回款跟进（副本）');
  assert.notEqual(copy.id, task.id);
  assert.equal(store.load().collections.calendar.length, 0);
});

test('calendar task deletion requires confirmation and can be undone from the shared recycle flow', () => {
  const store = integrationStore();
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'd1', setItem() {} }, store,
    createOperatingRuntime: false,
    now: () => '2026-08-10T08:00:00.000Z',
  });
  const task = app.saveTask({ title: '待安全删除', startAt: '2026-08-10T09:00:00.000Z' });
  app.requestCalendarDeletion(task.id);
  assert.deepEqual(app.runtime.calendarPendingDelete, { entity: 'tasks', id: task.id, title: '待安全删除' });
  assert.equal(store.load().collections.tasks.length, 1, 'confirmation must not delete the task yet');
  app.confirmCalendarDeletion();
  assert.equal(store.load().collections.tasks.length, 0);
  assert.equal(app.runtime.calendarUndoDelete.entity, 'tasks');
  app.undoCalendarDelete();
  assert.equal(store.load().collections.tasks[0].id, task.id);
  assert.equal(app.runtime.calendarUndoDelete, null);
});

test('calendar practical filters affect only the visible layout and retain the full detail source', () => {
  const store = integrationStore();
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'd1', setItem() {} }, store,
    createOperatingRuntime: false,
    now: () => '2026-08-10T08:00:00.000Z',
  });
  const task = app.saveTask({ title: '万嘉任务', company: 'wanjia', startAt: '2026-08-10T09:00:00.000Z' });
  const schedule = app.saveCalendar({ title: '花火日程', company: 'huahuo', startAt: '2026-08-10T11:00:00.000Z' });
  app.setCalendarFilter('task');
  assert.deepEqual(app.viewModel().calendarFiltered.map((row) => row.id), [task.id]);
  assert.equal(app.viewModel().calendar.some((row) => row.id === schedule.id), true);
  app.setCalendarFilter('huahuo');
  assert.deepEqual(app.viewModel().calendarFiltered.map((row) => row.id), [schedule.id]);
});
