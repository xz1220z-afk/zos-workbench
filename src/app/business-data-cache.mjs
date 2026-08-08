export const BUSINESS_DATA_CACHE_KEY = 'zos_business_data_cache_v1';

const LARGE_FIELD = /(?:raw|payload|content|body|text|markdown|html|attachment|image|media)/i;
const MAX_STRING_LENGTH = 180;

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function boundedValue(value, depth = 0) {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (depth >= 2) return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => boundedValue(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !LARGE_FIELD.test(key))
    .slice(0, 24)
    .flatMap(([key, item]) => {
      const next = boundedValue(item, depth + 1);
      return next === undefined ? [] : [[key, next]];
    }));
}

function compactEntry(entry) {
  if (!isRecord(entry)) return boundedValue(entry);
  const compact = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === 'records' && Array.isArray(value)) {
      compact.records = value.map((row) => boundedValue(row));
      continue;
    }
    if (key === 'payload' && isRecord(value)) {
      const payload = boundedValue(value) || {};
      if (Array.isArray(value.notes)) payload.notes = value.notes.map((row) => boundedValue(row));
      compact.payload = payload;
      continue;
    }
    const next = boundedValue(value);
    if (next !== undefined) compact[key] = next;
  }
  return compact;
}

function compactCache(cache) {
  return Object.fromEntries(Object.entries(cache || {}).flatMap(([key, value]) => {
    const next = compactEntry(value);
    return next === undefined ? [] : [[key, next]];
  }));
}

function byteLength(value) {
  return JSON.stringify(value).length;
}

function candidateList(cache, candidate) {
  return candidate.list === 'notes'
    ? cache[candidate.key].payload.notes
    : cache[candidate.key].records;
}

function trimLargestList(cache) {
  const candidates = [];
  for (const [key, entry] of Object.entries(cache)) {
    if (!isRecord(entry)) continue;
    if (Array.isArray(entry.records) && entry.records.length > 1) candidates.push({ key, list: 'records' });
    if (Array.isArray(entry.payload?.notes) && entry.payload.notes.length > 1) candidates.push({ key, list: 'notes' });
  }
  candidates.sort((left, right) => candidateList(cache, right).length - candidateList(cache, left).length);
  const target = candidates[0];
  if (!target) return false;
  const list = candidateList(cache, target);
  list.splice(Math.max(1, Math.floor(list.length / 4)));
  return true;
}

export function buildCompactBusinessCache(cache = {}, { maxPersistedBytes = 640 * 1024 } = {}) {
  const compact = compactCache(cache);
  while (byteLength(compact) > maxPersistedBytes && trimLargestList(compact)) {
    // The read-only persisted copy is deliberately bounded. Fresh data stays in memory.
  }
  return compact;
}

export function createBusinessDataCache({ storage = globalThis.localStorage, key = BUSINESS_DATA_CACHE_KEY, maxPersistedBytes } = {}) {
  let sessionCache = null;

  function persistedCache() {
    try {
      const raw = storage?.getItem?.(key);
      return raw ? JSON.parse(raw) || {} : {};
    } catch {
      return {};
    }
  }

  return {
    load() {
      return sessionCache || persistedCache();
    },
    save(cache) {
      sessionCache = cache || {};
      try {
        storage.setItem(key, JSON.stringify(sessionCache));
        return { persisted: true, compacted: false, sessionOnly: false, message: '' };
      } catch {
        const compact = buildCompactBusinessCache(sessionCache, { maxPersistedBytes });
        try {
          storage.setItem(key, JSON.stringify(compact));
          return { persisted: true, compacted: true, sessionOnly: false, message: '本机只读缓存空间不足，已保存精简副本；本次页面继续使用完整已读取数据。' };
        } catch {
          return { persisted: false, compacted: true, sessionOnly: true, message: '本机只读缓存空间不足，本次页面继续使用已读取数据；关闭页面后请重新刷新。' };
        }
      }
    },
  };
}
