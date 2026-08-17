import { buildWanjiaHistoryModel } from './wanjia-history.mjs?v=2.12.1';
import { buildWanjiaOpsNavigation } from './wanjia-ops-navigation.mjs?v=2.12.1';

const STATUS_LABELS = Object.freeze({
  realtime_validated: '实时已校验',
  pending_sync: '待同步',
  validation_failed: '校验失败',
  historical_snapshot: '历史快照',
});

const PREFERRED_TABLES = Object.freeze([
  '01.00 商家主档', '01.03 商家运营管理（团购运营）',
  '01.04.03｜林客商家当前经营状态', '01.04.04｜林客每日汇总',
  '01.04.05｜林客异常与待办', '04.03 任务管理',
  '04.08 月度运营进度', '04.09 账号运营项目管理',
]);

const KPI_CONFIG = Object.freeze([
  ['total_merchants', '商家总数', 'totalMerchants', 'number'],
  ['active_merchants', '动销商家数', 'activeMerchants', 'number'],
  ['today_payment_gmv', '今日支付 GMV', 'todayPaymentGmv', 'currency'],
  ['today_redeemed_gmv', '今日核销 GMV', 'todayRedeemedGmv', 'currency'],
  ['average_redemption_rate', '平均核销率', 'averageRedemptionRate', 'percent'],
  ['exception_merchants', '异常商家数', 'exceptionMerchants', 'number'],
  ['pending_exceptions', '待处理异常数', 'pendingExceptions', 'number'],
  ['completed_tasks_today', '今日完成任务数', 'completedTasksToday', 'number'],
]);

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'string' && value.trim() ? Number(value.replaceAll(',', '')) : Number(value);
  return Number.isFinite(number) ? number : null;
}

function yesNo(value) {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toLowerCase();
  if (['true', '1', '是', '有', '已动销', '已上团'].includes(text)) return true;
  if (['false', '0', '否', '无', '未动销', '未上团'].includes(text)) return false;
  return null;
}

function dateOnly(value) {
  const text = String(value || '');
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || null;
}

function displayMetric(value, format) {
  if (format === 'currency') return `¥${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)}`;
  if (format === 'percent') return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value * 100)}%`;
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
}

function rowsOf(source) {
  const rows = source?.records;
  if (Array.isArray(rows)) return rows;
  return Array.isArray(rows?.records) ? rows.records : [];
}

export function buildWanjiaDataStatus(source = null, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const declared = source?.dataStatus || {};
  const dataDate = dateOnly(declared.dataDate || source?.dataDate)
    || rowsOf(source).map((item) => dateOnly(item.dataDate || item.sourceUpdatedAt || item.updatedAt)).filter(Boolean).sort().at(-1)
    || null;
  const lastSyncedAt = declared.lastSyncedAt || source?.fetchedAt || source?.updatedAt || null;
  const explicitFailure = declared.state === 'validation_failed' || declared.validation === 'failed'
    || source?.state === 'error' || Boolean(source?.safeCode);
  let state = 'pending_sync';
  if (explicitFailure) state = 'validation_failed';
  else if (declared.state === 'realtime_validated' && declared.validation === 'passed' && dataDate === today) state = 'realtime_validated';
  else if (declared.state === 'realtime_validated' && declared.validation === 'passed') state = 'pending_sync';
  else if (declared.state === 'historical_snapshot' || source?.summary || rowsOf(source).length) state = dataDate === today && declared.validation === 'pending'
    ? 'pending_sync' : 'historical_snapshot';
  const message = {
    realtime_validated: '今日林客数据已校验，可用于运营参考。',
    pending_sync: '今日经营数据尚未完成同步与校验，暂不可作为实时经营结果。',
    validation_failed: '今日林客数据校验失败，请检查数据源、字段映射或同步日志。',
    historical_snapshot: '当前为历史林客快照，不代表今日实时经营结果。',
  }[state];
  return {
    state, label: STATUS_LABELS[state], message, dataDate, lastSyncedAt,
    sourceLabel: declared.sourceLabel || (state === 'historical_snapshot' ? '旧林客快照 / 历史月报' : '万嘉 ERP / 林客每日数据'),
    sourceTables: Array.isArray(declared.sourceTables) ? declared.sourceTables : [],
    missingPreferredTables: Array.isArray(declared.missingPreferredTables) ? declared.missingPreferredTables : [],
    preferredTables: [...PREFERRED_TABLES],
    trustworthy: state === 'realtime_validated',
  };
}

function normalizeMerchant(record = {}) {
  const paymentGmv = finite(record.todayPaymentGmv ?? record.paymentGmv);
  const redeemedGmv = finite(record.todayRedeemedGmv ?? record.redeemedGmv);
  const refundGmv = finite(record.todayRefundGmv ?? record.refundGmv);
  const redemptionRate = finite(record.redemptionRate)
    ?? (paymentGmv !== null && paymentGmv > 0 && redeemedGmv !== null ? redeemedGmv / paymentGmv : null);
  return {
    ...record,
    id: String(record.id || record.merchantId || ''),
    merchantId: String(record.merchantId || ''),
    merchantName: String(record.merchantName || record.name || '未知商家'),
    industry: String(record.industry || '待补充'),
    cooperationType: String(record.cooperationType || '待补充'),
    owner: String(record.owner || '未指定'),
    paymentGmv, redeemedGmv, refundGmv, redemptionRate,
    videoDirectPaymentGmv: finite(record.videoDirectPaymentGmv),
    livePaymentGmv: finite(record.livePaymentGmv),
    businessScore: finite(record.businessScore),
    isActive: yesNo(record.isActive), isListed: yesNo(record.isListed),
    hasVideo: yesNo(record.hasVideo ?? record.videoPublished),
    hasLive: yesNo(record.hasLive ?? record.livePublished),
    hasGroupbuyGmv: paymentGmv === null ? null : paymentGmv > 0,
    dataDate: dateOnly(record.dataDate || record.sourceUpdatedAt || record.updatedAt),
  };
}

function classifyMerchant(input) {
  const merchant = normalizeMerchant(input);
  const anomalies = [];
  let priority = null;
  const add = (level, label) => {
    anomalies.push(label);
    if (priority === null || Number(level.slice(1)) < Number(priority.slice(1))) priority = level;
  };
  if (merchant.syncFailed) add('P0', '数据同步失败');
  if (!merchant.merchantId) add('P0', '商家 ID 无法匹配');
  if (!merchant.dataDate || merchant.paymentGmv === null || merchant.redeemedGmv === null) add('P0', '数据缺失');
  if (merchant.paymentGmv === 0) add('P1', '零 GMV');
  if ((merchant.paymentGmv || 0) > 0 && merchant.redeemedGmv === 0) add('P1', '零核销');
  if ((merchant.paymentGmv || 0) > 0 && (merchant.refundGmv || 0) / merchant.paymentGmv >= 0.2) add('P1', '高退款');
  if (finite(merchant.gmvChangeRate) !== null && finite(merchant.gmvChangeRate) <= -0.3) add('P1', 'GMV 明显下降');
  if (merchant.hasVideo === false) add('P2', '视频弱');
  if (merchant.hasLive === false) add('P2', '直播弱');
  if (finite(merchant.packageConversionRate) !== null && finite(merchant.packageConversionRate) < 0.03) add('P2', '套餐/商品转化弱');
  if (finite(merchant.daysSinceLastAction) !== null && finite(merchant.daysSinceLastAction) >= 14) add('P2', '长期无执行动作');
  let healthStatus = '正常';
  if (priority === 'P0') healthStatus = '数据待核验';
  else if (priority === 'P1' || merchant.riskLevel === '高') healthStatus = '高风险';
  else if (priority === 'P2' || merchant.riskLevel === '中') healthStatus = '关注';
  return {
    ...merchant, priority, anomalyTypes: [...new Set(anomalies)], healthStatus,
    isAbnormal: Boolean(priority),
    suggestedAction: priority === 'P0' ? '先核对数据源、商家 ID 与字段完整性'
      : priority === 'P1' ? '按经营漏斗定位断点并安排负责人验证'
        : priority === 'P2' ? '建立内容、直播或商品优化实验' : '保持观察并复用有效动作',
  };
}

export function filterWanjiaMerchants(merchants = [], filters = {}) {
  const query = String(filters.query || '').trim().toLowerCase();
  const binary = (filter, value) => filter === 'all' || !filter || (filter === 'yes' ? value === true : value === false);
  return merchants.filter((item) => {
    if (query && ![item.merchantName, item.merchantId].some((value) => String(value || '').toLowerCase().includes(query))) return false;
    if (filters.industry && filters.industry !== 'all' && item.industry !== filters.industry) return false;
    if (filters.cooperationType && filters.cooperationType !== 'all' && item.cooperationType !== filters.cooperationType) return false;
    if (filters.owner && filters.owner !== 'all' && item.owner !== filters.owner) return false;
    if (filters.health && filters.health !== 'all' && item.healthStatus !== filters.health) return false;
    if (!binary(filters.abnormal, item.isAbnormal)) return false;
    if (!binary(filters.active, item.isActive)) return false;
    if (!binary(filters.live, item.hasLive)) return false;
    if (!binary(filters.video, item.hasVideo)) return false;
    if (!binary(filters.groupbuyGmv, item.hasGroupbuyGmv)) return false;
    return true;
  });
}

function sortMerchantsForKpi(merchants, sortKey) {
  const metric = {
    today_payment_gmv: 'paymentGmv',
    today_redeemed_gmv: 'redeemedGmv',
    average_redemption_rate: 'redemptionRate',
  }[sortKey];
  if (!metric) return merchants;
  return [...merchants].sort((left, right) => (finite(right[metric]) ?? -1) - (finite(left[metric]) ?? -1));
}

export function buildMerchantDiagnostic(input = {}) {
  const merchant = classifyMerchant(input);
  const missing = [];
  if (finite(input.exposure) === null) missing.push('曝光量');
  if (finite(input.clicks) === null) missing.push('点击量');
  if (merchant.paymentGmv === null) missing.push('支付成交');
  if (merchant.redeemedGmv === null) missing.push('到店核销');
  if (finite(input.repeatRate) === null) missing.push('复购/推荐');
  const hypotheses = [];
  if (merchant.paymentGmv === 0) hypotheses.push('成交结果为零，但需补齐曝光与点击数据后才能判断是流量、点击还是支付转化问题');
  if ((merchant.paymentGmv || 0) > 0 && merchant.redemptionRate !== null && merchant.redemptionRate < 0.3) hypotheses.push('支付后到店核销环节可能存在履约、有效期或到店承接问题');
  if (!hypotheses.length) hypotheses.push('现有数据不足以形成单一原因结论，先补齐漏斗证据再验证');
  return {
    问题: merchant.anomalyTypes.length ? merchant.anomalyTypes.join('、') : '当前未命中异常规则',
    数据证据: `支付 GMV ${merchant.paymentGmv ?? '待补'}；核销 GMV ${merchant.redeemedGmv ?? '待补'}；核销率 ${merchant.redemptionRate === null ? '待补' : displayMetric(merchant.redemptionRate, 'percent')}`,
    漏斗断点: `曝光 → 点击 → 支付成交 → 到店核销 → 复购/推荐；当前可确认：${missing.length ? `缺少 ${missing.join('、')}` : '五段数据已具备'}`,
    原因假设: hypotheses,
    建议动作: [merchant.suggestedAction, '只生成任务草案，确认后再进入正式执行'],
    执行优先级: merchant.priority || 'P2',
    建议负责人: merchant.owner || '待确认',
    预计验证周期: merchant.priority === 'P0' ? '1 个工作日' : '3–7 天',
    需要补充的数据: missing.length ? missing : ['下一周期对照结果'],
  };
}

function buildOpportunities(merchants) {
  const output = [];
  for (const item of merchants) {
    const add = (type, evidence, service, nextAction) => output.push({
      id: `${item.id}:${type}`, merchantId: item.id, merchantName: item.merchantName,
      type, evidence, service, nextAction, converted: Boolean(item.opportunityConverted), autoExecute: false,
    });
    if ((item.paymentGmv || 0) >= 5000 && item.redemptionRate !== null && item.redemptionRate < 0.3) {
      add('GMV 高但核销低', `支付 ${displayMetric(item.paymentGmv, 'currency')}，核销率 ${displayMetric(item.redemptionRate, 'percent')}`, '核销提升与到店承接', '核对券有效期、门店承接与到店提醒');
    }
    if (finite(item.videoViews) > 0 && (item.videoDirectPaymentGmv || 0) === 0) add('视频有播放但成交低', `播放 ${item.videoViews}，视频直接支付 GMV 为 0`, '短视频转化优化', '复盘素材、商品挂载与行动引导');
    if (finite(item.liveViewers) > 0 && (item.livePaymentGmv || 0) === 0) add('直播有在线但成交低', `在线 ${item.liveViewers}，直播支付 GMV 为 0`, '直播成交优化', '复盘货盘、话术与福利节奏');
    if (finite(item.productCount) !== null && finite(item.productCount) <= 1) add('商品数量少或套餐弱', `当前商品/套餐 ${item.productCount} 个`, '套餐与商品设计', '补充引流款、利润款或组合套餐');
    if (finite(item.gmvChangeRate) !== null && finite(item.gmvChangeRate) >= 0.2) add('连续增长、值得复制', `GMV 增长 ${displayMetric(item.gmvChangeRate, 'percent')}`, '增长动作复用', '沉淀动作并选择同类商家复制验证');
  }
  return output;
}

export function buildWanjiaOpsModel(source = null, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const filters = options.filters || {};
  const status = buildWanjiaDataStatus(source, { today });
  // Historical or unverified rows may be shown only as a dated reference.
  // They must never drive today's health, action or opportunity surfaces.
  const merchants = status.trustworthy
    ? rowsOf(source).filter((record) => dateOnly(record.dataDate || record.sourceUpdatedAt || record.updatedAt) === today).map(classifyMerchant)
    : [];
  const summary = source?.summary || {};
  const kpis = KPI_CONFIG.map(([key, label, field, format]) => {
    const value = status.trustworthy ? finite(summary[field]) : null;
    return { key, label, format, value, available: value !== null, display: value === null ? '待同步' : displayMetric(value, format) };
  });
  const legacy = status.state === 'historical_snapshot' ? {
    totalMerchants: finite(summary.totalMerchants), activeMerchants: finite(summary.activeMerchants),
    paymentGmv: finite(summary.paymentGmv), dataDate: status.dataDate,
  } : null;
  const filterOptions = {
    industries: [...new Set(merchants.map((item) => item.industry).filter(Boolean))].sort(),
    cooperationTypes: [...new Set(merchants.map((item) => item.cooperationType).filter(Boolean))].sort(),
    owners: [...new Set(merchants.map((item) => item.owner).filter(Boolean))].sort(),
  };
  const filteredMerchants = sortMerchantsForKpi(filterWanjiaMerchants(merchants, filters), filters.sort);
  const history = buildWanjiaHistoryModel(source?.history || source?.historical || null, {
    today, range: options.historyRange, filters: options.historyFilters,
  });
  return {
    navigation: buildWanjiaOpsNavigation(options.activePane),
    status, kpis, historicalReference: legacy,
    merchants, filteredMerchants, filters, filterOptions,
    history,
    urgentMerchants: merchants.filter((item) => item.priority).sort((a, b) => a.priority.localeCompare(b.priority)).slice(0, 12),
    opportunities: buildOpportunities(merchants),
  };
}

export const WANJIA_PREFERRED_TABLES = PREFERRED_TABLES;
