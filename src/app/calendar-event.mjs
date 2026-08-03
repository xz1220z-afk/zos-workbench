const COMPANIES = new Set(['ceo', 'wanjia', 'huahuo', 'lingli', 'life']);
const PRIVACY = new Set(['work', 'private']);
const RECURRENCE_FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'yearly']);
const EXCEPTION_TYPES = new Set(['modified', 'cancelled']);

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

function normalizedRecurrenceRule(value) {
  if (!value || value.frequency === 'none') return null;
  if (!RECURRENCE_FREQUENCIES.has(value.frequency)) throw new Error('calendar_recurrence_invalid');
  const rule = {
    frequency: value.frequency,
    interval: Math.max(1, Math.min(365, Number(value.interval) || 1)),
  };
  const weekdays = Array.isArray(value.byWeekdays)
    ? [...new Set(value.byWeekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))]
    : [];
  if (weekdays.length) rule.byWeekdays = weekdays;
  if (Number(value.count) > 0) rule.count = Math.floor(Number(value.count));
  if (value.until) rule.until = timestamp(value.until);
  return rule;
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
  const recurrenceRule = hasOwn(input, 'recurrenceRule') ? input.recurrenceRule : existing.recurrenceRule;
  const seriesId = hasOwn(input, 'seriesId') ? input.seriesId : existing.seriesId;
  const originalStartAt = hasOwn(input, 'originalStartAt') ? input.originalStartAt : existing.originalStartAt;
  const exceptionType = hasOwn(input, 'exceptionType') ? input.exceptionType : existing.exceptionType;
  return {
    ...existing,
    id: hasOwn(input, 'id') ? (input.id || undefined) : existing.id,
    title,
    startAt,
    endAt,
    allDay,
    company: COMPANIES.has(company) ? company : 'ceo',
    privacy: PRIVACY.has(privacy) ? privacy : 'work',
    notes: String(notes || '').trim(),
    reminders: normalizedReminders(reminders),
    recurrenceRule: normalizedRecurrenceRule(recurrenceRule),
    seriesId: seriesId ? String(seriesId) : undefined,
    originalStartAt: originalStartAt ? timestamp(originalStartAt) : undefined,
    exceptionType: EXCEPTION_TYPES.has(exceptionType) ? exceptionType : undefined,
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
