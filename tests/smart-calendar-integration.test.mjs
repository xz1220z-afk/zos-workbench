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
