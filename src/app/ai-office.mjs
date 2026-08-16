const ORGANIZATION_LABELS = Object.freeze({
  shared: '总控与共享中台',
  wanjia: '万嘉网络',
  huahuo: '花火影像',
  lingli: '玲丽教育',
  life: '我的生活',
});

const ORGANIZATION_ORDER = Object.freeze(['shared', 'wanjia', 'huahuo', 'lingli', 'life']);
const PRIVATE_AGENT_IDS = new Set(['REL-001']);

function text(value) {
  return String(value || '').trim();
}

function timestamp(record = {}) {
  record = record || {};
  return text(record.updatedAt || record.completedAt || record.submittedAt || record.createdAt);
}

function normalizeOfficeState(record = {}) {
  record = record || {};
  const state = text(record.status || record.phase).toLowerCase();
  if (['failed', 'error'].includes(state)) return 'failed';
  if (['awaiting_approval', 'preview_required', 'pending_confirmation'].includes(state)) return 'awaiting_confirmation';
  if (['running', 'executing', 'answering', 'routing', 'analyzing'].includes(state)) return 'running';
  if (['completed', 'result_ready', 'answered'].includes(state)) return 'completed';
  if (['draft', 'planned', 'queued'].includes(state)) return 'draft';
  return 'idle';
}

function latestWork(agentId, agentRuns = [], taskArchives = []) {
  return [...agentRuns, ...taskArchives]
    .filter((record) => text(record.agentId).toUpperCase() === agentId)
    .sort((left, right) => timestamp(right).localeCompare(timestamp(left)))[0] || null;
}

function officeAgent(agent = {}, input = {}) {
  const agentId = text(agent.agentId || agent.id).toUpperCase();
  const current = latestWork(agentId, input.agentRuns, input.taskArchives);
  const privateAgent = PRIVATE_AGENT_IDS.has(agentId) || agent.privacy === 'private';
  return {
    agentId,
    name: text(agent.name) || agentId,
    organization: text(agent.category || agent.organization) || 'shared',
    department: text(agent.department || agent.sections?.department) || '未分部门',
    identityStatus: text(agent.status) || 'draft',
    officeState: normalizeOfficeState(current),
    currentTask: current ? (privateAgent ? '私密任务' : text(current.objective || current.title) || '任务摘要待补充') : '',
    updatedAt: timestamp(current) || text(agent.updatedAt || agent.mtime),
    private: privateAgent,
  };
}

function summarize(agents = []) {
  const summary = { total: agents.length, idle: 0, draft: 0, awaitingConfirmation: 0, running: 0, completed: 0, failed: 0 };
  for (const agent of agents) {
    if (agent.officeState === 'awaiting_confirmation') summary.awaitingConfirmation += 1;
    else if (Object.hasOwn(summary, agent.officeState)) summary[agent.officeState] += 1;
  }
  return summary;
}

function groupOrganizations(agents = []) {
  const groups = new Map();
  for (const agent of agents) {
    if (!groups.has(agent.organization)) groups.set(agent.organization, new Map());
    const departments = groups.get(agent.organization);
    if (!departments.has(agent.department)) departments.set(agent.department, []);
    departments.get(agent.department).push(agent);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => {
      const leftIndex = ORGANIZATION_ORDER.indexOf(left);
      const rightIndex = ORGANIZATION_ORDER.indexOf(right);
      return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex) || left.localeCompare(right);
    })
    .map(([id, departments]) => ({
      id,
      name: ORGANIZATION_LABELS[id] || id,
      departments: [...departments.entries()].map(([name, members]) => ({ name, agents: members })),
    }));
}

export function buildAiOffice(input = {}) {
  const sourceAgents = Array.isArray(input.agents) ? input.agents : [];
  const context = {
    agentRuns: Array.isArray(input.agentRuns) ? input.agentRuns : [],
    taskArchives: Array.isArray(input.taskArchives) ? input.taskArchives : [],
  };
  const agents = sourceAgents.map((agent) => officeAgent(agent, context)).filter((agent) => agent.agentId);
  return { summary: summarize(agents), organizations: groupOrganizations(agents), agents };
}
