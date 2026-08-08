import { createDurableBackup } from './data-durability.mjs?v=2.4.0';

export function listRestorableItems(tombstones = [], options = {}) {
  const nowMs = new Date(options.now || new Date().toISOString()).getTime();
  const retentionDays = Number.isFinite(options.retentionDays) ? options.retentionDays : 30;
  const retentionMs = retentionDays * 86_400_000;
  return (Array.isArray(tombstones) ? tombstones : [])
    .map((item) => {
      const deletedMs = new Date(item.deletedAt || '').getTime();
      const elapsed = nowMs - deletedMs;
      return {
        ...item,
        daysRemaining: Math.max(0, Math.ceil((retentionMs - elapsed) / 86_400_000)),
        _deletedMs: deletedMs,
      };
    })
    .filter((item) => Number.isFinite(item._deletedMs) && nowMs >= item._deletedMs && nowMs - item._deletedMs <= retentionMs)
    .sort((left, right) => right._deletedMs - left._deletedMs)
    .map(({ _deletedMs, ...item }) => item);
}

export function buildSafeBackup({ state = {}, baseRevisions = {}, createdAt = new Date().toISOString() } = {}) {
  return createDurableBackup({ state, baseRevisions, createdAt, appVersion: '2.4.0' });
}

export function reminderSnoozeAt(choice, options = {}) {
  const now = new Date(options.now || new Date().toISOString());
  if (choice === '10m') return new Date(now.getTime() + 10 * 60_000).toISOString();
  if (choice === '1h') return new Date(now.getTime() + 60 * 60_000).toISOString();
  if (choice === 'tomorrow') {
    const offset = Number.isFinite(options.timeZoneOffsetMinutes) ? options.timeZoneOffsetMinutes : -now.getTimezoneOffset();
    const local = new Date(now.getTime() + offset * 60_000);
    const nextLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, 9, 0, 0);
    return new Date(nextLocal - offset * 60_000).toISOString();
  }
  throw new Error('unsupported snooze choice');
}

export function buildReliabilityOverview(input = {}) {
  const status = input.syncStatus || {};
  const online = input.online !== false;
  const labels = {
    complete: '已同步', started: '正在同步', 'retry-wait': '正在重试',
    failed: '同步失败', offline: '等待网络', idle: '等待首次同步',
    'needs-attention': '部分已同步，等待处理冲突',
  };
  return {
    label: online ? (labels[status.phase] || '等待首次同步') : '等待网络',
    online,
    deviceId: input.deviceId || '当前设备',
    phase: status.phase || 'idle',
    attempts: Number(status.attempts) || 0,
    pendingUploads: Number(status.pendingUploads) || 0,
    nextRetryAt: status.nextRetryAt || null,
    lastSuccessAt: status.lastSuccessAt || null,
    conflicts: Array.isArray(input.conflicts) ? input.conflicts.length : 0,
    restorable: listRestorableItems(input.tombstones, { now: input.now }).length,
    auditEntries: Array.isArray(input.auditLog) ? input.auditLog.length : 0,
    snapshotCount: Number(input.snapshotCount) || 0,
    protectionState: input.protectionState || '本机数据已保护',
  };
}
