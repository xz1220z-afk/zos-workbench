export const LINGLI_TABLE_NAMES = Object.freeze({
  leads: '00.招生线索管理',
  students: '00.学员档案管理',
  income: '00.收入管理',
  costs: '01.成本管理',
  lessons: '03.课时消耗管理',
  classes: '01.教学班级管理',
});

export const LINGLI_TABLE_ALIASES = Object.freeze({
  leads: [LINGLI_TABLE_NAMES.leads, '01 招生线索管理'],
  students: [LINGLI_TABLE_NAMES.students, '01 学员档案管理'],
  income: [LINGLI_TABLE_NAMES.income, '00 收入成本管理'],
  costs: [LINGLI_TABLE_NAMES.costs, '00 收入成本管理'],
  lessons: [LINGLI_TABLE_NAMES.lessons, '02 排课课时管理'],
  classes: [LINGLI_TABLE_NAMES.classes, '00 教学班级管理'],
});

function fieldsOf(record) {
  return record?.fields && typeof record.fields === 'object' ? record.fields : (record || {});
}

function pick(record, names) {
  const fields = fieldsOf(record);
  for (const name of names) {
    if (fields[name] !== undefined && fields[name] !== null && fields[name] !== '') return fields[name];
  }
  return undefined;
}

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(',');
  if (value && typeof value === 'object') return text(value.text || value.name || value.value || '');
  return String(value ?? '').trim();
}

function number(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).replaceAll(',', '').replace(/[¥￥元\s]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function monthAt(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 10_000_000_000 ? new Date(numeric) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' })
    .format(date).slice(0, 7);
}

function currentMonth(asOf) {
  const date = new Date(asOf || Date.now());
  if (Number.isNaN(date.getTime())) throw new Error('invalid asOf');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' })
    .format(date).slice(0, 7);
}

function countByStatus(records, fieldNames, activeStatuses) {
  let proven = false;
  let count = 0;
  for (const record of records || []) {
    const raw = pick(record, fieldNames);
    if (raw === undefined) continue;
    proven = true;
    if (activeStatuses.some((status) => text(raw).includes(status))) count += 1;
  }
  return proven ? count : null;
}

function receivedThisMonth(records, month) {
  let proven = false;
  let total = 0;
  for (const record of records || []) {
    const explicitIncome = number(pick(record, ['收入金额', '实收金额', '收款金额', '到账金额']));
    const genericAmount = number(pick(record, ['金额', '发生金额']));
    const type = text(pick(record, ['收支类型', '类型', '业务类型', '科目']));
    const amount = explicitIncome ?? (/收入|实收|收款|学费/.test(type) ? genericAmount : null);
    const happenedAt = pick(record, ['发生日期', '收支日期', '日期', '收款日期', '到账日期']);
    const recordMonth = monthAt(happenedAt);
    if (amount === null || recordMonth === null) continue;
    proven = true;
    if (recordMonth === month && (explicitIncome !== null || /收入|实收|收款|学费/.test(type))) total += amount;
  }
  return proven ? Math.round(total * 100) / 100 : null;
}

function costsThisMonth(records, month) {
  let proven = false;
  let total = 0;
  for (const record of records || []) {
    const explicitCost = number(pick(record, ['支出金额', '成本金额']));
    const genericAmount = number(pick(record, ['金额', '发生金额']));
    const type = text(pick(record, ['收支类型', '类型', '业务类型', '科目', '类别']));
    const amount = explicitCost ?? (!type || /支出|成本|费用/.test(type) ? genericAmount : null);
    const happenedAt = pick(record, ['发生日期', '收支日期', '日期', '支出日期', '付款日期']);
    const recordMonth = monthAt(happenedAt);
    if (amount === null || recordMonth === null) continue;
    proven = true;
    if (recordMonth === month) total += amount;
  }
  return proven ? Math.round(total * 100) / 100 : null;
}

function consumedLessons(records) {
  let proven = false;
  let total = 0;
  for (const record of records || []) {
    const consumed = number(pick(record, ['消耗课时', '已消课时', '课消课时', '完成课时', '核销课时']));
    if (consumed !== null) {
      proven = true;
      total += consumed;
      continue;
    }
    const status = pick(record, ['课消状态', '排课状态', '状态']);
    if (status !== undefined) {
      proven = true;
      if (/已课消|已完成|完成|已核销/.test(text(status))) total += 1;
    }
  }
  return proven ? total : null;
}

export function summarizeLingli(input = {}, options = {}) {
  const month = currentMonth(options.asOf);
  const received = receivedThisMonth(input.income || input.finance, month);
  const cost = costsThisMonth(input.costs, month);
  return {
    leads: Array.isArray(input.leads) ? input.leads.length : 0,
    students: countByStatus(input.students, ['学员状态', '学习状态', '在读状态', '状态'], ['在读', '就读中', '已报名', '正常', '学习中']),
    received,
    cost,
    grossProfit: received === null || cost === null ? null : Math.round((received - cost) * 100) / 100,
    consumed: consumedLessons(input.lessons),
    activeClasses: countByStatus(input.classes, ['班级状态', '开班状态', '状态'], ['开班中', '进行中', '授课中', '正常']),
  };
}
