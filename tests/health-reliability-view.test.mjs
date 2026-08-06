import test from 'node:test';
import assert from 'node:assert/strict';

import { render } from '../src/app/views/health-view.mjs';

test('health view renders sync, conflicts, reminder check, recycle, audit and backup actions', () => {
  const container = { innerHTML: '' };
  render(container, {
    health: [{ source: 'wanjia', label: '万嘉网络', state: 'ok', recordCount: 10, lastSuccessAt: '2026-08-06T08:00:00Z' }],
    autoRefresh: { phase: 'idle' },
    reliability: {
      label: '正在重试', online: true, deviceId: 'mac-1', pendingUploads: 2,
      attempts: 1, nextRetryAt: '2026-08-06T08:05:00Z', lastSuccessAt: '2026-08-06T07:00:00Z',
      conflicts: 1, restorable: 1, auditEntries: 1,
    },
    syncConflicts: [{
      id: 'targets:t1', entityType: 'targets',
      local: { title: '本机目标', value: 100, revision: 2 },
      remote: { title: '云端目标', value: 120, revision: 3 },
    }],
    reminderQueue: [{ actionId: 'task-1', title: '核对回款', sourceType: 'tasks' }],
    notificationState: 'enabled', reminderScheduleState: 'synced', reminderTestState: 'idle',
    restorableItems: [{ id: 'task-2', entity: 'tasks', title: '误删任务', daysRemaining: 29 }],
    auditLog: [{ id: 'a1', action: 'delete', label: '误删任务', at: '2026-08-06T08:00:00Z' }],
  });
  assert.match(container.innerHTML, /同步中心/);
  assert.match(container.innerHTML, /data-sync-now/);
  assert.match(container.innerHTML, /data-sync-resolution="local"/);
  assert.match(container.innerHTML, /data-sync-merge-form/);
  assert.match(container.innerHTML, /data-reminder-test/);
  assert.match(container.innerHTML, /data-reminder-snooze="10m"/);
  assert.match(container.innerHTML, /data-reliability-restore="task-2"/);
  assert.match(container.innerHTML, /data-export-backup/);
  assert.match(container.innerHTML, /最近操作/);
  assert.match(container.innerHTML, /提醒已开启/);
  assert.match(container.innerHTML, /排程已同步/);
  assert.doesNotMatch(container.innerHTML, /pending_configuration|disabled|enabled|synced/);
});

test('health view translates reminder setup states into plain Chinese', () => {
  const container = { innerHTML: '' };
  render(container, {
    notificationState: 'pending_configuration', reminderScheduleState: 'disabled',
    reliability: { label: '等待首次同步' },
  });
  assert.match(container.innerHTML, /等待云端配置/);
  assert.match(container.innerHTML, /排程未开启/);
  assert.doesNotMatch(container.innerHTML, /pending_configuration|disabled/);
});
