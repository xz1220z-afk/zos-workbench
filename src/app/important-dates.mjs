import { countdownDistance, normalizeCountdown } from './countdown-center.mjs?v=2.3.0';

function isWorkDate(item) {
  return item.privacy === 'work' || ['wanjia', 'huahuo', 'lingli'].includes(item.company);
}

export function buildImportantDates(items = [], options = {}) {
  const workHorizonDays = Number.isFinite(options.workHorizonDays) ? options.workHorizonDays : 30;
  const lifeHorizonDays = Number.isFinite(options.lifeHorizonDays) ? options.lifeHorizonDays : 366;
  const result = { work: [], life: [] };
  for (const input of items) {
    try {
      const item = normalizeCountdown(input);
      const distance = countdownDistance(item, options);
      if (distance.days < 0) continue;
      const bucket = isWorkDate(item) ? 'work' : 'life';
      const horizon = bucket === 'work' ? workHorizonDays : lifeHorizonDays;
      if (distance.days <= horizon) result[bucket].push({ ...item, ...distance });
    } catch {
      // Invalid legacy rows remain stored but are not presented as trusted dates.
    }
  }
  result.work.sort((left, right) => left.days - right.days || left.title.localeCompare(right.title, 'zh-CN'));
  result.life.sort((left, right) => left.days - right.days || left.title.localeCompare(right.title, 'zh-CN'));
  return result;
}
