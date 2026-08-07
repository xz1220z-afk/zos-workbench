const DB_NAME = 'zos-ceo-os-safety';
const STORE_NAME = 'snapshots';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function createMemorySnapshotAdapter() {
  const rows = new Map();
  return {
    async put(value) { rows.set(value.id, clone(value)); return clone(value); },
    async list() { return [...rows.values()].map(clone); },
    async get(id) { return clone(rows.get(id) || null); },
    async delete(id) { rows.delete(id); },
  };
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_request_failed'));
  });
}

export function createIndexedDbSnapshotAdapter(indexedDB, options = {}) {
  if (!indexedDB?.open) return null;
  let databasePromise;
  function database() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(options.databaseName || DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
    });
    return databasePromise;
  }
  async function store(mode) {
    const db = await database();
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }
  return {
    async put(value) { return requestPromise((await store('readwrite')).put(clone(value))).then(() => clone(value)); },
    async list() { return requestPromise((await store('readonly')).getAll()).then((rows) => rows.map(clone)); },
    async get(id) { return requestPromise((await store('readonly')).get(id)).then((value) => clone(value || null)); },
    async delete(id) { await requestPromise((await store('readwrite')).delete(id)); },
  };
}

export function createSnapshotRepository(config = {}) {
  const adapter = config.adapter;
  const now = config.now || (() => new Date().toISOString());
  const createId = config.createId || (() => globalThis.crypto.randomUUID());
  const limits = { upgrade: 3, 'pre-import': 1, ...(config.limits || {}) };

  async function rows() {
    if (!adapter?.list) return [];
    const values = await adapter.list();
    return (Array.isArray(values) ? values : []).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  }

  async function prune(kind) {
    const limit = Number.isInteger(limits[kind]) ? limits[kind] : 3;
    const extras = (await rows()).filter((item) => item.kind === kind).slice(limit);
    await Promise.all(extras.map((item) => adapter.delete(item.id)));
  }

  return {
    async save(input = {}) {
      if (!adapter?.put || !adapter?.list || !adapter?.delete) throw new Error('snapshot_storage_unavailable');
      const value = {
        id: input.id || createId(),
        kind: input.kind || 'manual',
        appVersion: input.appVersion || '2.0.2',
        createdAt: input.createdAt || now(),
        backup: clone(input.backup),
      };
      if (!value.backup) throw new Error('snapshot_backup_required');
      try {
        await adapter.put(value);
        await prune(value.kind);
      } catch (error) {
        const failure = new Error('snapshot_storage_failed');
        failure.cause = error;
        throw failure;
      }
      return clone(value);
    },
    async list() { return rows(); },
    async load(id) { return adapter?.get ? adapter.get(id) : null; },
    async latest(kind) { return (await rows()).find((item) => item.kind === kind) || null; },
  };
}
