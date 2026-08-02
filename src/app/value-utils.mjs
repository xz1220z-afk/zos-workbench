const HUMAN_TEXT_KEYS = ['text', 'title', 'name', 'label', 'value'];

export function humanText(value, fallback = '') {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') {
    const text = value.trim();
    return text && !text.includes('[object Object]') ? text : fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((item) => humanText(item, '')).filter(Boolean);
    return parts.length ? [...new Set(parts)].join('、') : fallback;
  }
  if (typeof value === 'object') {
    for (const key of HUMAN_TEXT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const text = humanText(value[key], '');
        if (text) return text;
      }
    }
  }
  return fallback;
}

export function formatCurrency(value, fallback = '—') {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return `¥${number.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
