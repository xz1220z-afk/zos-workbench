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

