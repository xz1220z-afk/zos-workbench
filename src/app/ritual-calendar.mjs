export const RITUAL_LIBRARY = Object.freeze([
  { id: 'new-year', title: '新年仪式', monthDay: '01-01', category: 'season', suggestion: '留一段不排工作的时间，写下今年最想守住的三件事。' },
  { id: 'valentines-day', title: '情人节', monthDay: '02-14', category: 'relationship', suggestion: '提前订花或安排一次不谈工作的约会。' },
  { id: 'spring-outing', title: '春日踏青', monthDay: '03-20', category: 'season', suggestion: '安排半天户外，拍一组春天的生活照片。' },
  { id: 'love-520', title: '520 心意日', monthDay: '05-20', category: 'relationship', suggestion: '准备一份小礼物或一顿有记忆点的晚餐。' },
  { id: 'childrens-day', title: '童心日', monthDay: '06-01', category: 'family', suggestion: '和家人做一件小时候喜欢的事。' },
  { id: 'start-of-autumn-milk-tea', title: '秋天的第一杯奶茶', monthDay: '08-07', category: 'season', suggestion: '提前选好口味和对象，送出一杯有备注的奶茶。' },
  { id: 'mid-autumn-family', title: '秋日家人晚餐', monthDay: '09-22', category: 'family', suggestion: '预留晚餐时间，给家人带一份应季小礼物。' },
  { id: 'national-day-break', title: '国庆留白日', monthDay: '10-01', category: 'rest', suggestion: '至少保留一天完全不处理公司的事务。' },
  { id: 'first-winter-warmth', title: '入冬暖意', monthDay: '11-07', category: 'season', suggestion: '准备围巾、热饮或一次短途温泉。' },
  { id: 'christmas-eve', title: '平安夜', monthDay: '12-24', category: 'relationship', suggestion: '提前安排一顿饭或一份有仪式感的小礼物。' },
  { id: 'christmas-day', title: '圣诞日', monthDay: '12-25', category: 'relationship', suggestion: '拍一张年度合照，留下今年的共同记忆。' },
  { id: 'new-years-eve', title: '跨年夜', monthDay: '12-31', category: 'reflection', suggestion: '安排年度回顾、合照和一个零点后的愿望。' },
]);

function shanghaiDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('invalid now');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayNumber(dateText) {
  return Date.parse(`${dateText}T00:00:00Z`) / 86_400_000;
}

export function upcomingRituals({ now = new Date().toISOString(), horizonDays = 90, ignoredIds = [] } = {}) {
  const today = shanghaiDate(now);
  const year = Number(today.slice(0, 4));
  const ignored = new Set(ignoredIds || []);
  const limit = Math.max(0, Math.min(366, Number(horizonDays) || 0));
  return RITUAL_LIBRARY.flatMap((ritual) => [year, year + 1].map((candidateYear) => {
    const occurrence = `${candidateYear}-${ritual.monthDay}`;
    return {
      ...ritual,
      occurrence,
      daysUntil: dayNumber(occurrence) - dayNumber(today),
      reminderDays: [7, 3, 1, 0],
      privacy: 'private',
      recurring: true,
    };
  })).filter((item) => !ignored.has(item.id) && item.daysUntil >= 0 && item.daysUntil <= limit)
    .sort((left, right) => left.daysUntil - right.daysUntil || left.id.localeCompare(right.id));
}
