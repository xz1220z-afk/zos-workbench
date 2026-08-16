const ALLOWED_MODES = new Set(['intelligence', 'agent', 'command']);
const ALLOWED_SCOPES = new Set(['general', 'work', 'life', 'learning']);
const ALLOWED_INTERACTION_MODES = new Set(['text', 'quick_voice']);
const ALLOWED_COMMAND_SCOPES = new Set(['auto', 'wanjia', 'huahuo', 'lingli', 'life', 'knowledge', 'intelligence', 'agent']);
const ALLOWED_COMMAND_INTENTS = new Set(['general_assistant', 'business_query', 'knowledge_lookup', 'calendar_query', 'intelligence_query', 'agent_task']);
const ALLOWED_RISK_LEVELS = new Set(['L0', 'L1', 'L2']);
const PRIVATE_AGENT = /^REL-001$/i;

function boundedText(value, field, max, { required = false } = {}) {
  const text = String(value || '').trim();
  if (required && !text) throw new Error(`${field}_required`);
  if (text.length > max) throw new Error(`${field}_too_long`);
  return text;
}

function pick(value = {}, fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([field, max]) => [field, boundedText(value[field], field, max)]).filter(([, value]) => value));
}

export function normalizeAssistantRequest(input = {}) {
  const mode = String(input.mode || '').trim();
  if (!ALLOWED_MODES.has(mode)) throw new Error('assistant_mode_invalid');
  const question = boundedText(input.question, 'assistant_question', 1200, { required: true });
  if (mode === 'command') {
    const interactionMode = String(input.interactionMode || 'text').trim();
    if (!ALLOWED_INTERACTION_MODES.has(interactionMode)) throw new Error('assistant_interaction_mode_invalid');
    const page = pick(input.page, { route: 80, title: 160 });
    const agentId = boundedText(input.agentId, 'agent_id', 80);
    const command = pick(input.command, { scope: 32, intent: 48, riskLevel: 8 });
    command.scope ||= 'auto';
    command.intent ||= 'general_assistant';
    command.riskLevel ||= 'L0';
    if (!ALLOWED_COMMAND_SCOPES.has(command.scope)) throw new Error('assistant_scope_invalid');
    if (!ALLOWED_COMMAND_INTENTS.has(command.intent)) throw new Error('assistant_intent_invalid');
    if (!ALLOWED_RISK_LEVELS.has(command.riskLevel)) throw new Error('assistant_risk_level_invalid');
    return { mode, question, interactionMode, page, agentId, command };
  }
  if (mode === 'intelligence') {
    const intelligence = pick(input.intelligence, { externalId: 160, title: 280, sourceName: 160, factSummary: 1600, impactAnalysis: 1200, suggestedAction: 1200 });
    if (!intelligence.title && !intelligence.externalId) throw new Error('intelligence_context_required');
    return { mode, question, intelligence };
  }
  const agent = pick(input.agent, { agentId: 80, name: 160, status: 32, category: 40, mission: 1400, scopeIn: 1400, scopeOut: 1400, outputContract: 1000 });
  if (!agent.agentId) throw new Error('agent_context_required');
  if (PRIVATE_AGENT.test(agent.agentId) || String(input.agent?.confidentiality || '').toLowerCase() === 'private') throw new Error('private_agent_not_supported');
  agent.skillIds = Array.isArray(input.agent?.skillIds) ? input.agent.skillIds.map((id) => boundedText(id, 'skill_id', 80)).slice(0, 20) : [];
  agent.knowledgeEntries = Array.isArray(input.agent?.knowledgeEntries) ? input.agent.knowledgeEntries.map((entry) => boundedText(entry, 'knowledge_entry', 180)).slice(0, 12) : [];
  return { mode, question, agent };
}

function score(query, item) {
  const words = String(query || '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [];
  const haystack = [item.title, item.excerpt, ...(item.tags || [])].join(' ').toLowerCase();
  return words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
}

export function selectKnowledgeContext(question, rows = []) {
  return rows.filter((row) => ALLOWED_SCOPES.has(String(row.scope || '').toLowerCase()))
    .map((row) => ({ ...row, score: score(question, row) }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || String(right.updated_at || '').localeCompare(String(left.updated_at || '')))
    .slice(0, 6)
    .map((row) => ({ title: String(row.title || ''), sourceRef: String(row.source_ref || row.sourceRef || ''), scope: String(row.scope || ''), excerpt: String(row.excerpt || '').slice(0, 1000), tags: Array.isArray(row.tags) ? row.tags.slice(0, 12) : [] }));
}

export function buildAssistantInstructions(request, knowledge = []) {
  const entity = request.mode === 'intelligence' ? request.intelligence
    : request.mode === 'agent' ? request.agent
      : { page: request.page, agentId: request.agentId, command: request.command, interactionMode: request.interactionMode };
  const evidence = request.mode === 'intelligence'
    ? `情报卡：${JSON.stringify(entity)}`
    : request.mode === 'agent'
      ? `Agent 身份与边界：${JSON.stringify(entity)}`
      : `当前工作台上下文：${JSON.stringify(entity)}`;
  const context = knowledge.length ? knowledge.map((item, index) => `[知识 ${index + 1}] ${item.title} (${item.sourceRef})\n${item.excerpt}`).join('\n\n') : '无匹配的已授权知识摘要。';
  return `你是 ZOS CEO Operating System 的 C 级受控 AI 办公室助手。只使用以下已提供材料回答；用户专属事实不足时必须明确说明。允许查询、分析和生成可撤销草案；不得执行、承诺或假称完成任何写入、外发、付款、预约、发布、日历、删除或权限操作。高影响意图只能说明影响范围、精确变更、测试与回滚，并等待朱帅在界面确认。不得编造知识库内容。\n\n${evidence}\n\n已授权知识摘要：\n${context}\n\n用中文输出以下五节：直接解答、事实依据、推断与不确定、建议下一步、需要朱帅确认。`;
}
