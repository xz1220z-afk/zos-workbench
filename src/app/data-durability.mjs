import { sanitizeSensitiveFields } from './sensitive-fields.mjs?v=2.0.2';

export const STATE_ENTITY_TYPES = Object.freeze([
  'tasks', 'inbox', 'projects', 'commands', 'decisions', 'targets',
  'intelligence', 'calendar', 'life', 'focus_sessions', 'countdowns',
  'content_items', 'knowledge_cards', 'reading_items', 'agent_runs',
  'social_insights', 'content_assets', 'brainstorms', 'content_experiments',
  'compound_candidates',
]);

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function emptyCollections() {
  return Object.fromEntries(STATE_ENTITY_TYPES.map((type) => [type, []]));
}

function normalizedCollections(input = {}) {
  const collections = emptyCollections();
  for (const type of STATE_ENTITY_TYPES) {
    if (input[type] != null && !Array.isArray(input[type])) throw new Error(`invalid_collection:${type}`);
    collections[type] = sanitizeSensitiveFields(clone(Array.isArray(input[type]) ? input[type] : []));
  }
  return collections;
}

function normalizedState(input = {}, options = {}) {
  return sanitizeSensitiveFields({
    schemaVersion: input.schemaVersion || '1.7',
    deviceId: input.deviceId || options.deviceId || 'backup-device',
    collections: normalizedCollections(input.collections),
    tombstones: Array.isArray(input.tombstones) ? clone(input.tombstones) : [],
    auditLog: Array.isArray(input.auditLog) ? clone(input.auditLog) : [],
  });
}

function backupPayload(input) {
  return {
    product: input.product,
    backupVersion: input.backupVersion,
    createdAt: input.createdAt,
    state: input.state,
    baseRevisions: input.baseRevisions,
    summary: input.summary,
  };
}

function integrityFor(input) {
  return { algorithm: 'fnv1a32', digest: fnv1a32(stableStringify(backupPayload(input))) };
}

export function summarizeBackup(input = {}) {
  const state = input.state || input;
  const collections = state?.collections || {};
  const counts = Object.fromEntries(STATE_ENTITY_TYPES.map((type) => [type, Array.isArray(collections[type]) ? collections[type].length : 0]));
  return {
    totalRecords: Object.values(counts).reduce((total, count) => total + count, 0),
    tombstones: Array.isArray(state?.tombstones) ? state.tombstones.length : 0,
    collections: counts,
  };
}

export function createDurableBackup({ state = {}, baseRevisions = {}, createdAt = new Date().toISOString(), appVersion = '2.0.2' } = {}) {
  const safeState = normalizedState(state);
  const safeRevisions = sanitizeSensitiveFields(clone(baseRevisions && typeof baseRevisions === 'object' ? baseRevisions : {}));
  const backup = {
    product: 'ZOS CEO Operating System',
    backupVersion: appVersion,
    createdAt,
    state: safeState,
    baseRevisions: safeRevisions,
    summary: summarizeBackup(safeState),
  };
  return { ...backup, integrity: integrityFor(backup) };
}

function parseLegacyBackup(value, options) {
  const collections = emptyCollections();
  for (const type of ['tasks', 'inbox', 'projects', 'commands']) {
    if (!Array.isArray(value[type])) throw new Error(`invalid_legacy_collection:${type}`);
    collections[type] = value[type];
  }
  return {
    sourceVersion: value.version || '1.0.4',
    createdAt: value.exportedAt || options.now || new Date().toISOString(),
    state: normalizedState({ collections }, options),
    baseRevisions: {},
  };
}

export function parseBackupFile(text, options = {}) {
  if (typeof text !== 'string') throw new Error('invalid_json');
  if (text.length > (options.maxBytes || MAX_BACKUP_BYTES)) throw new Error('backup_too_large');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('invalid_json');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('unsupported_backup');
  if (['tasks', 'inbox', 'projects', 'commands'].every((type) => Array.isArray(value[type]))) {
    return parseLegacyBackup(value, options);
  }
  if (!value.state?.collections || !value.integrity?.digest || value.integrity.algorithm !== 'fnv1a32') {
    throw new Error('unsupported_backup');
  }
  const safe = {
    product: value.product,
    backupVersion: value.backupVersion,
    createdAt: value.createdAt,
    state: normalizedState(value.state, options),
    baseRevisions: sanitizeSensitiveFields(clone(value.baseRevisions || {})),
  };
  safe.summary = summarizeBackup(safe.state);
  if (integrityFor(safe).digest !== value.integrity.digest) throw new Error('integrity_mismatch');
  return {
    sourceVersion: value.backupVersion,
    createdAt: value.createdAt,
    state: safe.state,
    baseRevisions: safe.baseRevisions,
    integrity: clone(value.integrity),
    summary: safe.summary,
  };
}

export function buildSafeMergeSnapshot(currentState = {}, incomingState = {}, options = {}) {
  const timestamp = options.now || new Date().toISOString();
  const deviceId = options.deviceId || currentState.deviceId || 'restore-device';
  const current = normalizedState(currentState, { deviceId });
  const incoming = normalizedState(incomingState, { deviceId });
  const collections = emptyCollections();
  const restoredKeys = new Set();

  for (const type of STATE_ENTITY_TYPES) {
    const records = new Map(current.collections[type].map((record) => [record.id, record]));
    for (const raw of incoming.collections[type]) {
      if (!raw?.id) continue;
      const existing = records.get(raw.id);
      const revision = Math.max(Number(existing?.revision) || 0, Number(raw.revision) || 0) + 1;
      records.set(raw.id, sanitizeSensitiveFields({
        ...existing,
        ...raw,
        id: raw.id,
        createdAt: existing?.createdAt || raw.createdAt || timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        revision,
        deviceId,
      }));
      restoredKeys.add(`${type}:${raw.id}`);
    }
    collections[type] = [...records.values()];
  }

  return {
    ...current,
    deviceId,
    collections,
    tombstones: current.tombstones.filter((record) => !restoredKeys.has(`${record.entity}:${record.id}`)),
    auditLog: current.auditLog,
  };
}
