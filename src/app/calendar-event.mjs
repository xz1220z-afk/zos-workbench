const COMPANIES = new Set(['ceo', 'wanjia', 'huahuo', 'lingli', 'life']);
const PRIVACY = new Set(['work', 'private']);

function hasOwn(input, key) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function timestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('calendar_time_invalid');
  return date.toISOString();
}

function safeSourceUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function normalizedReminders(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((minutes) => Number.isInteger(minutes) && minutes >= 0 && minutes <= 43_200))]
    .sort((left, right) => left - right);
}

export function validateCalendarDraft(input = {}, existing = {}) {
  const errors = [];
  const title = String(hasOwn(input, 'title') ? input.title : existing.title || '').trim();
  if (!title) errors.push('calendar_title_required');

  const rawStart = hasOwn(input, 'startAt') ? input.startAt : existing.startAt;
  const rawEnd = hasOwn(input, 'endAt') ? input.endAt : existing.endAt;
  const start = new Date(rawStart);
  const end = rawEnd ? new Date(rawEnd) : null;
  if (!rawStart || Number.isNaN(start.getTime()) || (rawEnd && Number.isNaN(end.getTime()))) {
    errors.push('calendar_time_invalid');
  } else if (end && end < start) {
    errors.push('calendar_end_before_start');
  }
  return errors;
}

export function normalizeCalendarDraft(input = {}, existing = {}) {
  const errors = validateCalendarDraft(input, existing);
  if (errors.length) throw new Error(errors[0]);

  const title = String(hasOwn(input, 'title') ? input.title : existing.title).trim();
  const startAt = timestamp(hasOwn(input, 'startAt') ? input.startAt : existing.startAt);
  const allDay = hasOwn(input, 'allDay') ? Boolean(input.allDay) : Boolean(existing.allDay);
  const rawEnd = hasOwn(input, 'endAt') ? input.endAt : existing.endAt;
  const endAt = rawEnd
    ? timestamp(rawEnd)
    : new Date(new Date(startAt).getTime() + (allDay ? 0 : 3_600_000)).toISOString();
  if (new Date(endAt) < new Date(startAt)) throw new Error('calendar_end_before_start');

  const company = hasOwn(input, 'company') ? input.company : existing.company;
  const privacy = hasOwn(input, 'privacy') ? input.privacy : existing.privacy;
  const notes = hasOwn(input, 'notes') ? input.notes : existing.notes;
  const reminders = hasOwn(input, 'reminders') ? input.reminders : existing.reminders;
  const sourceUrl = hasOwn(input, 'sourceUrl') ? input.sourceUrl : existing.sourceUrl;
  return {
    ...existing,
    title,
    startAt,
    endAt,
    allDay,
    company: COMPANIES.has(company) ? company : 'ceo',
    privacy: PRIVACY.has(privacy) ? privacy : 'work',
    notes: String(notes || '').trim(),
    reminders: normalizedReminders(reminders),
    sourceUrl: safeSourceUrl(sourceUrl),
    status: hasOwn(input, 'status') ? input.status : (existing.status || 'scheduled'),
    source: 'user_calendar',
  };
}

export function calendarEventCapabilities(event = {}) {
  const local = event.source === 'user_calendar';
  return {
    edit: local,
    remove: local,
    drag: local && !event.recurrenceRule && !event.seriesId && !event.originalStartAt,
    openSource: !local && Boolean(safeSourceUrl(event.sourceUrl)),
    copy: true,
  };
}
