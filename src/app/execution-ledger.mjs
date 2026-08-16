const PRIVATE_AGENT_IDS = new Set(['REL-001']);

function text(value) {
  return String(value || '').trim();
}

function state(value) {
  const normalized = text(value).toLowerCase();
  if (['awaiting_approval', 'preview_required', 'pending_confirmation'].includes(normalized)) return 'awaiting_confirmation';
  if (['running', 'executing', 'answering', 'routing', 'analyzing'].includes(normalized)) return 'running';
  if (['completed', 'result_ready', 'answered'].includes(normalized)) return 'completed';
  if (['failed', 'error'].includes(normalized)) return 'failed';
  return 'draft';
}

function commandEntry(item = {}) {
  return {
    id: text(item.id), kind: 'ai_command', scope: text(item.scope) || 'auto', agentId: text(item.agentId),
    state: state(item.state), summary: item.intent ? `AI 命令 · ${text(item.intent)}` : 'AI 命令',
    riskLevel: text(item.riskLevel) || 'L0', at: text(item.updatedAt || item.createdAt),
  };
}

function agentEntry(item = {}, kind = 'agent_run') {
  const agentId = text(item.agentId).toUpperCase();
  const privateAgent = PRIVATE_AGENT_IDS.has(agentId) || item.privacy === 'private';
  return {
    id: text(item.id), kind, scope: '', agentId, state: state(item.status || item.phase),
    summary: privateAgent ? '私密任务' : text(item.objective || item.title) || 'Agent 任务',
    riskLevel: 'L0', at: text(item.updatedAt || item.completedAt || item.createdAt),
  };
}

function approvalEntry(item = {}) {
  return {
    id: text(item.approvalId || item.id), kind: 'approval', scope: text(item.scope), agentId: '',
    state: state(item.status || 'preview_required'), summary: text(item.target || item.summary) || '外部变更预览',
    riskLevel: 'L2', at: text(item.updatedAt || item.createdAt),
  };
}

export function buildExecutionLedger(input = {}, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 30, 100));
  return [
    ...(Array.isArray(input.commands) ? input.commands.map(commandEntry) : []),
    ...(Array.isArray(input.agentRuns) ? input.agentRuns.map((item) => agentEntry(item, 'agent_run')) : []),
    ...(Array.isArray(input.taskArchives) ? input.taskArchives.map((item) => agentEntry(item, 'agent_task')) : []),
    ...(Array.isArray(input.approvals) ? input.approvals.map(approvalEntry) : []),
  ]
    .filter((item) => item.id)
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, limit);
}
