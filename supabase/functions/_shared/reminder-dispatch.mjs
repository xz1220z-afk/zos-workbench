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
    body: privateItem ? '个人安排' : String(job.title || '有一项安排需要处理').slice(0, 120),
    tag: String(job.dedupe_key || job.id || 'zos-reminder'),
    url: routes[job.entity_type] || './#today',
  };
}

export function selectSingleSubscription(subscriptions = []) {
  return (Array.isArray(subscriptions) ? subscriptions : [])
    .filter((item) => item?.enabled !== false && item?.endpoint)
    .sort((left, right) => String(right.last_seen_at || '').localeCompare(String(left.last_seen_at || '')))[0] || null;
}
