const DONE = new Set(['done', 'completed', 'cancelled']);

function dateKey(value, timeZone = 'Asia/Shanghai') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function zonedTimestamp(date, time, timeZone) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  let candidate = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(candidate)).map(({ type, value }) => [type, value]));
    const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    candidate += Date.UTC(year, month - 1, day, hour, minute) - rendered;
  }
  return new Date(candidate).toISOString();
}

function safeItem(item = {}) {
  return {
    id: String(item.id || ''),
    title: item.privacy === 'private' ? '个人安排' : String(item.title || '待确认安排').trim(),
    company: item.privacy === 'private' ? 'life' : String(item.company || 'ceo'),
  };
}

function itemDate(item, fields, timeZone) {
  for (const field of fields) {
    if (item?.[field]) {
      const key = dateKey(item[field], timeZone);
      if (key) return key;
    }
  }
  return null;
}

function byTime(left, right) {
  const leftTime = String(left.startAt || left.dueAt || left.completedAt || '');
  const rightTime = String(right.startAt || right.dueAt || right.completedAt || '');
  return leftTime.localeCompare(rightTime);
}

function digestBody(sections, labels) {
  return labels.map(([key, label]) => {
    const value = sections[key];
    return Array.isArray(value) ? `${label} ${value.length} 项` : `${label} ${Number(value) || 0} 组`;
  }).join('；');
}

export function buildMorningDigest(input = {}, options = {}) {
  const date = String(options.date || '').slice(0, 10);
  const timeZone = options.timeZone || 'Asia/Shanghai';
  const tasks = (input.tasks || []).filter((item) => !DONE.has(String(item.status || '').toLowerCase())
    && itemDate(item, ['startAt', 'dueAt', 'dueDate'], timeZone) === date);
  const calendar = (input.calendar || []).filter((item) => itemDate(item, ['startAt'], timeZone) === date);
  const actions = [...tasks, ...calendar].sort(byTime).slice(0, 3).map(safeItem);
  const deadlines = (input.importantDates?.work || []).filter((item) => Number(item.days) >= 0 && Number(item.days) <= 30)
    .slice(0, 5).map(safeItem);
  const sections = { actions, conflictCount: (input.conflicts || []).length, deadlines };
  return {
    id: `digest:morning:${date}`, kind: 'morning_digest', entityType: 'morning_digest', date,
    title: 'ZOS 晨间简报', body: digestBody(sections, [['actions', '今日重点'], ['conflictCount', '时间冲突'], ['deadlines', '关键期限']]),
    privacy: 'work', sections,
  };
}

export function buildEveningDigest(input = {}, options = {}) {
  const date = String(options.date || '').slice(0, 10);
  const timeZone = options.timeZone || 'Asia/Shanghai';
  const tomorrowDate = addDays(date, 1);
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const completed = tasks.filter((item) => DONE.has(String(item.status || '').toLowerCase())
    && itemDate(item, ['completedAt', 'updatedAt', 'dueAt', 'dueDate'], timeZone) === date).sort(byTime).map(safeItem);
  const carryOver = tasks.filter((item) => !DONE.has(String(item.status || '').toLowerCase())
    && itemDate(item, ['startAt', 'dueAt', 'dueDate'], timeZone) === date).sort(byTime).map(safeItem);
  const tomorrow = tasks.filter((item) => !DONE.has(String(item.status || '').toLowerCase())
    && itemDate(item, ['startAt', 'dueAt', 'dueDate'], timeZone) === tomorrowDate).sort(byTime).slice(0, 3).map(safeItem);
  const sections = { completed, carryOver, tomorrow };
  return {
    id: `digest:evening:${date}`, kind: 'evening_digest', entityType: 'evening_digest', date,
    title: 'ZOS 晚间简报', body: digestBody(sections, [['completed', '今日完成'], ['carryOver', '待顺延'], ['tomorrow', '明日重点']]),
    privacy: 'work', sections,
  };
}

export function buildDailyDigestItems(input = {}, options = {}) {
  const date = String(options.date || '').slice(0, 10);
  const timeZone = options.timeZone || 'Asia/Shanghai';
  const morning = buildMorningDigest(input, { date, timeZone });
  const evening = buildEveningDigest(input, { date, timeZone });
  const items = [
    { ...morning, reminderAt: zonedTimestamp(date, options.morningTime || '07:30', timeZone) },
    { ...evening, reminderAt: zonedTimestamp(date, options.eveningTime || '21:30', timeZone) },
  ];
  if (options.includeTomorrowMorning) {
    const tomorrow = addDays(date, 1);
    items.push({
      ...buildMorningDigest(input, { date: tomorrow, timeZone }),
      reminderAt: zonedTimestamp(tomorrow, options.morningTime || '07:30', timeZone),
    });
  }
  return items;
}
