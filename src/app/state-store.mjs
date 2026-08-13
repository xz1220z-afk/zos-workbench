import { createRecord, markDeleted, normalizeRecord, touchRecord } from '../data-model.mjs?v=2.8.3';
import { sanitizeSensitiveFields } from './sensitive-fields.mjs?v=2.8.3';
import { buildDurableStateView, buildSafeMergeSnapshot, STATE_ENTITY_TYPES } from './data-durability.mjs?v=2.8.3';

const STATE_KEY = 'zos_ceo_os_state_v1_7';
const PREVIOUS_STATE_KEYS = ['zos_ceo_os_state_v1_4', 'zos_ceo_os_state_v1_3'];
const BASE_REVISIONS_KEY = 'zos_ceo_os_base_revisions_v1_7';
const PREVIOUS_BASE_REVISIONS_KEYS = ['zos_ceo_os_base_revisions_v1_4', 'zos_ceo_os_base_revisions_v1_3'];
const LEGACY_KEYS = {
  tasks: 'zos_tasks', inbox: 'zos_inbox', projects: 'zos_projects', commands: 'zos_commands',
};
const ENTITY_TYPES = STATE_ENTITY_TYPES;

export { STATE_ENTITY_TYPES };

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function parse(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value == null ? clone(fallback) : JSON.parse(value);
  } catch {
    return clone(fallback);
  }
}

function emptyCollections() {
  return Object.fromEntries(ENTITY_TYPES.map((name) => [name, []]));
}

function normalizedRecord(record, context) {
  return normalizeRecord(sanitizeSensitiveFields(record), {
    now: context.now(), deviceId: context.deviceId, createId: context.createId,
  });
}

function normalizeState(input, context) {
  const rawCollections = input?.collections || {};
  const collections = emptyCollections();
  for (const entityType of ENTITY_TYPES) {
    const records = Array.isArray(rawCollections[entityType]) ? rawCollections[entityType] : [];
    collections[entityType] = records
      .map((record) => normalizedRecord(record, context))
      .filter((record) => !record.deletedAt);
  }
  const tombstones = (Array.isArray(input?.tombstones) ? input.tombstones : [])
    .map((record) => normalizedRecord(record, context))
    .filter((record) => record.deletedAt);
  return {
    schemaVersion: '1.7',
    deviceId: input?.deviceId || context.deviceId,
    collections,
    tombstones,
    auditLog: (Array.isArray(input?.auditLog) ? input.auditLog : [])
      .map(sanitizeSensitiveFields)
      .slice(0, context.auditLimit),
  };
}

function migrateLegacy(storage, context) {
  const collections = emptyCollections();
  for (const [entityType, key] of Object.entries(LEGACY_KEYS)) {
    const rows = parse(storage, key, []);
    collections[entityType] = Array.isArray(rows) ? rows : [];
  }
  return normalizeState({
    deviceId: storage.getItem('zos_device_id') || context.deviceId,
    collections,
    tombstones: parse(storage, 'zos_tombstones', []),
  }, context);
}

function createContext(config = {}) {
  return {
    now: config.now || (() => new Date().toISOString()),
    deviceId: config.deviceId || 'unknown-device',
    createId: config.createId || (() => globalThis.crypto.randomUUID()),
    auditLimit: Number.isFinite(config.auditLimit) ? config.auditLimit : 200,
  };
}

export function readPersistedStateForBackup(config = {}) {
  const storage = config.rawSnapshot
    ? { getItem: (key) => config.rawSnapshot[key] ?? null }
    : config.storage;
  if (!storage?.getItem) throw new Error('storage is required');
  const context = createContext(config);
  const current = [STATE_KEY, ...PREVIOUS_STATE_KEYS]
    .map((key) => ({ key, value: parse(storage, key, null) }))
    .find((candidate) => candidate.value);
  const modular = current ? normalizeState(current.value, context) : migrateLegacy(storage, context);
  return buildDurableStateView(modular, migrateLegacy(storage, context), { deviceId: context.deviceId });
}

export function createStateStore(config = {}) {
  const storage = config.storage;
  if (!storage?.getItem || !storage?.setItem) throw new Error('storage is required');
  const context = createContext(config);
  const listeners = new Set();
  let stateStorageKey = STATE_KEY;
  let baseRevisionsStorageKey = BASE_REVISIONS_KEY;

  function persist(state) {
    const next = normalizeState(state, context);
    storage.setItem(stateStorageKey, JSON.stringify(next));
    return next;
  }

  let state = (() => {
    const candidates = [STATE_KEY, ...PREVIOUS_STATE_KEYS]
      .map((key) => ({ key, value: parse(storage, key, null) }));
    const current = candidates.find((candidate) => candidate.value);
    const next = current ? normalizeState(current.value, context) : migrateLegacy(storage, context);
    try {
      return persist(next);
    } catch (error) {
      if (error?.name !== 'QuotaExceededError') throw error;
      // A current-schema snapshot can already occupy the browser quota. Startup
      // must stay readable even when rewriting the same logical state is denied.
      if (!current || current.key === STATE_KEY) return next;
      stateStorageKey = current.key;
      baseRevisionsStorageKey = PREVIOUS_BASE_REVISIONS_KEYS[PREVIOUS_STATE_KEYS.indexOf(current.key)]
        || BASE_REVISIONS_KEY;
      try {
        return persist(next);
      } catch (fallbackError) {
        if (fallbackError?.name !== 'QuotaExceededError') throw fallbackError;
        return next;
      }
    }
  })();

  function publish() {
    const snapshot = clone(state);
    for (const listener of listeners) listener(snapshot);
  }

  function requireEntityType(entityType) {
    if (!ENTITY_TYPES.includes(entityType)) throw new Error('unsupported entity type');
  }

  function audit(action, entityType, record) {
    const entry = sanitizeSensitiveFields({
      id: context.createId(), action, entityType, recordId: record?.id || '',
      label: record?.title || record?.name || record?.subject || '',
      at: context.now(), deviceId: state.deviceId,
    });
    return [entry, ...(state.auditLog || [])].slice(0, context.auditLimit);
  }

  return {
    load() { return clone(state); },
    saveEntity(entityType, fields, options = {}) {
      requireEntityType(entityType);
      const safeFields = sanitizeSensitiveFields(fields || {});
      const existing = safeFields.id
        ? state.collections[entityType].find((record) => record.id === safeFields.id)
        : null;
      const record = existing
        ? touchRecord({ ...existing, ...safeFields }, { now: context.now(), deviceId: state.deviceId })
        : createRecord(safeFields, { now: context.now(), deviceId: state.deviceId, id: safeFields.id || context.createId() });
      state = persist({
        ...state,
        collections: {
          ...state.collections,
          [entityType]: [...state.collections[entityType].filter((item) => item.id !== record.id), record],
        },
        auditLog: audit(options.action || (existing ? 'update' : 'create'), entityType, record),
      });
      publish();
      return clone(record);
    },
    deleteEntity(entityType, id) {
      requireEntityType(entityType);
      const existing = state.collections[entityType].find((record) => record.id === id);
      if (!existing) throw new Error('record not found');
      const tombstone = { ...markDeleted(existing, { now: context.now(), deviceId: state.deviceId }), entity: entityType };
      state = persist({
        ...state,
        collections: {
          ...state.collections,
          [entityType]: state.collections[entityType].filter((record) => record.id !== id),
        },
        tombstones: [...state.tombstones.filter((record) => !(record.entity === entityType && record.id === id)), tombstone],
        auditLog: audit('delete', entityType, existing),
      });
      publish();
      return clone(tombstone);
    },
    restoreEntity(entityType, id) {
      requireEntityType(entityType);
      const tombstone = state.tombstones.find((record) => record.entity === entityType && record.id === id);
      if (!tombstone) throw new Error('tombstone_not_found');
      const restored = touchRecord(
        { ...tombstone, deletedAt: null, entity: undefined },
        { now: context.now(), deviceId: state.deviceId },
      );
      state = persist({
        ...state,
        collections: {
          ...state.collections,
          [entityType]: [
            ...state.collections[entityType].filter((record) => record.id !== id),
            restored,
          ],
        },
        tombstones: state.tombstones.filter((record) => !(record.entity === entityType && record.id === id)),
        auditLog: audit('restore', entityType, restored),
      });
      publish();
      return clone(state.collections[entityType].find((record) => record.id === id));
    },
    recordAudit(action, entityType, record = {}) {
      state = persist({ ...state, auditLog: audit(action, entityType, record) });
      publish();
      return clone(state.auditLog[0]);
    },
    replaceSnapshot(snapshot, options = {}) {
      state = persist({
        ...snapshot,
        deviceId: state.deviceId,
        auditLog: options.preserveAudit === false ? snapshot?.auditLog : state.auditLog,
      });
      publish();
      return clone(state);
    },
    mergeSnapshot(snapshot, options = {}) {
      const merged = buildSafeMergeSnapshot(options.baseState || state, snapshot, {
        now: context.now(), deviceId: state.deviceId,
      });
      const record = { id: 'backup', title: '安全合并恢复' };
      state = persist({
        ...merged,
        deviceId: state.deviceId,
        auditLog: audit('backup_merge_restore', 'backup', record),
      });
      publish();
      return clone(state);
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new Error('listener is required');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    loadBaseRevisions() {
      const current = [BASE_REVISIONS_KEY, ...PREVIOUS_BASE_REVISIONS_KEYS]
        .map((key) => ({ key, value: parse(storage, key, null) }))
        .find((candidate) => candidate.value);
      const value = current?.value || {};
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    },
    saveBaseRevisions(revisions) {
      const safe = Object.fromEntries(
        Object.entries(revisions || {}).filter(([, revision]) => Number.isInteger(revision) && revision > 0),
      );
      const serialized = JSON.stringify(safe);
      try {
        storage.setItem(baseRevisionsStorageKey, serialized);
      } catch (error) {
        if (error?.name !== 'QuotaExceededError' || baseRevisionsStorageKey !== BASE_REVISIONS_KEY) throw error;
        const fallbackKey = PREVIOUS_BASE_REVISIONS_KEYS.find((key) => storage.getItem(key) != null);
        if (!fallbackKey) throw error;
        baseRevisionsStorageKey = fallbackKey;
        storage.setItem(baseRevisionsStorageKey, serialized);
      }
    },
    needsFullPull(recordKeys = []) {
      const bases = this.loadBaseRevisions();
      return recordKeys.some((key) => !Number.isInteger(bases[key]));
    },
  };
}

export const STATE_STORAGE_KEYS = Object.freeze({ state: STATE_KEY, baseRevisions: BASE_REVISIONS_KEY });
