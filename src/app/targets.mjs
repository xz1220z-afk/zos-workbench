export const METRIC_CATALOG = Object.freeze({
  'wanjia.paymentGmv': { source: 'wanjia', field: 'paymentGmv', label: '支付 GMV', unit: 'currency' },
  'wanjia.redeemedGmv': { source: 'wanjia', field: 'redeemedGmv', label: '核销 GMV', unit: 'currency' },
  'wanjia.activeMerchants': { source: 'wanjia', field: 'activeMerchants', label: '动销商家', unit: 'count' },
  'wanjia.videoPosts': { source: 'wanjia', field: 'videoPosts', label: '视频投稿', unit: 'count' },
  'wanjia.liveSessions': { source: 'wanjia', field: 'liveSessions', label: '直播场次', unit: 'count' },
  'wanjia.estimatedCommission': { source: 'wanjia', field: 'estimatedCommission', label: '预估佣金', unit: 'currency' },
  'huahuo.contractAmount': { source: 'huahuo', field: 'contractAmount', label: '合同金额', unit: 'currency' },
  'huahuo.receivedAmount': { source: 'huahuo', field: 'receivedAmount', label: '已回款', unit: 'currency' },
  'huahuo.outstandingAmount': { source: 'huahuo', field: 'outstandingAmount', label: '待回款', unit: 'currency' },
  'huahuo.activeProjects': { source: 'huahuo', field: 'activeProjects', label: '进行中项目', unit: 'count' },
  'huahuo.pendingDeliveries': { source: 'huahuo', field: 'pendingDeliveries', label: '待交付', unit: 'count' },
  'huahuo.lossRiskProjects': { source: 'huahuo', field: 'lossRiskProjects', label: '亏损风险项目', unit: 'count' },
  'lingli.received': { source: 'lingli', field: 'received', label: '玲丽本月实收', unit: 'currency' },
  'lingli.leads': { source: 'lingli', field: 'leads', label: '玲丽招生线索', unit: 'count' },
  'lingli.students': { source: 'lingli', field: 'students', label: '玲丽在读学员', unit: 'count' },
  'lingli.consumed': { source: 'lingli', field: 'consumed', label: '玲丽已消课时', unit: 'count' },
  'lingli.activeClasses': { source: 'lingli', field: 'activeClasses', label: '玲丽进行中班级', unit: 'count' },
});

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function requiredText(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${name} is required`);
  return text;
}

export function validateTarget(target = {}) {
  const metricKey = requiredText(target.metricKey, 'metricKey');
  if (!Object.hasOwn(METRIC_CATALOG, metricKey)) throw new Error(`unsupported metric: ${metricKey}`);
  if (target.confirmation !== 'confirmed') throw new Error('confirmed target required');
  const value = finiteNumber(target.value);
  if (value === null || value < 0) throw new Error('target value must be a non-negative number');

  const validated = { metricKey, value, confirmation: 'confirmed' };
  if (target.period != null) validated.period = requiredText(target.period, 'period');
  return validated;
}

export function actualMetrics(sources = {}) {
  const metrics = {};
  for (const [metricKey, definition] of Object.entries(METRIC_CATALOG)) {
    const source = sources[definition.source] || {};
    const summary = source.summary || source;
    metrics[metricKey] = {
      value: finiteNumber(summary?.[definition.field]),
      source: definition.source,
      sourceUpdatedAt: source.fetchedAt || source.updatedAt || null,
    };
  }
  return metrics;
}

export function calculateGap(target, actual) {
  const validatedActual = finiteNumber(actual);
  if (validatedActual === null) {
    return { actual: null, gap: null, completionRate: null, state: 'missing_actual' };
  }
  const targetValue = finiteNumber(target?.value);
  if (targetValue === null || targetValue < 0) throw new Error('target value must be a non-negative number');

  const gap = targetValue - validatedActual;
  const completionRate = targetValue === 0
    ? (validatedActual === 0 ? 1 : Number.POSITIVE_INFINITY)
    : validatedActual / targetValue;
  return {
    actual: validatedActual,
    gap,
    completionRate,
    state: gap > 0 ? 'behind' : gap < 0 ? 'ahead' : 'on_target',
  };
}

export function buildDailySnapshots(metrics = {}, options = {}) {
  const userId = requiredText(options.userId, 'userId');
  const date = requiredText(options.date, 'date');
  const contractVersion = requiredText(options.contractVersion || '1.3.0', 'contractVersion');

  return Object.entries(metrics)
    .filter(([metricKey, sample]) => Object.hasOwn(METRIC_CATALOG, metricKey) && finiteNumber(sample?.value) !== null)
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([metricKey, sample]) => ({
      id: `${userId}:${metricKey}:${date}`,
      metricKey,
      value: sample.value,
      source: METRIC_CATALOG[metricKey].source,
      sourceUpdatedAt: sample.sourceUpdatedAt || null,
      capturedOn: date,
      contractVersion,
    }));
}
