// ZOS risk detector — pure, deterministic, read-only
//
// Reads ONLY already-normalized metadata records (wanjia / huahuo / project)
// and derives risk reasons. It never mutates the source records, never writes
// to any database, and never contacts Feishu / ERP.
//
// `asOf` is injectable so tests are deterministic.

import { WANJIA_DONE_STAGES } from './wanjia-data.mjs?v=2.11.0';
import { HUAHUO_DONE_STAGES } from './huahuo-data.mjs?v=2.11.0';

export const DEFAULT_STALE_DAYS = 7;
export const DEFAULT_STUCK_DAYS = 14;

const DONE_STAGES = {
  wanjia: WANJIA_DONE_STAGES,
  huahuo: HUAHUO_DONE_STAGES,
  project: ['已完成'],
};

// Whole days between an ISO date and a reference instant.
export function daysSince(isoDate, asOf = new Date()) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return Infinity;
  const ms = new Date(asOf).getTime() - d.getTime();
  return Math.floor(ms / 86400000);
}

// A record is "done" when its stage/status is a terminal state.
export function isDone(record, kind) {
  const done = DONE_STAGES[kind] || [];
  const stage = record.stage || record.status || '';
  return done.includes(stage);
}

// Rule 3: there is an unfinished action / delivery / pending task.
export function hasUnfinished(record, kind) {
  if (kind === 'wanjia') return !!(record.nextAction && !/^(无|完成|结束|暂无)/.test(String(record.nextAction).trim()));
  if (kind === 'huahuo') {
    return record.deliveryStatus === '待交付' || record.deliveryStatus === '交付中' || record.revenueStatus === '待回款';
  }
  if (kind === 'project') return ['进行中', '已延期', '风险'].includes(record.status);
  return false;
}

// Built-in high-risk markers carried by the source record.
export function isHighRisk(record, kind) {
  if (kind === 'wanjia') return record.riskLevel === '高';
  if (kind === 'huahuo') return record.profitStatus === '亏损' || record.riskLevel === '高';
  if (kind === 'project') return record.riskLevel === '高' || record.status === '风险' || record.status === '已延期';
  return false;
}

// Receivables still pending.
export function isRevenuePending(record, kind) {
  if (kind === 'wanjia') return record.revenueStatus === '待收款';
  if (kind === 'huahuo') return record.revenueStatus === '待回款';
  return false;
}

export function riskLevelFromReasons(reasons) {
  if (!reasons || reasons.length === 0) return '低';
  if (reasons.some((r) => r.severity === 'high')) return '高';
  if (reasons.some((r) => r.severity === 'medium')) return '中';
  return '低';
}

// Detect risks across a list of normalized records.
// options: { asOf, staleDays, stuckDays }
export function detectRisks(records = [], kind, options = {}) {
  if (!Array.isArray(records)) throw new Error('records must be an array');
  if (!['wanjia', 'huahuo', 'project'].includes(kind)) throw new Error('kind must be wanjia|huahuo|project');
  const { asOf = new Date(), staleDays = DEFAULT_STALE_DAYS, stuckDays = DEFAULT_STUCK_DAYS } = options;

  return records
    .filter((r) => !isDone(r, kind))
    .map((r) => {
      const reasons = [];
      const hasUsableTimestamp = typeof r.updatedAt === 'string'
        && r.updatedAt.trim() !== ''
        && !Number.isNaN(new Date(r.updatedAt).getTime());
      const since = hasUsableTimestamp ? daysSince(r.updatedAt, asOf) : null;

      // Rule 1 + 2: no update for > staleDays, and stage has stalled.
      if (since != null && since > staleDays) {
        reasons.push({
          code: 'stale',
          label: `超过 ${staleDays} 天未更新（已停滞 ${since} 天）`,
          severity: since > stuckDays ? 'high' : 'medium',
        });
      }
      if (since != null && since > stuckDays) {
        reasons.push({
          code: 'stuck',
          label: `状态「${r.stage || r.status || '未知'}」停留超过 ${stuckDays} 天`,
          severity: 'medium',
        });
      }
      // Rule 3: unfinished work remains.
      if (hasUnfinished(r, kind)) {
        reasons.push({ code: 'unfinished', label: '存在未完成动作 / 交付 / 任务', severity: 'medium' });
      }
      // Built-in high-risk marker.
      if (isHighRisk(r, kind)) {
        reasons.push({ code: 'high_risk', label: '内置高风险标记', severity: 'high' });
      }
      // Pending receivables.
      if (isRevenuePending(r, kind)) {
        reasons.push({ code: 'revenue_pending', label: '回款 / 收款待处理', severity: 'medium' });
      }

      if (reasons.length === 0) return null;
      const name = r.merchantName || r.projectName || r.name || String(r.id);
      return {
        recordId: String(r.id),
        name,
        kind,
        stage: r.stage || r.status || '',
        owner: r.owner || '',
        level: riskLevelFromReasons(reasons),
        reasons,
      };
    })
    .filter(Boolean)
    .sort((a, b) => ({ 高: 0, 中: 1, 低: 2 }[a.level] - { 高: 0, 中: 1, 低: 2 }[b.level]));
}

// Convenience: split a risk list into the three Risk-Center buckets.
export function bucketRisks(risks = []) {
  const high = risks.filter((r) => r.level === '高' || r.reasons.some((x) => x.code === 'high_risk'));
  const delayed = risks.filter((r) => r.reasons.some((x) => x.code === 'stale' || x.code === 'stuck'));
  const followUp = risks.filter((r) => r.reasons.some((x) => x.code === 'unfinished' || x.code === 'revenue_pending'));
  // De-duplicate by recordId within each bucket while keeping the highest-severity entry.
  const uniq = (arr) => Array.from(new Map(arr.map((r) => [r.recordId, r])).values());
  return { high: uniq(high), delayed: uniq(delayed), followUp: uniq(followUp) };
}
