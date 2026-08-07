export const LIFE_AREAS = Object.freeze([
  { key: 'health', label: '健康与精力', icon: '♡' },
  { key: 'family', label: '家庭与关系', icon: '⌂' },
  { key: 'learning', label: '学习成长', icon: '◇' },
  { key: 'finance', label: '个人财务', icon: '¥' },
  { key: 'travel', label: '旅行与兴趣', icon: '✦' },
  { key: 'review', label: '生活复盘', icon: '↻' },
]);

export function summarizeLife(items = []) {
  return LIFE_AREAS.map((area) => {
    const records = items.filter((item) => item.area === area.key && !item.deletedAt);
    return { ...area, count: records.length, open: records.filter((item) => item.status !== 'done').length };
  });
}

function dayNumber(value) {
  return Date.parse(`${value}T00:00:00Z`) / 86_400_000;
}

export function buildLifeAgenda(items = [], { now = new Date().toISOString(), horizonDays = 7 } = {}) {
  const today = String(now).slice(0, 10);
  const year = Number(today.slice(0, 4));
  return (Array.isArray(items) ? items : []).filter((item) => !item.deletedAt).map((item) => {
    let occurrence = String(item.date || item.startAt || '').slice(0, 10);
    if (!occurrence && /^\d{2}-\d{2}$/.test(item.monthDay || '')) {
      occurrence = `${year}-${item.monthDay}`;
      if (dayNumber(occurrence) < dayNumber(today)) occurrence = `${year + 1}-${item.monthDay}`;
    }
    return { ...item, occurrence, daysUntil: occurrence ? dayNumber(occurrence) - dayNumber(today) : Number.POSITIVE_INFINITY };
  }).filter((item) => item.daysUntil >= 0 && item.daysUntil <= horizonDays)
    .sort((left, right) => left.daysUntil - right.daysUntil || String(left.title).localeCompare(String(right.title), 'zh-CN'));
}
