function optional(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
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
