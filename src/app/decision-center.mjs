import { createRecord as defaultCreateRecord, touchRecord as defaultTouchRecord } from '../data-model.mjs?v=2.12.1';
import { humanText } from './value-utils.mjs?v=2.12.1';

const TRANSITIONS = Object.freeze({
  open: new Set(['approved', 'rejected', 'deferred', 'pending_resolution']),
  pending_resolution: new Set(['resolved', 'open']),
  approved: new Set(),
  rejected: new Set(),
  deferred: new Set(['open']),
  resolved: new Set(),
});

const CEO_CATEGORIES = new Set(['high_risk', 'revenue_pending', 'write_approval']);
const CEO_FACT_PATTERN = /价格|报价|回款|收款|亏损|高风险|资源(?:投入|增派|调整)|增派资源|重大交付|交付延期|延期交付|CEO|朱帅|拍板|确认执行|审批|批准/i;

function requiredText(value, name) {
  const text = humanText(value, '');
  if (!text) throw new Error(`${name} is required`);
  return text;
}

export function classifyDecision(item = {}) {
  if (item.status !== 'open') return 'history';
  if (item.requiresCeoDecision === false || item.decisionScope === 'owner') return 'follow_up';
  if (item.requiresCeoDecision === true || item.decisionScope === 'ceo') return 'ceo';
  if (CEO_CATEGORIES.has(String(item.category || '').trim())) return 'ceo';
  const evidence = [item.factSummary, item.title, item.recommendedAction]
    .map((value) => humanText(value, ''))
    .filter(Boolean)
    .join('；');
  return CEO_FACT_PATTERN.test(evidence) ? 'ceo' : 'follow_up';
}

export function partitionDecisions(items = []) {
  const result = { ceo: [], followUp: [], history: [] };
  for (const item of Array.isArray(items) ? items : []) {
    const bucket = classifyDecision(item);
    if (bucket === 'ceo') result.ceo.push(item);
    else if (bucket === 'follow_up') result.followUp.push(item);
    else result.history.push(item);
  }
  return result;
}

function normalizedIdentity(item) {
  const source = requiredText(item.source || item.kind, 'source');
  const sourceRecordId = requiredText(item.sourceRecordId || item.recordId || item.id, 'sourceRecordId');
  const category = requiredText(item.category || item.reasons?.[0]?.code || 'review', 'category');
  return { source, sourceRecordId, category };
}

function factText(item) {
  if (item.factSummary) return requiredText(item.factSummary, 'factSummary');
  const labels = Array.isArray(item.reasons)
    ? item.reasons.map((reason) => humanText(reason?.label, '')).filter(Boolean)
    : [];
  if (labels.length) return `${requiredText(item.name || item.recordId, 'fact name')}：${labels.join('；')}`;
  throw new Error('factSummary is required');
}

function toCandidate(item) {
  const identity = normalizedIdentity(item);
  return {
    ...identity,
    id: decisionKey(identity),
    factSummary: factText(item),
    recommendedAction: humanText(item.recommendedAction, ''),
    sourceUpdatedAt: item.sourceUpdatedAt || null,
    severity: item.severity || item.level || null,
    status: 'open',
    decisionNote: '',
  };
}

function callbacks(options) {
  return {
    createRecord: options.createRecord || defaultCreateRecord,
    touchRecord: options.touchRecord || defaultTouchRecord,
  };
}

export function decisionKey(item) {
  const { source, sourceRecordId, category } = normalizedIdentity(item);
  return `${source}:${sourceRecordId}:${category}`;
}

export function deriveDecisions(input = {}, options = {}) {
  const now = requiredText(options.now, 'now');
  const { createRecord } = callbacks(options);
  const candidates = [
    ...(Array.isArray(input.risks) ? input.risks : []),
    ...(Array.isArray(input.inbox) ? input.inbox : []),
    ...(Array.isArray(input.proposedActions) ? input.proposedActions : []),
  ];
  const unique = new Map();

  for (const item of candidates) {
    const candidate = toCandidate(item);
    if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
  }

  return [...unique.values()]
    .sort((left, right) => left.id.localeCompare(right.id, 'zh-CN'))
    .map((candidate) => createRecord(candidate, { id: candidate.id, now, deviceId: options.deviceId || 'decision-engine' }));
}

export function transitionDecision(decision, nextStatus, note = '', options = {}) {
  const current = requiredText(decision?.status, 'decision status');
  const next = requiredText(nextStatus, 'nextStatus');
  if (!TRANSITIONS[current]?.has(next)) {
    throw new Error(`invalid decision transition: ${current} -> ${next}`);
  }

  const { touchRecord } = callbacks(options);
  return touchRecord({
    ...decision,
    status: next,
    decisionNote: String(note || '').trim(),
    decidedAt: ['approved', 'rejected', 'deferred', 'resolved'].includes(next)
      ? requiredText(options.now, 'now')
      : decision.decidedAt || null,
  }, { now: requiredText(options.now, 'now'), deviceId: options.deviceId || 'decision-engine' });
}

export function applyDecisionAction(decision, action, note = '', options = {}) {
  requiredText(decision?.id, 'decision id');
  const next = requiredText(action, 'decision action');
  if (next === 'approve') return transitionDecision(decision, 'approved', note, options);
  if (next === 'defer') return transitionDecision(decision, 'deferred', note, options);
  if (next === 'resolve') return transitionDecision(decision, 'resolved', note, options);
  if (next === 'reopen') return transitionDecision(decision, 'open', note, options);

  const current = requiredText(decision?.status, 'decision status');
  const { touchRecord } = callbacks(options);
  const at = { now: requiredText(options.now, 'now'), deviceId: options.deviceId || 'decision-engine' };
  if (next === 'delegate' && current === 'open') {
    return touchRecord({
      ...decision,
      decisionScope: 'owner',
      requiresCeoDecision: false,
      decisionNote: String(note || '').trim(),
    }, at);
  }
  if (next === 'escalate' && current === 'open') {
    return touchRecord({
      ...decision,
      decisionScope: 'ceo',
      requiresCeoDecision: true,
      decisionNote: String(note || '').trim(),
    }, at);
  }
  throw new Error(`invalid decision action: ${next}`);
}

export function reviewDecisionHistory(decision, options = {}) {
  requiredText(decision?.id, 'decision id');
  const current = requiredText(decision?.status, 'decision status');
  if (current === 'open') throw new Error('open decision is not history');
  const now = requiredText(options.now, 'now');
  const { touchRecord } = callbacks(options);
  return touchRecord({
    ...decision,
    historyReviewed: true,
    historyReviewedAt: now,
  }, { now, deviceId: options.deviceId || 'decision-engine' });
}

export function applyDecisionBatch(decisions = [], action, note = '', options = {}) {
  const requested = requiredText(action, 'batch action');
  if (!['review_history', 'reopen'].includes(requested)) {
    throw new Error(`unsupported batch action: ${requested}`);
  }
  const changed = [];
  const skipped = [];
  for (const decision of Array.isArray(decisions) ? decisions : []) {
    const status = humanText(decision?.status, '');
    const eligible = requested === 'review_history'
      ? status !== 'open'
      : ['pending_resolution', 'deferred'].includes(status);
    if (!eligible) {
      skipped.push({ id: decision?.id || '', status });
      continue;
    }
    changed.push(requested === 'review_history'
      ? reviewDecisionHistory(decision, options)
      : applyDecisionAction(decision, 'reopen', note, options));
  }
  return { changed, skipped };
}

export function reconcileDecisions(existing = [], currentItems = [], options = {}) {
  const now = requiredText(options.now, 'now');
  const { createRecord, touchRecord } = callbacks(options);
  const sourceCoverage = options.sourceCoverage !== false;
  const currentByKey = new Map();
  for (const item of currentItems) {
    const candidate = toCandidate(item);
    if (!currentByKey.has(candidate.id)) currentByKey.set(candidate.id, candidate);
  }

  const reconciled = [];
  const existingKeys = new Set();
  for (const decision of existing) {
    const key = decisionKey(decision);
    existingKeys.add(key);
    const candidate = currentByKey.get(key);

    if (!candidate) {
      if (decision.status === 'open' && sourceCoverage) {
        reconciled.push(transitionDecision(decision, 'pending_resolution', '来源风险已消失，等待人工确认解除', {
          ...options,
          now,
        }));
      } else {
        reconciled.push(decision);
      }
      continue;
    }

    if (decision.status !== 'open') {
      reconciled.push(decision);
      continue;
    }

    const factsChanged = decision.factSummary !== candidate.factSummary
      || decision.recommendedAction !== candidate.recommendedAction
      || decision.sourceUpdatedAt !== candidate.sourceUpdatedAt
      || decision.severity !== candidate.severity;
    reconciled.push(factsChanged
      ? touchRecord({ ...decision, ...candidate, status: 'open', decisionNote: decision.decisionNote || '' }, {
        now,
        deviceId: options.deviceId || 'decision-engine',
      })
      : decision);
  }

  for (const [key, candidate] of currentByKey) {
    if (existingKeys.has(key)) continue;
    reconciled.push(createRecord(candidate, {
      id: key,
      now,
      deviceId: options.deviceId || 'decision-engine',
    }));
  }

  return reconciled.sort((left, right) => left.id.localeCompare(right.id, 'zh-CN'));
}
