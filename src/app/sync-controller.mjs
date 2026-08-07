import { applyRemoteSnapshot, resolveConflict, toCloudRow } from '../sync-engine.mjs?v=2.0.4';

function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function replaceRecord(collections, entityType, record) {
  const existing = Array.isArray(collections[entityType]) ? collections[entityType] : [];
  return {
    ...collections,
    [entityType]: [...existing.filter((item) => item.id !== record.id), record],
  };
}

export function createSyncController(config = {}) {
  const userId = required(config.userId, 'userId');
  const deviceId = required(config.deviceId, 'deviceId');
  const transport = required(config.transport, 'transport');
  const readState = required(config.readState, 'readState');
  const readSyncState = config.readSyncState || readState;
  const writeState = required(config.writeState, 'writeState');
  const loadBaseRevisions = config.loadBaseRevisions || (() => ({}));
  const saveBaseRevisions = config.saveBaseRevisions || (() => {});
  const eventTarget = config.eventTarget || globalThis;
  const visibility = config.visibility || globalThis.document;
  const clock = config.clock || globalThis;
  const debounceMs = Number.isFinite(config.debounceMs) ? config.debounceMs : 400;
  const now = config.now || (() => new Date().toISOString());
  const onStatus = config.onStatus || (() => {});
  const onConflict = config.onConflict || (() => {});
  const retryDelays = Array.isArray(config.retryDelays) && config.retryDelays.length
    ? config.retryDelays : [2_000, 10_000, 30_000, 120_000];
  const isOnline = config.isOnline || (() => globalThis.navigator?.onLine !== false);
  let conflicts = [];
  let started = false;
  let queuedTimer = null;
  let activeSync = null;
  let retryTimer = null;
  let stopped = false;
  let status = {
    phase: 'idle', reason: 'startup', attempts: 0, pendingUploads: 0,
    lastAttemptAt: null, lastSuccessAt: null, nextRetryAt: null, safeCode: null,
  };

  function updateStatus(next) {
    status = { ...status, ...next };
    onStatus({ ...status });
  }

  function clearRetry() {
    if (retryTimer) clock.clearTimeout(retryTimer);
    retryTimer = null;
  }

  function queueRetry(reason) {
    clearRetry();
    if (stopped) {
      updateStatus({ phase: 'failed', reason, nextRetryAt: null, safeCode: 'sync_failed' });
      return;
    }
    const delay = retryDelays[Math.min(Math.max(status.attempts - 1, 0), retryDelays.length - 1)];
    const nextRetryAt = new Date(new Date(now()).getTime() + delay).toISOString();
    updateStatus({ phase: 'retry-wait', reason, nextRetryAt, safeCode: 'sync_failed' });
    retryTimer = clock.setTimeout(async () => {
      retryTimer = null;
      if (stopped) return;
      try { await sync('automatic-retry'); } catch { /* next retry is already queued */ }
    }, delay);
  }

  async function sync(reason = 'manual') {
    if (activeSync) return activeSync;
    if (!isOnline()) {
      updateStatus({ phase: 'offline', reason, pendingUploads: Math.max(1, status.pendingUploads), nextRetryAt: null });
      return { offline: true, conflicts: [], uploads: [] };
    }
    activeSync = (async () => {
      clearRetry();
      updateStatus({ phase: 'started', reason, lastAttemptAt: now(), nextRetryAt: null, safeCode: null });
      try {
        const remoteRows = await transport.pull(userId);
        const result = applyRemoteSnapshot({
          local: readSyncState() || {},
          remoteRows,
          userId,
          baseRevisions: loadBaseRevisions() || {},
        });
        conflicts = result.conflicts;
        writeState({ ...result.collections, tombstones: result.tombstones });
        if (result.uploads.length) await transport.upsert(result.uploads);
        saveBaseRevisions(result.baseRevisions);
        if (conflicts.length) onConflict(conflicts.slice());
        updateStatus({
          phase: conflicts.length ? 'needs-attention' : 'complete', reason,
          conflicts: conflicts.length, uploads: result.uploads.length,
          attempts: 0, pendingUploads: conflicts.length, lastSuccessAt: now(), nextRetryAt: null, safeCode: null,
        });
        return result;
      } catch (error) {
        status.attempts += 1;
        queueRetry(reason);
        throw error;
      } finally {
        activeSync = null;
      }
    })();
    return activeSync;
  }

  function schedule(reason, delay = 0) {
    if (queuedTimer) clock.clearTimeout(queuedTimer);
    queuedTimer = clock.setTimeout(async () => {
      queuedTimer = null;
      try { await sync(reason); } catch { /* surfaced through onStatus */ }
    }, delay);
  }

  const onlineHandler = () => schedule('online', 0);
  const visibilityHandler = () => {
    if (visibility?.visibilityState === 'visible') schedule('visibility', 0);
  };
  const localChangeHandler = () => {
    updateStatus({
      phase: isOnline() ? 'pending' : 'offline', reason: 'local-change',
      pendingUploads: status.pendingUploads + 1,
    });
    schedule('local-change', debounceMs);
  };

  return {
    start() {
      if (started) return;
      started = true;
      stopped = false;
      eventTarget?.addEventListener?.('online', onlineHandler);
      eventTarget?.addEventListener?.('zos:local-change', localChangeHandler);
      visibility?.addEventListener?.('visibilitychange', visibilityHandler);
    },
    stop() {
      stopped = true;
      started = false;
      eventTarget?.removeEventListener?.('online', onlineHandler);
      eventTarget?.removeEventListener?.('zos:local-change', localChangeHandler);
      visibility?.removeEventListener?.('visibilitychange', visibilityHandler);
      if (queuedTimer) clock.clearTimeout(queuedTimer);
      queuedTimer = null;
      clearRetry();
    },
    sync,
    setConflicts(items) {
      conflicts = Array.isArray(items) ? items.slice() : [];
    },
    getConflicts() {
      return conflicts.slice();
    },
    getStatus() {
      return { ...status };
    },
    async resolve(conflictId, choice, merged = null) {
      const conflict = conflicts.find((item) => item.id === conflictId);
      if (!conflict) throw new Error('conflict not found');
      const record = resolveConflict(conflict, choice, { now: now(), deviceId, merged });
      const nextState = replaceRecord(readState() || {}, conflict.entityType, record);
      writeState(nextState);
      await transport.upsert([toCloudRow({ userId, entityType: conflict.entityType, record })]);
      const baseRevisions = { ...(loadBaseRevisions() || {}), [conflict.id]: record.revision };
      saveBaseRevisions(baseRevisions);
      conflicts = conflicts.filter((item) => item.id !== conflictId);
      updateStatus({ phase: 'conflict-resolved', reason: choice, conflictId, conflicts: conflicts.length, pendingUploads: 0 });
      return record;
    },
  };
}
