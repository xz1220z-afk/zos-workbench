export function safeNotificationPayload(job = {}) {
  const privateItem = job.privacy === 'private';
  const routes = {
    task: './#tasks',
    calendar: './#calendar',
    important_date: job.privacy === 'private' ? './#life' : './#dashboard',
    morning_digest: './#today',
    evening_digest: './#reviews',
  };
  return {
    title: 'ZOS 提醒',
    body: privateItem ? '个人安排' : String(job.body || job.title || '有一项安排需要处理').slice(0, 240),
    tag: String(job.dedupe_key || job.id || 'zos-reminder'),
    url: routes[job.entity_type] || './#today',
  };
}

const ENTITY_TYPES = new Set(['task', 'calendar', 'important_date', 'morning_digest', 'evening_digest']);

export function normalizeScheduledJobs(jobs = [], options = {}) {
  const userId = String(options.userId || '').trim();
  if (!userId) throw new Error('schedule_owner_required');
  const nowMs = new Date(options.now || Date.now()).getTime();
  const earliest = nowMs - 300_000;
  const latest = nowMs + 90 * 86_400_000;
  const seen = new Set();
  const rows = [];
  for (const input of (Array.isArray(jobs) ? jobs : []).slice(0, 500)) {
    const entityType = String(input?.entityType || '').trim();
    const entityId = String(input?.entityId || '').trim().slice(0, 200);
    const scheduledAt = new Date(input?.scheduledAt || '');
    const rawKey = String(input?.dedupeKey || '').trim();
    if (!ENTITY_TYPES.has(entityType) || !entityId || !rawKey || Number.isNaN(scheduledAt.getTime())) continue;
    if (scheduledAt.getTime() < earliest || scheduledAt.getTime() > latest) continue;
    const keyTail = rawKey.includes(':') ? rawKey.split(':').slice(1).join(':') : rawKey;
    const dedupeKey = `${userId}:${keyTail}`.slice(0, 500);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const privateItem = input?.privacy === 'private';
    rows.push({
      user_id: userId,
      dedupe_key: dedupeKey,
      entity_type: entityType,
      entity_id: entityId,
      scheduled_at: scheduledAt.toISOString(),
      title: privateItem ? '个人安排' : String(input?.title || 'ZOS 提醒').trim().slice(0, 120),
      body: privateItem ? '个人安排' : String(input?.body || input?.title || '有一项安排需要处理').trim().slice(0, 240),
      privacy: privateItem ? 'private' : 'work',
      status: 'pending',
    });
  }
  return rows;
}

export function selectSingleSubscription(subscriptions = []) {
  return (Array.isArray(subscriptions) ? subscriptions : [])
    .filter((item) => item?.enabled !== false && item?.endpoint)
    .sort((left, right) => String(right.last_seen_at || '').localeCompare(String(left.last_seen_at || '')))[0] || null;
}
