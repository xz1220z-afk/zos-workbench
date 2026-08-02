import { applyRemoteSnapshot, resolveConflict, toCloudRow } from '../sync-engine.mjs';

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
  let conflicts = [];
  let started = false;
  let queuedTimer = null;
  let activeSync = null;

  async function sync(reason = 'manual') {
    if (activeSync) return activeSync;
    activeSync = (async () => {
      onStatus({ phase: 'started', reason });
      try {
        const remoteRows = await transport.pull(userId);
        const result = applyRemoteSnapshot({
          local: readState() || {},
          remoteRows,
          userId,
          baseRevisions: loadBaseRevisions() || {},
        });
        conflicts = result.conflicts;
        writeState({ ...result.collections, tombstones: result.tombstones });
        if (result.uploads.length && result.conflicts.length === 0) await transport.upsert(result.uploads);
        saveBaseRevisions(result.baseRevisions);
        if (conflicts.length) onConflict(conflicts.slice());
        onStatus({ phase: 'complete', reason, conflicts: conflicts.length, uploads: result.uploads.length });
        return result;
      } catch (error) {
        onStatus({ phase: 'failed', reason, safeCode: 'sync_failed' });
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
  const localChangeHandler = () => schedule('local-change', debounceMs);

  return {
    start() {
      if (started) return;
      started = true;
      eventTarget?.addEventListener?.('online', onlineHandler);
      eventTarget?.addEventListener?.('zos:local-change', localChangeHandler);
      visibility?.addEventListener?.('visibilitychange', visibilityHandler);
    },
    stop() {
      if (!started) return;
      started = false;
      eventTarget?.removeEventListener?.('online', onlineHandler);
      eventTarget?.removeEventListener?.('zos:local-change', localChangeHandler);
      visibility?.removeEventListener?.('visibilitychange', visibilityHandler);
      if (queuedTimer) clock.clearTimeout(queuedTimer);
      queuedTimer = null;
    },
    sync,
    setConflicts(items) {
      conflicts = Array.isArray(items) ? items.slice() : [];
    },
    getConflicts() {
      return conflicts.slice();
    },
    async resolve(conflictId, choice) {
      const conflict = conflicts.find((item) => item.id === conflictId);
      if (!conflict) throw new Error('conflict not found');
      const record = resolveConflict(conflict, choice, { now: now(), deviceId });
      const nextState = replaceRecord(readState() || {}, conflict.entityType, record);
      writeState(nextState);
      await transport.upsert([toCloudRow({ userId, entityType: conflict.entityType, record })]);
      const baseRevisions = { ...(loadBaseRevisions() || {}), [conflict.id]: record.revision };
      saveBaseRevisions(baseRevisions);
      conflicts = conflicts.filter((item) => item.id !== conflictId);
      onStatus({ phase: 'conflict-resolved', reason: choice, conflictId });
      return record;
    },
  };
}
