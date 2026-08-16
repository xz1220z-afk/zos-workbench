function text(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function optional(value) {
  const normalized = text(value);
  return normalized || null;
}

function dayDifference(date, dueDate) {
  if (!dueDate) return null;
  const current = new Date(`${String(date).slice(0, 10)}T00:00:00.000Z`);
  const due = new Date(`${String(dueDate).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(due.getTime())) return null;
  return Math.round((due.getTime() - current.getTime()) / 86_400_000);
}

function candidate(fields) {
  return {
    id: `${fields.sourceType}:${fields.sourceId}`,
    title: text(fields.title),
    sourceType: fields.sourceType,
    sourceId: text(fields.sourceId),
    owner: optional(fields.owner),
    dueAt: optional(fields.dueAt),
    reason: text(fields.reason),
    recommendedAction: optional(fields.recommendedAction),
    sourceUpdatedAt: optional(fields.sourceUpdatedAt),
    score: fields.score,
  };
}

function taskCandidates(tasks, date) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter((item) => item && item.status !== 'done' && text(item.id) && text(item.title))
    .map((item) => {
      const days = dayDifference(date, item.dueDate || item.dueAt);
      const priority = Number.isFinite(item.priority) ? item.priority : 0;
      let score = 40 + priority;
      let reason = priority > 0 ? `任务优先级 ${priority}` : '待推进任务';
      if (days !== null && days < 0) {
        score = 110 + Math.min(20, Math.abs(days));
        reason = `已逾期 ${Math.abs(days)} 天`;
      } else if (days === 0) {
        score = 100 + priority;
        reason = '今天到期';
      } else if (days === 1) {
        score = 75 + priority;
        reason = '明天到期';
      }
      return candidate({
        sourceType: 'task', sourceId: item.id, title: item.title, score, reason,
        owner: item.owner, dueAt: item.dueDate || item.dueAt,
        recommendedAction: item.recommendedAction || '完成任务并更新状态',
        sourceUpdatedAt: item.updatedAt,
      });
    });
}

function riskCandidates(risks) {
  return (Array.isArray(risks) ? risks : [])
    .filter((item) => item && text(item.id) && text(item.title || item.factSummary))
    .map((item) => {
      const high = item.severity === 'high';
      const type = text(item.type).toLowerCase();
      const businessLabel = /cash|payment|回款|收款/.test(type) ? '回款'
        : /delivery|交付/.test(type) ? '交付' : '经营';
      return candidate({
        sourceType: 'risk', sourceId: item.id, title: item.title || item.factSummary,
        score: high ? 86 : item.severity === 'medium' ? 68 : 55,
        reason: `${high ? '高风险' : '风险'} · ${businessLabel}`,
        owner: item.owner, dueAt: item.dueAt || item.dueDate,
        recommendedAction: item.recommendedAction || '核对风险事实并确定下一步',
        sourceUpdatedAt: item.updatedAt,
      });
    });
}

function decisionCandidates(decisions) {
  return partitionDecisions(decisions).ceo
    .filter((item) => item && text(item.id) && text(item.factSummary || item.title))
    .map((item) => candidate({
      sourceType: 'decision', sourceId: item.id, title: item.factSummary || item.title,
      score: item.severity === 'high' ? 84 : item.severity === 'medium' ? 64 : 52,
      reason: `${item.severity === 'high' ? '高优先级' : '待确认'}经营决策`,
      owner: item.owner, dueAt: item.dueAt || item.dueDate,
      recommendedAction: item.recommendedAction || '核对事实后决定',
      sourceUpdatedAt: item.updatedAt,
    }));
}

function conflictCandidates(conflicts) {
  return (Array.isArray(conflicts) ? conflicts : [])
    .filter((item) => item && text(item.id) && text(item.title))
    .map((item) => candidate({
      sourceType: 'calendar_conflict', sourceId: item.id, title: item.title,
      score: 72, reason: '日历时间冲突', owner: item.owner,
      dueAt: item.startAt, recommendedAction: '调整其中一个日程并通知相关人',
      sourceUpdatedAt: item.updatedAt,
    }));
}

function intelligenceCandidates(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && text(item.externalId || item.id) && text(item.title) && Number(item.score) >= 80)
    .map((item) => candidate({
      sourceType: 'intelligence', sourceId: item.externalId || item.id, title: item.title,
      score: 50 + Math.min(20, Math.max(0, Number(item.score) - 80)),
      reason: `高相关行业情报 · ${Number(item.score)} 分`,
      recommendedAction: '判断是否影响当前经营或内容计划',
      sourceUpdatedAt: item.updatedAt || item.publishedAt,
    }));
}

export function buildTodayTop3(input = {}, options = {}) {
  const date = text(options.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  const candidates = [
    ...taskCandidates(input.tasks, date),
    ...riskCandidates(input.risks),
    ...decisionCandidates(input.decisions),
    ...conflictCandidates(input.calendarConflicts),
    ...intelligenceCandidates(input.intelligence),
  ].filter((item) => item.title && item.sourceId)
    .sort((left, right) => right.score - left.score
      || left.title.localeCompare(right.title, 'zh-CN')
      || left.id.localeCompare(right.id, 'zh-CN'));

  const seen = new Set();
  return candidates.filter((item) => {
    const key = item.title.toLocaleLowerCase('zh-CN');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3).map(({ score, ...item }) => item);
}
import { partitionDecisions } from './decision-center.mjs?v=2.12.0';
