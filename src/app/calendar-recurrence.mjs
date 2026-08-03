const INSTANCE_LIMIT = 500;
const SCAN_LIMIT = 20_000;
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'yearly']);

function validDate(value, error = 'calendar_recurrence_time_invalid') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(error);
  return date;
}

function dayDiff(base, candidate) {
  const left = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  const right = Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate());
  return Math.floor((right - left) / 86_400_000);
}

function matchesRule(base, candidate, rule) {
  const interval = Math.max(1, Number(rule.interval) || 1);
  const diff = dayDiff(base, candidate);
  if (diff < 0) return false;
  if (rule.frequency === 'daily') return diff % interval === 0;
  if (rule.frequency === 'weekly') {
    const isoWeekday = candidate.getUTCDay() || 7;
    const weekdays = Array.isArray(rule.byWeekdays) && rule.byWeekdays.length
      ? rule.byWeekdays.map(Number).filter((value) => value >= 1 && value <= 7)
      : [base.getUTCDay() || 7];
    return Math.floor(diff / 7) % interval === 0 && weekdays.includes(isoWeekday);
  }
  const monthDiff = (candidate.getUTCFullYear() - base.getUTCFullYear()) * 12
    + candidate.getUTCMonth() - base.getUTCMonth();
  if (rule.frequency === 'monthly') {
    return monthDiff >= 0 && monthDiff % interval === 0
      && candidate.getUTCDate() === base.getUTCDate();
  }
  if (rule.frequency === 'yearly') {
    const yearDiff = candidate.getUTCFullYear() - base.getUTCFullYear();
    return yearDiff >= 0 && yearDiff % interval === 0
      && candidate.getUTCMonth() === base.getUTCMonth()
      && candidate.getUTCDate() === base.getUTCDate();
  }
  return false;
}

function overlaps(start, end, rangeStart, rangeEnd) {
  return end > rangeStart && start < rangeEnd;
}

export function expandRecurringEvents(events = [], { rangeStart, rangeEnd } = {}) {
  const startBoundary = validDate(rangeStart, 'calendar_recurrence_range_invalid');
  const endBoundary = validDate(rangeEnd, 'calendar_recurrence_range_invalid');
  if (endBoundary <= startBoundary) throw new Error('calendar_recurrence_range_invalid');

  const exceptions = new Map(events
    .filter((row) => row.originalStartAt && row.seriesId)
    .map((row) => [`${row.seriesId}:${validDate(row.originalStartAt).toISOString()}`, row]));
  const output = [];

  for (const base of events.filter((row) => !row.originalStartAt)) {
    const first = validDate(base.startAt);
    const baseEnd = validDate(base.endAt || base.startAt);
    const duration = Math.max(base.allDay ? 86_400_000 : 1, baseEnd.getTime() - first.getTime());
    const effectiveBaseEnd = new Date(first.getTime() + duration);
    const rule = base.recurrenceRule;
    if (!rule) {
      if (overlaps(first, effectiveBaseEnd, startBoundary, endBoundary)) output.push(base);
      continue;
    }
    if (!FREQUENCIES.has(rule.frequency)) continue;

    const cursor = new Date(first);
    let visibleCount = 0;
    let occurrenceCount = 0;
    let scanned = 0;
    while (cursor < endBoundary && visibleCount < INSTANCE_LIMIT && scanned < SCAN_LIMIT) {
      if (matchesRule(first, cursor, rule)) {
        occurrenceCount += 1;
        if (rule.count && occurrenceCount > Math.max(0, Number(rule.count))) break;
        if (rule.until && cursor > validDate(rule.until)) break;

        const originalStartAt = cursor.toISOString();
        const occurrenceEnd = new Date(cursor.getTime() + duration);
        const seriesId = base.seriesId || base.id;
        const exception = exceptions.get(`${seriesId}:${originalStartAt}`);
        if (overlaps(cursor, occurrenceEnd, startBoundary, endBoundary)
          && exception?.exceptionType !== 'cancelled') {
          output.push(exception?.exceptionType === 'modified'
            ? { ...base, ...exception, seriesId, originalStartAt }
            : {
              ...base,
              id: `${seriesId}@${originalStartAt}`,
              seriesId,
              originalStartAt,
              startAt: originalStartAt,
              endAt: occurrenceEnd.toISOString(),
            });
          visibleCount += 1;
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      scanned += 1;
    }
  }
  return output.sort((left, right) => String(left.startAt).localeCompare(String(right.startAt)));
}

export function seriesMutationRecords(base = {}, occurrence = {}, scope, patch = {}) {
  const boundary = occurrence.originalStartAt || occurrence.startAt;
  if (!boundary) throw new Error('calendar_occurrence_required');
  const originalStartAt = validDate(boundary).toISOString();
  if (scope === 'single') {
    const baseStart = validDate(base.startAt || originalStartAt);
    const baseEnd = validDate(base.endAt || base.startAt || originalStartAt);
    const duration = Math.max(base.allDay ? 86_400_000 : 1, baseEnd.getTime() - baseStart.getTime());
    return [{
      ...base,
      id: undefined,
      seriesId: base.seriesId || base.id,
      originalStartAt,
      exceptionType: patch.deleted ? 'cancelled' : 'modified',
      startAt: patch.startAt || originalStartAt,
      endAt: patch.endAt || new Date(validDate(originalStartAt).getTime() + duration).toISOString(),
      ...patch,
      source: 'user_calendar',
    }];
  }
  if (scope === 'series') return [{ ...base, ...patch, source: 'user_calendar' }];
  if (scope !== 'future') throw new Error('calendar_series_scope_invalid');

  const boundaryDate = validDate(originalStartAt);
  const baseStart = validDate(base.startAt);
  const baseEnd = validDate(base.endAt || base.startAt);
  const duration = Math.max(0, baseEnd.getTime() - baseStart.getTime());
  const oldSeries = {
    ...base,
    recurrenceRule: {
      ...base.recurrenceRule,
      until: new Date(boundaryDate.getTime() - 1).toISOString(),
    },
  };
  const newSeries = {
    ...base,
    ...patch,
    id: undefined,
    seriesId: undefined,
    startAt: patch.startAt || originalStartAt,
    endAt: patch.endAt || new Date(boundaryDate.getTime() + duration).toISOString(),
    source: 'user_calendar',
  };
  return [oldSeries, newSeries];
}
