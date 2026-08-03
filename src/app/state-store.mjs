import { createRecord, markDeleted, normalizeRecord, touchRecord } from '../data-model.mjs';

const STATE_KEY = 'zos_ceo_os_state_v1_7';
const PREVIOUS_STATE_KEYS = ['zos_ceo_os_state_v1_4', 'zos_ceo_os_state_v1_3'];
const BASE_REVISIONS_KEY = 'zos_ceo_os_base_revisions_v1_7';
const PREVIOUS_BASE_REVISIONS_KEYS = ['zos_ceo_os_base_revisions_v1_4', 'zos_ceo_os_base_revisions_v1_3'];
const LEGACY_KEYS = {
  tasks: 'zos_tasks', inbox: 'zos_inbox', projects: 'zos_projects', commands: 'zos_commands',
};
const ENTITY_TYPES = [
  'tasks', 'inbox', 'projects', 'commands', 'decisions', 'targets',
  'intelligence', 'calendar', 'life', 'focus_sessions', 'countdowns',
];
const FORBIDDEN_KEY = /(password|passcode|access[_-]?token|refresh[_-]?token|authorization|api[_-]?key|anon[_-]?key|secret)/i;

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

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !FORBIDDEN_KEY.test(key))
      .map(([key, item]) => [key, sanitize(item)]),
  );
}

function emptyCollections() {
  return Object.fromEntries(ENTITY_TYPES.map((name) => [name, []]));
}

function normalizedRecord(record, context) {
  return normalizeRecord(sanitize(record), {
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

export function createStateStore(config = {}) {
  const storage = config.storage;
  if (!storage?.getItem || !storage?.setItem) throw new Error('storage is required');
  const context = {
    now: config.now || (() => new Date().toISOString()),
    deviceId: config.deviceId || 'unknown-device',
    createId: config.createId || (() => globalThis.crypto.randomUUID()),
  };
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
      if (error?.name !== 'QuotaExceededError' || !current || current.key === STATE_KEY) throw error;
      stateStorageKey = current.key;
      baseRevisionsStorageKey = PREVIOUS_BASE_REVISIONS_KEYS[PREVIOUS_STATE_KEYS.indexOf(current.key)]
        || BASE_REVISIONS_KEY;
      return persist(next);
    }
  })();

  function publish() {
    const snapshot = clone(state);
    for (const listener of listeners) listener(snapshot);
  }

  function requireEntityType(entityType) {
    if (!ENTITY_TYPES.includes(entityType)) throw new Error('unsupported entity type');
  }

  return {
    load() { return clone(state); },
    saveEntity(entityType, fields) {
      requireEntityType(entityType);
      const safeFields = sanitize(fields || {});
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
      });
      publish();
      return clone(tombstone);
    },
    replaceSnapshot(snapshot) {
      state = persist({ ...snapshot, deviceId: state.deviceId });
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
