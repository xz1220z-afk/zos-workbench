const DAY_MS = 86_400_000;

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function dateAt(day) {
  const value = String(day || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : null;
}

function shift(day, amount) {
  const date = dateAt(day);
  return date ? isoDay(new Date(date.getTime() + amount * DAY_MS)) : null;
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}

function rangeDays(startDate, endDate) {
  const output = [];
  for (let cursor = dateAt(startDate); cursor && cursor <= dateAt(endDate); cursor = new Date(cursor.getTime() + DAY_MS)) output.push(isoDay(cursor));
  return output;
}

function asDate(value, today) {
  return dateAt(value) ? value : today;
}

export function normalizeWanjiaRange(input = {}, options = {}) {
  const today = asDate(options.today, isoDay(new Date()));
  const date = dateAt(today) || new Date();
  const weekday = (date.getUTCDay() + 6) % 7;
  const startOfWeek = isoDay(new Date(date.getTime() - weekday * DAY_MS));
  const endOfWeek = isoDay(new Date(date.getTime() + (6 - weekday) * DAY_MS));
  const startOfMonth = `${today.slice(0, 8)}01`;
  const previousMonthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0));
  const lastMonthEnd = isoDay(previousMonthEnd);
  const lastMonthStart = `${lastMonthEnd.slice(0, 8)}01`;
  const preset = input.preset || 'today';
  const ranges = {
    today: [today, today], yesterday: [shift(today, -1), shift(today, -1)],
    last_7_days: [shift(today, -6), today], last_30_days: [shift(today, -29), today],
    this_week: [startOfWeek, endOfWeek], last_week: [shift(startOfWeek, -7), shift(startOfWeek, -1)],
    this_month: [startOfMonth, today], last_month: [lastMonthStart, lastMonthEnd],
    custom: [input.startDate, input.endDate],
  };
  let [startDate, endDate] = ranges[preset] || ranges.today;
  startDate = asDate(startDate, today);
  endDate = asDate(endDate, today);
  if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
  return { startDate, endDate, preset: ranges[preset] ? preset : 'today' };
}

function normalizeRow(input = {}) {
  const businessDate = String(input.businessDate || input.business_date || input.dataDate || '').slice(0, 10);
  return {
    ...input, businessDate, merchantId: String(input.merchantId || input.merchant_id || ''),
    merchantName: String(input.merchantName || input.merchant_name || '未知商家'),
    industry: String(input.industry || '待补充'), owner: String(input.owner || '未指定'),
    cooperationType: String(input.cooperationType || input.cooperation_type || '待补充'),
    paymentGmv: finite(input.paymentGmv ?? input.payment_gmv ?? input.gmv),
    redeemedGmv: finite(input.redeemedGmv ?? input.redeemed_gmv), refundGmv: finite(input.refundGmv ?? input.refund_gmv),
    videoPaymentGmv: finite(input.videoPaymentGmv ?? input.video_payment_gmv), livePaymentGmv: finite(input.livePaymentGmv ?? input.live_payment_gmv),
    exception: input.exception === true || input.isAbnormal === true,
    sourceKind: input.sourceKind || input.source_kind || 'unknown',
  };
}

function availabilityOf(history, rows) {
  const declared = history?.availability || {};
  const sourceRows = Array.isArray(history?.rows) ? history.rows : history?.records;
  if (!history || !Array.isArray(sourceRows)) return { state: 'missing', source: 'local_sqlite', label: '历史数据积累中' };
  if (declared.state && declared.state !== 'validated') return { ...declared, label: declared.label || (declared.state === 'pending' ? '待校验' : '历史数据积累中') };
  const dates = rows.map((item) => item.businessDate).filter(Boolean).sort();
  return {
    state: dates.length ? 'validated' : 'missing', source: declared.source || 'local_sqlite',
    latestDate: declared.latestDate || dates.at(-1) || null, earliestDate: declared.earliestDate || dates[0] || null,
    batchCount: finite(declared.batchCount), label: dates.length ? '历史数据已验证' : '历史数据积累中',
  };
}

function sumMetric(rows, key) {
  const values = rows.map((row) => finite(row[key])).filter((value) => value !== null);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function snapshotsDelta(rows, key, range) {
  const byMerchant = new Map();
  rows.forEach((row) => {
    if (!row.merchantId || row.sourceKind !== 'period_snapshot') return;
    const group = byMerchant.get(row.merchantId) || [];
    group.push(row); byMerchant.set(row.merchantId, group);
  });
  const startBoundary = shift(range.startDate, -1);
  let found = false; let total = 0;
  for (const entries of byMerchant.values()) {
    const end = entries.filter((item) => item.businessDate === range.endDate).at(-1);
    if (!end) return null;
    const before = entries.filter((item) => item.businessDate <= startBoundary).sort((a, b) => a.businessDate.localeCompare(b.businessDate)).at(-1);
    const endValue = finite(end?.[key]); const beforeValue = finite(before?.[key]);
    if (endValue === null || beforeValue === null) return null;
    found = true; total += endValue - beforeValue;
  }
  return found ? total : null;
}

function grouping(rows, key, direction = 'desc') {
  const groups = new Map();
  rows.forEach((row) => {
    if (!row.merchantId) return;
    const current = groups.get(row.merchantId) || { merchantId: row.merchantId, merchantName: row.merchantName, industry: row.industry, owner: row.owner, value: 0, available: false };
    const value = finite(row[key]);
    if (value !== null) { current.value += value; current.available = true; }
    groups.set(row.merchantId, current);
  });
  return [...groups.values()].filter((item) => item.available).sort((left, right) => direction === 'asc' ? left.value - right.value : right.value - left.value).slice(0, 20);
}

function growthRanking(rows, direction) {
  const groups = new Map();
  rows.filter((row) => row.sourceKind === 'daily_increment').forEach((row) => {
    if (!row.merchantId || finite(row.paymentGmv) === null) return;
    const group = groups.get(row.merchantId) || { merchantId: row.merchantId, merchantName: row.merchantName, industry: row.industry, owner: row.owner, points: [] };
    group.points.push(row); groups.set(row.merchantId, group);
  });
  return [...groups.values()].map((item) => {
    const points = item.points.sort((a, b) => a.businessDate.localeCompare(b.businessDate));
    return { ...item, value: finite(points.at(-1)?.paymentGmv) - finite(points[0]?.paymentGmv), available: points.length >= 2 };
  }).filter((item) => item.available).sort((a, b) => direction === 'asc' ? a.value - b.value : b.value - a.value).slice(0, 20);
}

function dailyTrend(rows, range, metricRisk) {
  return rangeDays(range.startDate, range.endDate).map((date) => {
    const daily = rows.filter((row) => row.businessDate === date && row.sourceKind === 'daily_increment');
    const exceptions = new Set(daily.filter((row) => row.exception).map((row) => row.merchantId).filter(Boolean));
    const payable = metricRisk ? null : sumMetric(daily, 'paymentGmv');
    const redeemed = metricRisk ? null : sumMetric(daily, 'redeemedGmv');
    return {
      date, paymentGmv: payable, redeemedGmv: redeemed, refundGmv: metricRisk ? null : sumMetric(daily, 'refundGmv'),
      redemptionRate: payable && redeemed !== null ? redeemed / payable : null,
      activeMerchants: daily.length ? daily.filter((row) => (finite(row.paymentGmv) || 0) > 0).length : null,
      exceptionMerchants: daily.length ? exceptions.size : null,
      videoPaymentGmv: metricRisk ? null : sumMetric(daily, 'videoPaymentGmv'), livePaymentGmv: metricRisk ? null : sumMetric(daily, 'livePaymentGmv'),
    };
  });
}

function snapshotTrend(rows, range) {
  const dates = [...new Set(rows
    .filter((row) => row.sourceKind === 'period_snapshot' && row.businessDate >= range.startDate && row.businessDate <= range.endDate)
    .map((row) => row.businessDate))].sort();
  return dates.map((date) => {
    const daily = rows.filter((row) => row.sourceKind === 'period_snapshot' && row.businessDate === date);
    const paymentGmv = sumMetric(daily, 'paymentGmv');
    const redeemedGmv = sumMetric(daily, 'redeemedGmv');
    return {
      date, paymentGmv, redeemedGmv, refundGmv: sumMetric(daily, 'refundGmv'),
      redemptionRate: paymentGmv && redeemedGmv !== null ? redeemedGmv / paymentGmv : null,
      activeMerchants: daily.length ? daily.filter((row) => (finite(row.paymentGmv) || 0) > 0).length : null,
      exceptionMerchants: daily.length ? new Set(daily.filter((row) => row.exception).map((row) => row.merchantId)).size : null,
      videoPaymentGmv: sumMetric(daily, 'videoPaymentGmv'), livePaymentGmv: sumMetric(daily, 'livePaymentGmv'),
    };
  });
}

export function buildWanjiaHistoryModel(history = null, options = {}) {
  const range = normalizeWanjiaRange(options.range || {}, { today: options.today });
  const filters = options.filters || {};
  const rawRows = Array.isArray(history?.rows) ? history.rows : history?.records;
  const allRows = Array.isArray(rawRows) ? rawRows.map(normalizeRow).filter((row) => row.businessDate && row.merchantId) : [];
  const availability = availabilityOf(history, allRows);
  const scoped = allRows.filter((row) => row.businessDate >= range.startDate && row.businessDate <= range.endDate)
    .filter((row) => !filters.merchantId || row.merchantId === filters.merchantId)
    .filter((row) => !filters.industry || filters.industry === 'all' || row.industry === filters.industry)
    .filter((row) => !filters.owner || filters.owner === 'all' || row.owner === filters.owner)
    .filter((row) => !filters.cooperationType || filters.cooperationType === 'all' || row.cooperationType === filters.cooperationType)
    .filter((row) => !filters.abnormal || filters.abnormal === 'all' || (filters.abnormal === 'yes' ? row.exception : !row.exception));
  const sourceKinds = new Set(scoped.map((row) => row.sourceKind));
  const metricRisk = sourceKinds.has('period_snapshot') || sourceKinds.has('unknown') ? '口径不可累计' : null;
  const incrementRows = scoped.filter((row) => row.sourceKind === 'daily_increment');
  const snapshotRows = allRows.filter((row) => row.sourceKind === 'period_snapshot');
  const currentRows = metricRisk ? [] : incrementRows;
  const paymentGmv = currentRows.length ? sumMetric(currentRows, 'paymentGmv') : snapshotsDelta(snapshotRows, 'paymentGmv', range);
  const redeemedGmv = currentRows.length ? sumMetric(currentRows, 'redeemedGmv') : snapshotsDelta(snapshotRows, 'redeemedGmv', range);
  const trend = dailyTrend(scoped, range, metricRisk);
  const snapshotDaily = snapshotTrend(scoped, range);
  const usableDays = trend.filter((item) => item.paymentGmv !== null).length;
  const snapshotRangeMissing = metricRisk && (paymentGmv === null || redeemedGmv === null);
  const rangeStatus = snapshotRangeMissing
    ? 'insufficient_history'
    : (history?.range?.status || 'ready');
  const insufficient = availability.state !== 'validated' || !scoped.length || snapshotRangeMissing || (!metricRisk && usableDays < Math.min(2, rangeDays(range.startDate, range.endDate).length));
  const message = availability.state !== 'validated' || !scoped.length
    ? '历史数据积累中：对应日期尚无已校验的本地历史数据。'
    : snapshotRangeMissing ? '历史数据已验证，但缺少起始日前最近可用快照（insufficient_history）；不显示区间变化值。'
      : metricRisk ? '历史数据已验证：当前源数据为周期快照，禁止直接求和；区间变化按结束日快照减开始日前最近快照计算。'
      : insufficient ? '历史数据积累中：数据天数不足，暂不生成趋势或环比结论。'
        : '历史数据已校验，所有指标按选定时间范围与字段口径计算。';
  return {
    range, filters, availability, metricRisk, rangeStatus, insufficient, message, trend, snapshotTrend: snapshotDaily, allRows,
    rangeSummary: {
      paymentGmv, redeemedGmv, refundGmv: currentRows.length ? sumMetric(currentRows, 'refundGmv') : snapshotsDelta(snapshotRows, 'refundGmv', range),
      redemptionRate: paymentGmv && redeemedGmv !== null ? redeemedGmv / paymentGmv : null,
      activeMerchants: currentRows.length ? new Set(currentRows.filter((row) => (finite(row.paymentGmv) || 0) > 0).map((row) => row.merchantId)).size : null,
      exceptionMerchants: currentRows.length ? new Set(currentRows.filter((row) => row.exception).map((row) => row.merchantId)).size : null,
    },
    rankings: {
      paymentGmv: metricRisk ? [] : grouping(currentRows, 'paymentGmv'), redeemedGmv: metricRisk ? [] : grouping(currentRows, 'redeemedGmv'),
      growth: metricRisk ? [] : growthRanking(currentRows, 'desc'), decline: metricRisk ? [] : growthRanking(currentRows, 'asc'),
      refund: metricRisk ? [] : grouping(currentRows, 'refundGmv'), lowRedemption: metricRisk ? [] : grouping(currentRows.filter((row) => finite(row.paymentGmv) > 0), 'redeemedGmv', 'asc'),
      video: metricRisk ? [] : grouping(currentRows, 'videoPaymentGmv'), live: metricRisk ? [] : grouping(currentRows, 'livePaymentGmv'),
    },
    rows: scoped,
  };
}
