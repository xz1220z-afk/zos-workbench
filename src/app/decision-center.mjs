import { createRecord as defaultCreateRecord, touchRecord as defaultTouchRecord } from '../data-model.mjs?v=2.0.0';
import { humanText } from './value-utils.mjs?v=2.0.0';

const TRANSITIONS = Object.freeze({
  open: new Set(['approved', 'rejected', 'deferred', 'pending_resolution']),
  pending_resolution: new Set(['resolved', 'open']),
  approved: new Set(),
  rejected: new Set(),
  deferred: new Set(),
  resolved: new Set(),
});

function requiredText(value, name) {
  const text = humanText(value, '');
  if (!text) throw new Error(`${name} is required`);
  return text;
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

export function reconcileDecisions(existing = [], currentItems = [], options = {}) {
  const now = requiredText(options.now, 'now');
  const { createRecord, touchRecord } = callbacks(options);
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
      if (decision.status === 'open') {
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
