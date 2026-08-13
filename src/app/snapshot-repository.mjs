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

function transactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('indexeddb_transaction_aborted'));
    transaction.onerror = () => reject(transaction.error || new Error('indexeddb_transaction_failed'));
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
  async function transaction(mode) {
    const db = await database();
    const tx = db.transaction(STORE_NAME, mode);
    return { tx, objectStore: tx.objectStore(STORE_NAME) };
  }
  return {
    async put(value) {
      const { tx, objectStore } = await transaction('readwrite');
      const committed = transactionPromise(tx);
      await Promise.all([requestPromise(objectStore.put(clone(value))), committed]);
      return clone(value);
    },
    async list() {
      const { tx, objectStore } = await transaction('readonly');
      const committed = transactionPromise(tx);
      const [rows] = await Promise.all([requestPromise(objectStore.getAll()), committed]);
      return rows.map(clone);
    },
    async get(id) {
      const { tx, objectStore } = await transaction('readonly');
      const committed = transactionPromise(tx);
      const [value] = await Promise.all([requestPromise(objectStore.get(id)), committed]);
      return clone(value || null);
    },
    async delete(id) {
      const { tx, objectStore } = await transaction('readwrite');
      const committed = transactionPromise(tx);
      await Promise.all([requestPromise(objectStore.delete(id)), committed]);
    },
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
      if (!adapter?.put || !adapter?.list || !adapter?.get || !adapter?.delete) throw new Error('snapshot_storage_unavailable');
      const value = {
        id: input.id || createId(),
        kind: input.kind || 'manual',
        appVersion: input.appVersion || '2.8.1',
        createdAt: input.createdAt || now(),
        backup: clone(input.backup),
      };
      if (!value.backup) throw new Error('snapshot_backup_required');
      try {
        await adapter.put(value);
        const verified = await adapter.get(value.id);
        if (!verified || verified.id !== value.id || !verified.backup) throw new Error('snapshot_readback_failed');
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
