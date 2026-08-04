function optional(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

const COMPLETE_STATES = new Set(['done', 'completed', 'cancelled']);

function isoTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function reminderMoments(item) {
  const moments = [];
  const explicit = isoTimestamp(item?.reminderAt);
  if (explicit) moments.push({ node: 'explicit', scheduledAt: explicit });
  const start = new Date(item?.startAt || '');
  if (!Number.isNaN(start.getTime())) {
    const minutes = Array.isArray(item?.reminders) ? item.reminders : [];
    for (const raw of minutes) {
      const offset = Number(raw);
      if (!Number.isInteger(offset) || offset < 0 || offset > 43_200) continue;
      moments.push({ node: `before_${offset}m`, scheduledAt: new Date(start.getTime() - offset * 60_000).toISOString() });
    }
  }
  return moments;
}

export function buildDurableReminderSchedule(items = [], options = {}) {
  const ownerId = String(options.ownerId || '').trim();
  if (!ownerId) throw new Error('reminder_owner_required');
  const nowMs = new Date(options.now || Date.now()).getTime();
  const acknowledged = new Set(Array.isArray(options.acknowledged) ? options.acknowledged : []);
  const scheduled = [];
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || '').trim();
    if (!id || COMPLETE_STATES.has(String(item?.status || '').toLowerCase())) continue;
    const entityType = String(item?.entityType || item?.sourceType || 'schedule').trim();
    for (const moment of reminderMoments(item)) {
      if (new Date(moment.scheduledAt).getTime() < nowMs) continue;
      const dedupeKey = `${ownerId}:${entityType}:${id}:${moment.node}:${moment.scheduledAt}`;
      if (acknowledged.has(dedupeKey)) continue;
      scheduled.push({
        id: `scheduled:${dedupeKey}`,
        dedupeKey,
        ownerId,
        entityType,
        entityId: id,
        scheduledAt: moment.scheduledAt,
        title: item?.privacy === 'private' ? '个人安排' : String(item?.title || 'ZOS 提醒').trim(),
        body: item?.privacy === 'private' ? '个人安排' : String(item?.body || item?.title || '有一项安排需要处理').trim().slice(0, 240),
        privacy: item?.privacy === 'private' ? 'private' : 'work',
        status: 'pending',
        createdAt: new Date(Number.isFinite(nowMs) ? nowMs : Date.now()).toISOString(),
      });
    }
  }
  return scheduled.sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt) || left.dedupeKey.localeCompare(right.dedupeKey));
}

export function buildReminderQueue(actions = [], options = {}) {
  const now = String(options.now || new Date().toISOString());
  const date = now.slice(0, 10);
  return (Array.isArray(actions) ? actions : []).filter((item) => item?.id && item?.title).map((item) => ({
    id: `reminder:${item.id}:${date}`,
    actionId: item.id,
    title: String(item.title).trim(),
    reason: optional(item.reason),
    sourceType: optional(item.sourceType),
    sourceId: optional(item.sourceId),
    owner: optional(item.owner),
    dueAt: optional(item.dueAt),
    recommendedAction: optional(item.recommendedAction),
    channel: 'in_app',
    status: 'pending',
    createdAt: now,
  }));
}

export function notifyGrantedReminders(reminders = [], environment = globalThis) {
  const Notification = environment?.Notification;
  if (!Notification || Notification.permission !== 'granted') {
    return { sent: 0, state: Notification?.permission === 'denied' ? 'denied' : 'permission_required' };
  }
  let sent = 0;
  for (const reminder of Array.isArray(reminders) ? reminders : []) {
    new Notification('ZOS 今日提醒', {
      body: reminder.reason ? `${reminder.title}｜${reminder.reason}` : reminder.title,
      tag: reminder.id,
      renotify: false,
    });
    sent += 1;
  }
  return { sent, state: 'sent' };
}
