import test from 'node:test';
import assert from 'node:assert/strict';

import { createCeoOsApplication } from '../src/app.mjs';

function memoryStore() {
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
    saveEntity(type, input) {
      const row = { ...structuredClone(input), id: input.id || `${type}-1` };
      state.collections[type] = [...state.collections[type].filter((item) => item.id !== row.id), row];
      return structuredClone(row);
    },
  };
}

function createApp() {
  return createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'd1', setItem() {} },
    store: memoryStore(), createOperatingRuntime: false,
    now: () => '2026-08-04T08:00:00.000Z',
  });
}

test('dragging backwards opens one task draft for the complete inclusive month range', () => {
  const app = createApp();
  app.setCalendarView('month');

  app.beginCalendarSelection('2026-08-12');
  app.extendCalendarSelection('2026-08-10');
  const draft = app.commitCalendarSelection();

  assert.deepEqual(app.runtime.calendarSelection, { startDate: '2026-08-10', endDate: '2026-08-12' });
  assert.equal(app.runtime.calendarPanel, 'editor');
  assert.equal(app.runtime.calendarDraftKind, 'task');
  assert.equal(draft.startAt, '2026-08-10T00:00');
  assert.equal(draft.dueAt, '2026-08-12T23:59');
});

test('switching a selected range to schedule preserves both boundary dates', () => {
  const app = createApp();
  app.setCalendarView('month');
  app.beginCalendarSelection('2026-08-10');
  app.extendCalendarSelection('2026-08-12');
  app.commitCalendarSelection();

  const draft = app.setCalendarDraftKind('calendar');

  assert.equal(draft.startAt, '2026-08-10T00:00');
  assert.equal(draft.endAt, '2026-08-12T23:59');
  assert.equal(draft.allDay, true);
});

test('unified task submission saves the task without creating a calendar record', () => {
  const app = createApp();
  const saved = app.saveCalendarArrangement({
    scheduleKind: 'task', title: '连续跟进客户', startAt: '2026-08-10T00:00',
    dueAt: '2026-08-12T23:59', allDay: true, priority: 3,
    company: 'wanjia', occupyCalendar: true,
  });

  assert.equal(saved.title, '连续跟进客户');
  assert.equal(app.store.load().collections.tasks.length, 1);
  assert.equal(app.store.load().collections.calendar.length, 0);
});
