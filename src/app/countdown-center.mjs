function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateKey(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('invalid countdown timestamp');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateNumber(value) {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function normalizeCountdown(input = {}) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('countdown title is required');
  const date = String(input.date || '').trim();
  if (!isValidDate(date)) throw new Error('valid countdown date is required');
  const recurrence = input.recurrence || 'once';
  if (!['once', 'yearly'].includes(recurrence)) throw new Error('unsupported countdown recurrence');
  return {
    ...input,
    id: String(input.id || globalThis.crypto?.randomUUID?.() || `countdown-${Date.now()}`),
    title,
    date,
    recurrence,
    company: input.company || 'ceo',
    privacy: input.privacy || 'private',
    color: input.color || 'gold',
  };
}

export function nextCountdownOccurrence(input, options = {}) {
  const item = normalizeCountdown(input);
  if (item.recurrence === 'once') return item.date;
  const today = dateKey(options.now || Date.now(), options.timeZone || 'Asia/Shanghai');
  const year = Number(today.slice(0, 4));
  const monthDay = item.date.slice(4);
  const candidate = `${year}${monthDay}`;
  if (isValidDate(candidate) && candidate >= today) return candidate;
  for (let nextYear = year + 1; nextYear <= year + 4; nextYear += 1) {
    const next = `${nextYear}${monthDay}`;
    if (isValidDate(next)) return next;
  }
  throw new Error('unable to calculate countdown occurrence');
}

export function countdownDistance(input, options = {}) {
  const item = normalizeCountdown(input);
  const timeZone = options.timeZone || 'Asia/Shanghai';
  const today = dateKey(options.now || Date.now(), timeZone);
  const occurrence = nextCountdownOccurrence(item, { ...options, timeZone });
  const days = Math.round((dateNumber(occurrence) - dateNumber(today)) / 86_400_000);
  return { occurrence, days, state: days === 0 ? 'today' : days > 0 ? 'future' : 'expired' };
}
