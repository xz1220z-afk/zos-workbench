const SENSITIVE_FIELD = /(password|passcode|access[_-]?token|refresh[_-]?token|authorization|api[_-]?key|anon[_-]?key|auth[_-]?(?:token|key)|feishu[_-]?(?:token|key)|supabase[_-]?(?:token|key)|encryption[_-]?key|secret|service[_-]?role|private[_-]?key|credential|cookie|session(?:[_-]?(?:id|token|key))?$)/i;

export function isSensitiveFieldName(key) {
  return SENSITIVE_FIELD.test(String(key || ''));
}

export function sanitizeSensitiveFields(value) {
  if (Array.isArray(value)) return value.map(sanitizeSensitiveFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isSensitiveFieldName(key))
    .map(([key, item]) => [key, sanitizeSensitiveFields(item)]));
}
