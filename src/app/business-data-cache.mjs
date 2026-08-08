export const BUSINESS_DATA_CACHE_KEY = 'zos_business_data_cache_v1';
export const DEFAULT_MAX_PERSISTED_BYTES = 160 * 1024;

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
      const maxBytes = Number.isFinite(maxPersistedBytes) && maxPersistedBytes > 0
        ? maxPersistedBytes : DEFAULT_MAX_PERSISTED_BYTES;
      const fullText = JSON.stringify(sessionCache);
      // The browser copy is an offline convenience, never the live source of truth.
      // Do not first try a full 300+ merchant response and create a quota warning.
      const bounded = fullText.length > maxBytes
        ? buildCompactBusinessCache(sessionCache, { maxPersistedBytes: maxBytes })
        : sessionCache;
      const compacted = bounded !== sessionCache;
      try {
        storage.setItem(key, JSON.stringify(bounded));
        return {
          persisted: true, compacted, sessionOnly: false,
          message: compacted ? '已读取最新数据；已保存精简离线副本，完整数据仅用于本次页面。' : '',
        };
      } catch {
        const compact = buildCompactBusinessCache(sessionCache, { maxPersistedBytes: Math.min(maxBytes, 48 * 1024) });
        try {
          storage.setItem(key, JSON.stringify(compact));
          return { persisted: true, compacted: true, sessionOnly: false, message: '已读取最新数据；浏览器空间有限，已保存精简离线副本。' };
        } catch {
          return { persisted: false, compacted: true, sessionOnly: true, message: '已读取最新数据；浏览器未能保存离线副本，本次页面仍可正常使用。' };
        }
      }
    },
  };
}
