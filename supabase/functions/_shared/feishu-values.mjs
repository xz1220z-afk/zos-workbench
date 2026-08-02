const TEXT_KEYS = ['text', 'name', 'label', 'title', 'value'];

export function feishuText(value, fallback = '') {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') {
    const text = value.trim();
    return text && !text.includes('[object Object]') ? text : fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((item) => feishuText(item, '')).filter(Boolean);
    return parts.length ? [...new Set(parts)].join('、') : fallback;
  }
  if (typeof value === 'object') {
    for (const key of TEXT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const text = feishuText(value[key], '');
        if (text) return text;
      }
    }
  }
  return fallback;
}

export function feishuNumber(value) {
  if (Array.isArray(value)) return value.length ? feishuNumber(value[0]) : 0;
  if (value && typeof value === 'object') {
    for (const key of ['value', 'number', 'amount', 'text']) {
      if (Object.prototype.hasOwnProperty.call(value, key)) return feishuNumber(value[key]);
    }
    return 0;
  }
  const normalized = typeof value === 'string' ? value.replaceAll(',', '').replace(/[￥¥\s]/g, '') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value) {
  return Math.round((feishuNumber(value) + Number.EPSILON) * 100) / 100;
}
