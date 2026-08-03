const VIEWS = new Set(['day', 'week', 'month', 'list']);

function dateKey(value, timeZone = 'Asia/Shanghai') {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('calendar_anchor_invalid');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(value, count) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + count, 12));
  return date.toISOString().slice(0, 10);
}

function timeZoneOffset(timeZone, date) {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(`${date}T12:00:00Z`))
    .find(({ type }) => type === 'timeZoneName')?.value;
  if (!part || part === 'GMT') return '+00:00';
  const match = part.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return '+00:00';
  return `${match[1]}${match[2].padStart(2, '0')}:${match[3] || '00'}`;
}

export function calendarVisibleRange({ view = 'week', anchor, timeZone = 'Asia/Shanghai' } = {}) {
  const resolvedView = VIEWS.has(view) ? view : 'week';
  const key = dateKey(anchor, timeZone);
  const weekday = (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7;
  let startDate = key;
  let days = 1;
  if (resolvedView === 'week') {
    startDate = addDays(key, -weekday);
    days = 7;
  } else if (resolvedView === 'month') {
    const first = `${key.slice(0, 7)}-01`;
    const firstWeekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
    startDate = addDays(first, -firstWeekday);
    days = 42;
  } else if (resolvedView === 'list') {
    startDate = addDays(key, -weekday);
    days = 31;
  }
  const endDate = addDays(startDate, days);
  const offset = timeZoneOffset(timeZone, startDate);
  return {
    view: resolvedView,
    anchor: key,
    startDate,
    endDate,
    days,
    queryStart: `${startDate}T00:00:00${offset}`,
    queryEnd: `${endDate}T00:00:00${timeZoneOffset(timeZone, endDate)}`,
  };
}

export function moveCalendarAnchor(anchor, view = 'week', direction = 0) {
  const key = dateKey(anchor);
  const step = Number(direction) || 0;
  if (view === 'day') return addDays(key, step);
  if (view === 'week') return addDays(key, step * 7);
  if (view === 'list') return addDays(key, step * 31);
  const [year, month, day] = key.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + step, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function calendarRangeKey({ startDate, endDate } = {}) {
  return `${startDate}/${endDate}`;
}
