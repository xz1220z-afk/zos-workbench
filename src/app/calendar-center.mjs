function iso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeEvent(input, fallback = {}) {
  const startAt = iso(input.startAt || input.dueAt || input.dueDate || input.date);
  const allDay = !String(input.startAt || input.dueAt || '').includes('T');
  const endAt = iso(input.endAt) || (startAt && !allDay ? new Date(new Date(startAt).getTime() + 3_600_000).toISOString() : startAt);
  return {
    id: String(input.id), title: String(input.title || input.name || '未命名事项'),
    startAt, endAt, allDay, company: input.company || fallback.company || 'ceo',
    source: input.source || fallback.source, privacy: input.privacy || fallback.privacy || 'work',
    owner: input.owner || null, sourceUpdatedAt: input.sourceUpdatedAt || input.updatedAt || null,
  };
}

export function buildCalendar({ tasks = [], projects = [], life = [], intelligence = [], calendar = [] } = {}) {
  return [
    ...calendar.map((item) => normalizeEvent(item, { source: 'user_calendar' })),
    ...tasks.map((item) => normalizeEvent(item, { source: 'local_task' })),
    ...projects.map((item) => normalizeEvent(item, { source: 'business_project' })),
    ...life.map((item) => normalizeEvent(item, { source: 'life', company: 'life', privacy: 'private' })),
    ...intelligence.filter((item) => item.followUpAt).map((item) => normalizeEvent({ ...item, startAt: item.followUpAt }, { source: 'intelligence' })),
  ].filter((item) => item.id && item.startAt)
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
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
  return events.filter((item) => new Date(item.startAt) >= start && new Date(item.startAt) < end);
}
