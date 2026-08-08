const FORBIDDEN_KEYS = new Set([
  'body', 'content', 'chat', 'location', 'password', 'medical', 'finance',
  'rawbody', 'rawcontent', 'privatechat', 'token', 'secret',
]);

const MAX_TEXT = 800;

function text(value, fallback = '') {
  return String(value ?? fallback).trim().slice(0, MAX_TEXT);
}

function nowFrom(options = {}) {
  return options.now || new Date().toISOString();
}

function assertNoForbiddenFields(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(String(key).replace(/[_-]/g, '').toLowerCase())) {
      throw new Error('agent_context_field_forbidden');
    }
    if (nested && typeof nested === 'object') assertNoForbiddenFields(nested);
  }
}

function rules(input = {}) {
  assertNoForbiddenFields(input);
  return {
    outputContract: text(input.outputContract),
    scopeIn: text(input.scopeIn),
    scopeOut: text(input.scopeOut),
    forbiddenActions: text(input.forbiddenActions),
    knowledgeEntryLabels: Array.isArray(input.knowledgeEntryLabels)
      ? input.knowledgeEntryLabels.map((item) => text(item)).filter(Boolean).slice(0, 12)
      : [],
  };
}

function referenceLabels(values) {
  return Array.isArray(values) ? values.map((item) => text(item)).filter(Boolean).slice(0, 20) : [];
}

function optionalId(value) {
  const id = text(value);
  return id ? { id } : {};
}

export function agentRuntimeAvailability(agent = {}, { aiReady = false } = {}) {
  const status = String(agent.status || 'draft').trim().toLowerCase();
  if (status === 'deprecated') return 'can_draft';
  if (status === 'pilot') return aiReady ? 'pilot_limited' : 'can_draft';
  return aiReady && status === 'active' ? 'can_analyze' : 'can_draft';
}

export function createAgentTaskArchive(input = {}) {
  assertNoForbiddenFields(input);
  const agentId = text(input.agentId).toUpperCase();
  const objective = text(input.objective);
  if (!agentId) throw new Error('agent_id_required');
  if (!objective) throw new Error('agent_objective_required');
  const privacy = text(input.privacy, 'internal').toLowerCase() === 'private' ? 'private' : 'internal';
  return {
    ...optionalId(input.id), agentId, taskId: text(input.taskId) || null, objective,
    phase: 'draft', privacy, inputRefs: referenceLabels(input.inputRefs),
    agentRules: rules(input.agentRules), result: null, contextCandidateId: null,
    createdAt: nowFrom(input), updatedAt: nowFrom(input),
  };
}

export function completeAgentTaskArchive(archive = {}, result = {}, options = {}) {
  assertNoForbiddenFields(result);
  if (!archive?.agentId || !archive?.objective) throw new Error('agent_archive_required');
  const factSummary = text(result.factSummary);
  const inferenceSummary = text(result.inferenceSummary);
  const recommendationSummary = text(result.recommendationSummary);
  if (!factSummary && !inferenceSummary && !recommendationSummary) throw new Error('agent_result_summary_required');
  return {
    ...archive,
    phase: 'result_ready',
    result: { factSummary, inferenceSummary, recommendationSummary, sourceLabels: referenceLabels(result.sourceLabels) },
    updatedAt: nowFrom(options),
  };
}

export function createContextCandidate(archive = {}, options = {}) {
  if (archive?.phase !== 'result_ready' || !archive.result) throw new Error('agent_archive_not_completed');
  const summary = [archive.result.factSummary, archive.result.recommendationSummary].filter(Boolean).join('；');
  if (!summary) throw new Error('agent_result_summary_required');
  return {
    ...optionalId(options.id), archiveId: text(archive.id) || null, agentId: text(archive.agentId).toUpperCase(),
    privacy: archive.privacy === 'private' ? 'private' : 'internal', summary: text(summary),
    sourceLabels: referenceLabels([...(archive.inputRefs || []), ...(archive.result.sourceLabels || [])]),
    status: 'pending_confirmation', createdAt: nowFrom(options), updatedAt: nowFrom(options), confirmedAt: null,
  };
}

export function confirmContextCandidate(candidate = {}, patch = {}, options = {}) {
  if (candidate?.status !== 'pending_confirmation') throw new Error('agent_context_confirmation_required');
  assertNoForbiddenFields(patch);
  const summary = text(patch.summary || candidate.summary);
  if (!summary) throw new Error('agent_context_summary_required');
  return { ...candidate, summary, status: 'confirmed', confirmedAt: nowFrom(options), updatedAt: nowFrom(options) };
}

export function rejectContextCandidate(candidate = {}, options = {}) {
  if (candidate?.status !== 'pending_confirmation') throw new Error('agent_context_confirmation_required');
  return { ...candidate, status: 'rejected', updatedAt: nowFrom(options) };
}

export function confirmedContextForAgent(candidates = [], agentId, options = {}) {
  const normalizedAgentId = text(agentId).toUpperCase();
  if (!normalizedAgentId) return [];
  const limit = Math.max(1, Math.min(Number(options.limit) || 6, 12));
  return candidates
    .filter((candidate) => candidate?.agentId === normalizedAgentId
      && candidate?.status === 'confirmed'
      && candidate?.privacy !== 'private')
    .slice()
    .sort((left, right) => String(right.confirmedAt || right.updatedAt || '')
      .localeCompare(String(left.confirmedAt || left.updatedAt || '')))
    .slice(0, limit)
    .map((candidate) => ({
      summary: text(candidate.summary),
      sourceLabels: referenceLabels(candidate.sourceLabels),
    }))
    .filter((candidate) => candidate.summary);
}
