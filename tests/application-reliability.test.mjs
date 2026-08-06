import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createCeoOsApplication } from '../src/app.mjs';
import { createStateStore } from '../src/app/state-store.mjs';

function memoryStorage() {
  const values = new Map([['zos_device_id', 'mac-1']]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('application reliability actions snooze, restore, test reminders and export a credential-free backup', async () => {
  let tick = 0;
  const storage = memoryStorage();
  const store = createStateStore({
    storage, deviceId: 'mac-1', createId: () => `id-${tick++}`,
    now: () => '2026-08-06T08:00:00.000Z',
  });
  const task = store.saveEntity('tasks', { id: 'task-1', title: '核对回款', password: 'never' });
  store.deleteEntity('tasks', task.id);
  const downloads = [];
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage, store,
    now: () => '2026-08-06T08:00:00.000Z',
    downloadBackup: (value) => downloads.push(value),
    operatingRuntime: {
      syncController: { getStatus: () => ({ phase: 'complete' }), getConflicts: () => [] },
      pushClient: { test: async () => ({ state: 'sent' }) },
      session: { userId: 'user-1' },
    },
  });

  app.restoreReliabilityItem('tasks', 'task-1');
  const reminder = app.viewModel().reminderQueue.find((item) => item.sourceType === 'task');
  assert.equal(reminder?.actionId, 'task-1');
  assert.equal(reminder?.snoozable, true);
  const snoozed = app.snoozeReminder('tasks', 'task-1', '10m');
  assert.equal(snoozed.reminderAt, '2026-08-06T08:10:00.000Z');
  assert.equal((await app.testReminderDelivery()).state, 'sent');
  const backup = app.exportSafeBackup();
  assert.equal(downloads.length, 1);
  assert.doesNotMatch(JSON.stringify(backup), /password|never/);
  assert.ok(app.viewModel().auditLog.some((item) => item.action === 'snooze'));
});

test('failed durable reminder scheduling is queued for a forced retry and cleared on stop', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /queueReminderScheduleRetry\(\)/);
  assert.match(source, /scheduleDurableReminders\(\{ force: true \}\)/);
  assert.match(source, /clearTimeout\?\.\(reminderScheduleRetryTimer\)/);
});
