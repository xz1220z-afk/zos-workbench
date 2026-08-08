const VALID_STATUSES = new Set(['draft', 'pilot', 'active', 'deprecated']);
const CATEGORY_ORDER = Object.freeze(['shared', 'wanjia', 'huahuo', 'lingli', 'life']);

export const AGENT_OS_CATEGORIES = Object.freeze({
  shared: '总控与共享中台', wanjia: '万嘉网络', huahuo: '花火影像', lingli: '玲丽教育', life: '我的生活',
});

function normalizedAgentId(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizedConfidentiality(value) {
  return String(value || 'internal').trim().toLowerCase();
}

function parsedCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (/万嘉|wanjia/.test(normalized)) return 'wanjia';
  if (/花火|huahuo/.test(normalized)) return 'huahuo';
  if (/玲丽|lingli/.test(normalized)) return 'lingli';
  if (/个人|生活|关系|健康|学习|life|personal/.test(normalized)) return 'life';
  if (/共享|总控|中台|shared|common|ceo/.test(normalized)) return 'shared';
  return null;
}

function isPrivateAgent(agent = {}) {
  return normalizedAgentId(agent.agentId) === 'REL-001'
    || normalizedConfidentiality(agent.confidentiality) === 'private';
}

function categoryFor(agent = {}) {
  const explicitValues = [agent.category, agent.company, agent.domain, agent.business]
    .map(parsedCategory).filter(Boolean);
  if (explicitValues[0]) return explicitValues[0];
  const name = String(agent.name || '').trim().toLowerCase();
  const nameCategory = name && name !== normalizedAgentId(agent.agentId).toLowerCase() ? parsedCategory(name) : null;
  if (nameCategory) return nameCategory;
  const id = normalizedAgentId(agent.agentId);
  if (/^(WANJIA|WJ-)/.test(id)) return 'wanjia';
  if (/^(HUAHUO|HH-)/.test(id)) return 'huahuo';
  if (/^LL-/.test(id)) return 'lingli';
  if (/^(LIFE-|HEALTH-|REL-|LEARN-)/.test(id)) return 'life';
  return 'shared';
}

function normalizedStatus(value) {
  return VALID_STATUSES.has(value) ? value : 'draft';
}

function enrich(agent = {}) {
  return {
    ...agent,
    agentId: normalizedAgentId(agent.agentId),
    confidentiality: normalizedConfidentiality(agent.confidentiality),
    status: normalizedStatus(String(agent.status || '').trim().toLowerCase()),
    category: categoryFor(agent),
  };
}

function latestPilot(index = {}, agent = {}) {
  const logIds = new Set(agent.logIds || []);
  const evidenceIds = new Set(agent.evidenceIds || []);
  const related = [
    ...(index.logs || []).filter((item) => logIds.has(item.logId) || item.agentIds?.includes(agent.agentId)),
    ...(index.evaluations || []).filter((item) => evidenceIds.has(item.evaluationId) || item.agentIds?.includes(agent.agentId)),
  ].sort((left, right) => String(right.updatedAt || right.mtime || '').localeCompare(String(left.updatedAt || left.mtime || '')));
  const latest = related[0];
  return latest ? {
    status: latest.status || 'evidence',
    name: latest.name || latest.logId || latest.evaluationId || 'Pilot 证据',
    updatedAt: latest.updatedAt || latest.mtime || null,
  } : null;
}

export function visibleAgents(index = {}, filter = 'all') {
  const agents = (index.agents || []).map((agent) => ({ ...enrich(agent), recentPilot: latestPilot(index, agent) }));
  if (filter === 'private-relations') return agents.filter((agent) => agent.category === 'life' && isPrivateAgent(agent));
  if (filter === 'life') return agents.filter((agent) => agent.category === 'life' && !isPrivateAgent(agent));
  if (filter === 'all') return agents.filter((agent) => !isPrivateAgent(agent));
  return agents.filter((agent) => agent.category === filter && !isPrivateAgent(agent));
}

function relationRecords(index, agent, key) {
  const values = new Set(agent[key] || []);
  return (index[key === 'skillIds' ? 'skills' : key === 'workflowIds' ? 'workflows' : []] || [])
    .filter((item) => values.has(item.skillId || item.workflowId));
}

export function buildAgentOsOverview(index = {}) {
  const agents = (index.agents || []).map(enrich);
  const categories = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, agents.filter((agent) => agent.category === category)]));
  const status = Object.fromEntries([...VALID_STATUSES].map((name) => [name, agents.filter((agent) => agent.status === name).length]));
  return {
    generatedAt: index.generatedAt || null,
    categories,
    summary: { total: agents.length, status },
  };
}

export function agentDetails(index = {}, agentId) {
  const agent = (index.agents || []).map(enrich).find((item) => item.agentId === agentId);
  if (!agent) return null;
  return {
    ...agent,
    skills: relationRecords(index, agent, 'skillIds'),
    workflows: relationRecords(index, agent, 'workflowIds'),
    evaluations: (index.evaluations || []).filter((item) => item.agentIds?.includes(agentId) || agent.evidenceIds?.includes(item.evaluationId)),
    logs: (index.logs || []).filter((item) => item.agentIds?.includes(agentId) || agent.logIds?.includes(item.logId)),
    runbooks: (index.runbooks || []).filter((item) => item.agentIds?.includes(agentId) || agent.runbookIds?.includes(item.runbookId)),
  };
}

export function buildAgentInvocationDraft(agent = {}, options = {}) {
  const normalizedAgent = enrich(agent);
  const category = normalizedAgent.category;
  const company = { shared: 'ceo', wanjia: 'wanjia', huahuo: 'huahuo', lingli: 'lingli', life: 'life' }[category];
  const requiredOutput = '事实、推断、建议、待确认、下一步。';
  const output = normalizedAgent.sections?.outputContract || requiredOutput;
  const boundaries = normalizedAgent.sections?.forbiddenActions || normalizedAgent.sections?.scopeOut || '不执行任何外部动作。';
  const localOnly = isPrivateAgent(normalizedAgent);
  return {
    title: `调用 ${normalizedAgent.name || normalizedAgent.agentId}：`,
    description: `请补充具体任务。\n\n固定输出：${requiredOutput}\nAgent 专属格式：${output}\n边界：${boundaries}\n模式：只读分析或草稿，不自动写入、外发或执行。`,
    company,
    status: 'todo',
    tags: ['Agent OS', normalizedAgent.agentId, '草稿'],
    agentContext: {
      agentId: normalizedAgent.agentId,
      agentName: normalizedAgent.name || normalizedAgent.agentId,
      agentStatus: normalizedAgent.status,
      category,
      identityPath: normalizedAgent.relativePath,
      identityHash: normalizedAgent.hash,
      mission: normalizedAgent.sections?.mission || '',
      scopeIn: normalizedAgent.sections?.scopeIn || normalizedAgent.sections?.allowedActions || '',
      scopeOut: normalizedAgent.sections?.scopeOut || '',
      forbiddenActions: normalizedAgent.sections?.forbiddenActions || boundaries,
      skillIds: normalizedAgent.skillIds || [],
      workflowIds: normalizedAgent.workflowIds || [],
      evidenceIds: normalizedAgent.evidenceIds || [],
      logIds: normalizedAgent.logIds || [],
      runbookIds: normalizedAgent.runbookIds || [],
      knowledgeEntries: normalizedAgent.knowledgeEntries || [],
      outputContract: output,
      mode: 'draft_or_readonly_analysis',
      confidentiality: normalizedAgent.confidentiality,
      localOnly,
      preparedAt: options.now || new Date().toISOString(),
    },
  };
}

export function buildAgentAnalysisRequest(agent = {}, question) {
  const normalizedAgent = enrich(agent);
  const asked = String(question || '').trim();
  if (!asked) throw new Error('agent_question_required');
  if (isPrivateAgent(normalizedAgent)) throw new Error('private_agent_local_only');
  return {
    mode: 'agent', question: asked,
    agent: {
      agentId: normalizedAgent.agentId, name: normalizedAgent.name || normalizedAgent.agentId,
      status: normalizedAgent.status, category: normalizedAgent.category,
      mission: normalizedAgent.sections?.mission || '', scopeIn: normalizedAgent.sections?.scopeIn || normalizedAgent.sections?.allowedActions || '',
      scopeOut: normalizedAgent.sections?.scopeOut || normalizedAgent.sections?.forbiddenActions || '',
      skillIds: normalizedAgent.skillIds || [], knowledgeEntries: normalizedAgent.knowledgeEntries || [],
      outputContract: normalizedAgent.sections?.outputContract || '事实、推断、建议、待确认、下一步。',
      confidentiality: normalizedAgent.confidentiality,
    },
  };
}

export function buildRelationReminderDrafts(options = {}) {
  const createdAt = options.now || new Date().toISOString();
  return [
    { kind: 'daily-care', title: '今天是否有一件具体关怀动作？' },
    { kind: 'weekly-review', title: '她本周最在意什么？我有没有认真回应？' },
    { kind: 'important-date', title: '重要日期提醒：提前 7 天、3 天、当天。' },
  ].map((item) => ({ ...item, agentId: 'REL-001', createdAt, delivery: 'local_draft', autoSend: false }));
}

function agentMap(index = {}) {
  return new Map((index.agents || []).map((agent) => [agent.agentId, agent]));
}

function hasEvidence(agent = {}) {
  return Boolean(agent.skillIds?.length && agent.workflowIds?.length && (agent.evidenceIds?.length || agent.logIds?.length));
}

export function compareAgentOsIndexes(previous = null, current = {}) {
  const before = agentMap(previous || {});
  const after = agentMap(current);
  const added = [...after.keys()].filter((id) => !before.has(id)).sort();
  const missing = [...before.keys()].filter((id) => !after.has(id)).sort();
  const modified = [...after.keys()].filter((id) => before.has(id) && before.get(id).hash !== after.get(id).hash).sort();
  const deprecated = [...after.values()].filter((agent) => agent.status === 'deprecated').map((agent) => agent.agentId).sort();
  const risks = [...after.values()].filter((agent) => !hasEvidence(agent)).map((agent) => ({
    agentId: agent.agentId,
    missing: [!agent.skillIds?.length && 'Skill', !agent.workflowIds?.length && 'Workflow', !(agent.evidenceIds?.length || agent.logIds?.length) && 'Pilot 证据'].filter(Boolean),
  }));
  const changed = added.length || missing.length || modified.length || deprecated.length;
  return {
    added, missing, modified, deprecated, risks,
    message: changed ? `发现 ${added.length + missing.length + modified.length + deprecated.length} 项结构变化。` : 'Agent OS 无结构变化。',
  };
}
