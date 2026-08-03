function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function userIdForEmail(data, email) {
  const target = text(email).toLowerCase();
  const users = Array.isArray(data?.user_list) ? data.user_list : [];
  const exact = users.find((item) => text(item?.email).toLowerCase() === target);
  const candidate = exact || users[0];
  return text(candidate?.user_id) || null;
}

export function userIdForName(data, name) {
  const target = text(name);
  if (!target) return null;
  const users = Array.isArray(data?.items) ? data.items : [];
  const candidate = users.find((item) => text(item?.name) === target);
  return text(candidate?.user_id) || null;
}

export function calendarIdsFromList(data) {
  const calendars = Array.isArray(data?.calendar_list) ? data.calendar_list : [];
  const readableRoles = new Set(['reader', 'writer', 'owner']);
  return calendars
    .filter((item) => item?.is_deleted !== true && readableRoles.has(text(item?.role).toLowerCase()))
    .map((item) => text(item?.calendar_id))
    .filter(Boolean);
}

export function primaryCalendarId(data, userId) {
  const calendars = Array.isArray(data?.calendars) ? data.calendars : [];
  const exact = calendars.find((item) => !userId || text(item?.user_id) === userId);
  const candidate = exact || calendars[0];
  return text(candidate?.calendar?.calendar_id) || null;
}

export function feishuTimeToIso(value = {}) {
  const date = text(value?.date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { iso: new Date(`${date}T00:00:00.000Z`).toISOString(), allDay: true };
  }
  const timestamp = Number(value?.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return { iso: null, allDay: false };
  return { iso: new Date(timestamp * 1000).toISOString(), allDay: false };
}

export function normalizeFeishuCalendarEvents(items = []) {
  const events = [];
  for (const item of Array.isArray(items) ? items : []) {
    const eventId = text(item?.event_id);
    const start = feishuTimeToIso(item?.start_time);
    if (!eventId || !start.iso) continue;
    const end = feishuTimeToIso(item?.end_time);
    const privacy = text(item?.visibility).toLowerCase() === 'private' ? 'private' : 'work';
    const title = privacy === 'private' ? '个人安排' : text(item?.summary).slice(0, 200) || '飞书日历事项';
    const updated = feishuTimeToIso({ timestamp: item?.updated_at });
    events.push({
      id: `feishu-calendar:${eventId}:${start.iso}`,
      externalId: eventId,
      title,
      startAt: start.iso,
      endAt: end.iso || start.iso,
      allDay: start.allDay,
      company: privacy === 'private' ? 'life' : 'ceo',
      source: 'feishu_calendar',
      privacy,
      owner: null,
      sourceUpdatedAt: updated.iso,
    });
  }
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.externalId}:${event.startAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => left.startAt.localeCompare(right.startAt));
}
