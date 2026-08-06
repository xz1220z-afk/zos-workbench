export const AGENT_CATALOG = Object.freeze([
  { id: 'ceo-chief', name: 'CEO 总控 Agent', company: 'all', output: '经营建议与待决策清单' },
  { id: 'wanjia-growth', name: '万嘉增长 Agent', company: 'wanjia', output: '商家诊断与增长草案' },
  { id: 'huahuo-producer', name: '花火制片 Agent', company: 'huahuo', output: '拍摄交付与内容方案草案' },
  { id: 'lingli-ops', name: '玲丽运营 Agent', company: 'lingli', output: '招生与课程运营草案' },
  { id: 'knowledge-curator', name: '知识策展 Agent', company: 'all', output: '知识卡片与复利候选' },
  { id: 'personal-steward', name: '个人生活 Agent', company: 'personal', output: '日程与习惯建议' },
]);

const SAFE_ACTIONS = new Set(['draft', 'analyze', 'summarize', 'classify', 'recommend']);
const EXTERNAL_ACTIONS = new Set(['publish', 'message', 'erp_write', 'delete']);

export function agentActionPolicy(action, context = {}) {
  if (SAFE_ACTIONS.has(action)) return { allowed: true, requiresApproval: false, reason: 'draft_only' };
  if (EXTERNAL_ACTIONS.has(action)) {
    return context.approved
      ? { allowed: true, requiresApproval: true, reason: 'approved' }
      : { allowed: false, requiresApproval: true, reason: 'approval_required' };
  }
  return { allowed: false, requiresApproval: true, reason: 'unsupported_action' };
}

export function createAgentRun(input = {}) {
  if (!String(input.objective || '').trim()) throw new Error('objective_required');
  return {
    ...input,
    agentId: input.agentId || 'ceo-chief',
    objective: String(input.objective).trim(),
    inputRefs: Array.isArray(input.inputRefs) ? input.inputRefs.filter(Boolean) : [],
    status: input.status || 'draft',
    requestedActions: Array.isArray(input.requestedActions) ? input.requestedActions : ['draft'],
    outputSummary: input.outputSummary || '',
    approval: input.approval || null,
  };
}

export function summarizeAgentRuns(runs = []) {
  return runs.map(createAgentRun).reduce((summary, run) => {
    summary.total += 1;
    if (run.status === 'awaiting_approval') summary.awaitingApproval += 1;
    if (run.status === 'completed') summary.completed += 1;
    if (run.status === 'failed') summary.failed += 1;
    return summary;
  }, { total: 0, awaitingApproval: 0, completed: 0, failed: 0 });
}
