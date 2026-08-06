import { calendarVisibleRange } from './calendar-range.mjs?v=2.0.0';
import { expandRecurringEvents } from './calendar-recurrence.mjs?v=2.0.0';

function iso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateOnlyIso(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? `${value}T00:00:00+08:00` : null;
}

function dateKey(value, timeZone = 'Asia/Shanghai') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(date, count) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + count));
  return value.toISOString().slice(0, 10);
}

function coveredDates(event, timeZone) {
  const start = dateKey(event.startAt, timeZone);
  if (!start) return [];
  const endInstant = new Date(event.endAt || event.startAt);
  if (Number.isNaN(endInstant.getTime())) return [start];
  if (!event.allDay && endInstant > new Date(event.startAt)) {
    endInstant.setMilliseconds(endInstant.getMilliseconds() - 1);
  }
  const end = dateKey(endInstant, timeZone) || start;
  const dates = [];
  for (let cursor = start; cursor <= end && dates.length < 370; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}

function normalizeEvent(input, fallback = {}) {
  const rawStart = input.startAt || input.dueAt || input.dueDate || input.date;
  const allDay = typeof input.allDay === 'boolean'
    ? input.allDay
    : !String(input.startAt || input.dueAt || '').includes('T');
  const startAt = dateOnlyIso(rawStart) || iso(rawStart);
  const endAt = iso(input.endAt || (input.startAt ? input.dueAt : null))
    || (startAt && !allDay ? new Date(new Date(startAt).getTime() + 3_600_000).toISOString() : startAt);
  return {
    id: String(input.id), title: String(input.title || input.name || '未命名事项'),
    startAt, endAt, allDay, company: input.company || fallback.company || 'ceo',
    source: input.source || fallback.source, privacy: input.privacy || fallback.privacy || 'work',
    owner: input.owner || null, sourceUpdatedAt: input.sourceUpdatedAt || input.updatedAt || null,
    notes: input.notes || '', reminders: Array.isArray(input.reminders) ? input.reminders : [],
    sourceUrl: input.sourceUrl || null, status: input.status || 'scheduled',
    revision: Number(input.revision) || 0,
    recurrenceRule: input.recurrenceRule || null, seriesId: input.seriesId || null,
    originalStartAt: input.originalStartAt || null, exceptionType: input.exceptionType || null,
  };
}

export function buildCalendar({
  tasks = [], projects = [], life = [], intelligence = [], calendar = [],
  countdowns: _countdowns = [], focusSessions = [],
} = {}, options = {}) {
  const showFocus = options.showFocus === true;
  return [
    ...calendar.map((item) => normalizeEvent(item, { source: 'user_calendar' })),
    ...tasks.filter((item) => item.occupyCalendar !== false).map((item) => normalizeEvent(item, { source: 'local_task' })),
    ...projects.map((item) => normalizeEvent(item, { source: 'business_project' })),
    ...life.map((item) => normalizeEvent(item, { source: 'life', company: 'life', privacy: 'private' })),
    ...intelligence.filter((item) => item.followUpAt).map((item) => normalizeEvent({ ...item, startAt: item.followUpAt }, { source: 'intelligence' })),
    ...(showFocus ? focusSessions.filter((item) => item.state === 'completed' && item.startedAt).map((item) => normalizeEvent({
      ...item, startAt: item.startedAt, endAt: item.endedAt,
      title: item.title || '专注时段', company: 'ceo', privacy: 'private',
    }, { source: 'focus' })) : []),
  ].filter((item) => item.id && item.startAt)
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
}

export function calendarLayout(events = [], options = {}) {
  const view = ['day', 'week', 'month', 'list'].includes(options.view) ? options.view : 'week';
  const timeZone = options.timeZone || 'Asia/Shanghai';
  const anchor = dateKey(options.anchor || Date.now(), timeZone);
  const range = calendarVisibleRange({ view, anchor, timeZone });
  const visibleEvents = expandRecurringEvents(events, {
    rangeStart: range.queryStart,
    rangeEnd: range.queryEnd,
  });
  const grouped = new Map();
  for (const event of visibleEvents) {
    for (const key of coveredDates(event, timeZone)) {
      if (key < range.startDate || key >= range.endDate) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(event);
    }
  }
  for (const rows of grouped.values()) rows.sort((left, right) => left.startAt.localeCompare(right.startAt));

  if (view === 'list') {
    return {
      view,
      groups: [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))
        .map(([date, rows]) => ({ date, events: rows })),
    };
  }

  const start = range.startDate;
  const count = range.days;
  return {
    view,
    days: Array.from({ length: count }, (_, index) => {
      const date = addDays(start, index);
      return { date, inMonth: date.slice(0, 7) === anchor.slice(0, 7), events: grouped.get(date) || [] };
    }),
  };
}

export function redactLifeEventForWork(event) {
  return event?.privacy === 'private' || event?.company === 'life'
    ? { ...event, title: '个人安排', owner: null, source: 'private_busy' }
    : { ...event };
}

export function detectCalendarConflicts(events = []) {
  const timed = events.filter((item) => item.startAt && item.endAt && !item.allDay)
    .sort((left, right) => new Date(left.startAt) - new Date(right.startAt));
  const conflicts = [];
  for (let index = 0; index < timed.length; index += 1) {
    for (let other = index + 1; other < timed.length; other += 1) {
      if (new Date(timed[other].startAt) >= new Date(timed[index].endAt)) break;
      conflicts.push({ ids: [timed[index].id, timed[other].id], startAt: timed[other].startAt });
    }
  }
  return conflicts;
}

export function calendarPeriod(events = [], { view = 'week', anchor = new Date().toISOString() } = {}) {
  const date = new Date(anchor);
  const start = new Date(date);
  if (view === 'day') start.setHours(0, 0, 0, 0);
  else if (view === 'month') start.setDate(1), start.setHours(0, 0, 0, 0);
  else start.setDate(start.getDate() - ((start.getDay() + 6) % 7)), start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (view === 'day') end.setDate(end.getDate() + 1);
  else if (view === 'month') end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + 7);
  return events.filter((item) => {
    const itemStart = new Date(item.startAt);
    const rawEnd = new Date(item.endAt || item.startAt);
    const itemEnd = rawEnd > itemStart ? rawEnd : new Date(itemStart.getTime() + 1);
    return itemEnd > start && itemStart < end;
  });
}
