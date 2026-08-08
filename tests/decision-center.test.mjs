import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDecisionAction,
  applyDecisionBatch,
  classifyDecision,
  decisionKey,
  deriveDecisions,
  partitionDecisions,
  reconcileDecisions,
  reviewDecisionHistory,
  transitionDecision,
} from '../src/app/decision-center.mjs';

const NOW = '2026-08-02T08:00:00.000Z';

const risk = {
  source: 'huahuo',
  sourceRecordId: 'project-7',
  category: 'delivery_delay',
  factSummary: '项目已延期 3 天',
  recommendedAction: '联系负责人确认新交付日',
  sourceUpdatedAt: '2026-08-02T06:00:00.000Z',
  severity: 'high',
};

function createRecord(fields, options) {
  return {
    id: options.id,
    ...fields,
    createdAt: options.now,
    updatedAt: options.now,
    revision: 1,
    deviceId: 'test-device',
    deletedAt: null,
  };
}

function touchRecord(record, options) {
  return {
    ...record,
    updatedAt: options.now,
    revision: record.revision + 1,
    deviceId: 'test-device',
  };
}

const callbacks = { createRecord, touchRecord };

test('decision classification separates CEO choices, owner follow-up and history without mutation', () => {
  const items = [
    { id: 'history', status: 'pending_resolution', decisionNote: '来源风险已消失，等待人工确认解除' },
    { id: 'follow-up', status: 'open', category: 'stale', severity: 'high', factSummary: '超过 7 天未更新（已停滞 30 天）' },
    { id: 'payment', status: 'open', category: 'stale', severity: 'medium', factSummary: '项目存在回款 / 收款待处理' },
    { id: 'explicit', status: 'open', decisionScope: 'ceo', factSummary: '需要朱帅拍板' },
  ];
  const before = structuredClone(items);

  assert.equal(classifyDecision(items[0]), 'history');
  assert.equal(classifyDecision(items[1]), 'follow_up');
  assert.equal(classifyDecision(items[2]), 'ceo');
  assert.equal(classifyDecision(items[3]), 'ceo');
  assert.deepEqual(partitionDecisions(items), {
    ceo: [items[2], items[3]],
    followUp: [items[1]],
    history: [items[0]],
  });
  assert.deepEqual(items, before);
});

test('explicit non-CEO scope keeps an open operational item in owner follow-up', () => {
  assert.equal(classifyDecision({
    id: 'delegated-payment',
    status: 'open',
    decisionScope: 'owner',
    requiresCeoDecision: false,
    category: 'revenue_pending',
    factSummary: '负责人跟进待回款',
  }), 'follow_up');
});

test('decisionKey uses the stable source identity and category', () => {
  assert.equal(decisionKey(risk), 'huahuo:project-7:delivery_delay');
});

test('deriveDecisions deduplicates the same fact and keeps AI text in recommendedAction', () => {
  const result = deriveDecisions(
    { risks: [risk, risk], inbox: [] },
    { now: NOW, ...callbacks },
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].factSummary, '项目已延期 3 天');
  assert.equal(result[0].recommendedAction, '联系负责人确认新交付日');
  assert.equal(result[0].status, 'open');
  assert.equal(result[0].sourceUpdatedAt, risk.sourceUpdatedAt);
  assert.equal(result[0].id, 'huahuo:project-7:delivery_delay');
});

test('decision facts normalize rich values and never persist object placeholders', () => {
  const [decision] = deriveDecisions({ risks: [{
    ...risk,
    sourceRecordId: 'project-rich-value',
    factSummary: { text: '花火项目需要确认交付日' },
    recommendedAction: { text: '联系负责人' },
  }] }, { now: NOW, ...callbacks });

  assert.equal(decision.factSummary, '花火项目需要确认交付日');
  assert.equal(decision.recommendedAction, '联系负责人');
  assert.doesNotMatch(JSON.stringify(decision), /\[object Object\]/);
});

test('deriveDecisions also accepts inbox and proposed Feishu actions without mixing fact and suggestion', () => {
  const result = deriveDecisions({
    risks: [],
    inbox: [{
      source: 'inbox',
      sourceRecordId: 'draft-1',
      category: 'review',
      factSummary: '有一条收集箱草稿待审核',
      recommendedAction: '审核后决定是否归档',
      sourceUpdatedAt: NOW,
    }],
    proposedActions: [{
      source: 'feishu',
      sourceRecordId: 'rec-1',
      category: 'write_approval',
      factSummary: '字段“状态”拟从待处理改为已确认',
      recommendedAction: '核对预览并确认执行',
      sourceUpdatedAt: NOW,
    }],
  }, { now: NOW, ...callbacks });

  assert.deepEqual(result.map((item) => item.source), ['feishu', 'inbox']);
  assert.equal(result[0].factSummary.includes('核对预览'), false);
});

test('a disappeared risk becomes pending_resolution instead of being deleted', () => {
  const [openDecision] = deriveDecisions({ risks: [risk] }, { now: NOW, ...callbacks });
  const result = reconcileDecisions(
    [openDecision],
    [],
    { now: '2026-08-03T08:00:00.000Z', ...callbacks },
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'pending_resolution');
  assert.equal(result[0].revision, 2);
});

test('an incomplete source refresh never bulk-converts open decisions into history', () => {
  const [openDecision] = deriveDecisions({ risks: [risk] }, { now: NOW, ...callbacks });
  const result = reconcileDecisions(
    [openDecision],
    [],
    { now: '2026-08-03T08:00:00.000Z', sourceCoverage: false, ...callbacks },
  );

  assert.equal(result[0].status, 'open');
  assert.equal(result[0].revision, openDecision.revision);
});

test('reconcile preserves a completed human decision and refreshes a matching open fact', () => {
  const [openDecision] = deriveDecisions({ risks: [risk] }, { now: NOW, ...callbacks });
  const approved = transitionDecision(openDecision, 'approved', '按建议推进', {
    now: '2026-08-02T09:00:00.000Z',
    ...callbacks,
  });
  const refreshed = { ...risk, factSummary: '项目已延期 4 天', sourceUpdatedAt: '2026-08-03T06:00:00.000Z' };

  const preserved = reconcileDecisions([approved], [refreshed], {
    now: '2026-08-03T08:00:00.000Z',
    ...callbacks,
  });
  assert.equal(preserved[0].status, 'approved');
  assert.equal(preserved[0].decisionNote, '按建议推进');

  const refreshedOpen = reconcileDecisions([openDecision], [refreshed], {
    now: '2026-08-03T08:00:00.000Z',
    ...callbacks,
  });
  assert.equal(refreshedOpen[0].factSummary, '项目已延期 4 天');
  assert.equal(refreshedOpen[0].sourceUpdatedAt, refreshed.sourceUpdatedAt);
});

test('transitionDecision allows only the documented lifecycle', () => {
  const [openDecision] = deriveDecisions({ risks: [risk] }, { now: NOW, ...callbacks });

  for (const nextStatus of ['approved', 'rejected', 'deferred', 'pending_resolution']) {
    assert.equal(transitionDecision(openDecision, nextStatus, '人工记录', {
      now: '2026-08-02T09:00:00.000Z',
      ...callbacks,
    }).status, nextStatus);
  }

  const pending = transitionDecision(openDecision, 'pending_resolution', '', {
    now: '2026-08-02T09:00:00.000Z',
    ...callbacks,
  });
  assert.equal(transitionDecision(pending, 'resolved', '确认解除', {
    now: '2026-08-02T10:00:00.000Z',
    ...callbacks,
  }).status, 'resolved');
  assert.equal(transitionDecision(pending, 'open', '仍需处理', {
    now: '2026-08-02T10:00:00.000Z',
    ...callbacks,
  }).status, 'open');

  assert.throws(
    () => transitionDecision(openDecision, 'resolved', '', { now: NOW, ...callbacks }),
    /invalid decision transition/,
  );
  assert.throws(
    () => transitionDecision({ ...openDecision, status: 'approved' }, 'open', '', { now: NOW, ...callbacks }),
    /invalid decision transition/,
  );
});

test('decision actions approve, delegate, defer, resolve, reopen and escalate without deleting identity', () => {
  const [open] = deriveDecisions({ risks: [risk] }, { now: NOW, ...callbacks });
  const at = '2026-08-02T09:00:00.000Z';

  const approved = applyDecisionAction(open, 'approve', '按建议推进', { now: at, ...callbacks });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.id, open.id);

  const delegated = applyDecisionAction(open, 'delegate', '交阿涛跟进', { now: at, ...callbacks });
  assert.equal(delegated.status, 'open');
  assert.equal(delegated.decisionScope, 'owner');
  assert.equal(delegated.requiresCeoDecision, false);
  assert.equal(delegated.decisionNote, '交阿涛跟进');
  assert.equal(delegated.id, open.id);

  assert.equal(applyDecisionAction(open, 'defer', '下周再看', { now: at, ...callbacks }).status, 'deferred');
  assert.equal(applyDecisionAction({ ...open, status: 'pending_resolution' }, 'resolve', '确认解除', { now: at, ...callbacks }).status, 'resolved');
  assert.equal(applyDecisionAction({ ...open, status: 'pending_resolution' }, 'reopen', '仍需处理', { now: at, ...callbacks }).status, 'open');
  assert.equal(applyDecisionAction({ ...open, status: 'deferred' }, 'reopen', '提前恢复', { now: at, ...callbacks }).status, 'open');

  const escalated = applyDecisionAction({ ...open, decisionScope: 'owner', requiresCeoDecision: false }, 'escalate', '需要朱帅拍板', { now: at, ...callbacks });
  assert.equal(escalated.decisionScope, 'ceo');
  assert.equal(escalated.requiresCeoDecision, true);
  assert.equal(escalated.id, open.id);
});

test('decision actions reject invalid action and status pairs and require identity', () => {
  const [open] = deriveDecisions({ risks: [risk] }, { now: NOW, ...callbacks });

  assert.throws(() => applyDecisionAction(open, 'resolve', '', { now: NOW, ...callbacks }), /invalid decision transition/);
  assert.throws(() => applyDecisionAction({ ...open, status: 'approved' }, 'delegate', '', { now: NOW, ...callbacks }), /invalid decision action/);
  assert.throws(() => applyDecisionAction(open, 'unknown', '', { now: NOW, ...callbacks }), /invalid decision action/);
  assert.throws(() => applyDecisionAction({ ...open, id: '' }, 'delegate', '', { now: NOW, ...callbacks }), /decision id is required/);
});

test('history review keeps the original decision status and identity', () => {
  const [open] = deriveDecisions({ risks: [risk] }, { now: NOW, ...callbacks });
  const approved = applyDecisionAction(open, 'approve', '执行', { now: NOW, ...callbacks });
  const reviewed = reviewDecisionHistory(approved, {
    now: '2026-08-07T09:00:00.000Z', ...callbacks,
  });

  assert.equal(reviewed.id, approved.id);
  assert.equal(reviewed.status, 'approved');
  assert.equal(reviewed.historyReviewed, true);
  assert.equal(reviewed.historyReviewedAt, '2026-08-07T09:00:00.000Z');
  assert.equal(reviewed.revision, approved.revision + 1);
});

test('batch review handles every history record while batch reopen skips final decisions', () => {
  const [open] = deriveDecisions({ risks: [risk] }, { now: NOW, ...callbacks });
  const deferred = applyDecisionAction(open, 'defer', '稍后', { now: NOW, ...callbacks });
  const pending = transitionDecision(open, 'pending_resolution', '', { now: NOW, ...callbacks });
  const approved = applyDecisionAction(open, 'approve', '执行', { now: NOW, ...callbacks });

  const reviewed = applyDecisionBatch([deferred, pending, approved], 'review_history', '', {
    now: '2026-08-07T09:00:00.000Z', ...callbacks,
  });
  assert.equal(reviewed.changed.length, 3);
  assert.deepEqual(reviewed.skipped, []);
  assert.ok(reviewed.changed.every((item) => item.historyReviewed));

  const reopened = applyDecisionBatch([deferred, pending, approved], 'reopen', '继续跟进', {
    now: '2026-08-07T10:00:00.000Z', ...callbacks,
  });
  assert.deepEqual(reopened.changed.map((item) => item.status), ['open', 'open']);
  assert.deepEqual(reopened.skipped, [{ id: approved.id, status: 'approved' }]);
});

test('batch decisions are planned without mutating the selected records', () => {
  const [open] = deriveDecisions({ risks: [risk] }, { now: NOW, ...callbacks });
  const deferred = applyDecisionAction(open, 'defer', '稍后', { now: NOW, ...callbacks });
  const before = structuredClone(deferred);

  const result = applyDecisionBatch([deferred], 'reopen', '', {
    now: '2026-08-07T10:00:00.000Z', ...callbacks,
  });

  assert.deepEqual(deferred, before);
  assert.equal(result.changed[0].status, 'open');
  assert.throws(() => applyDecisionBatch([deferred], 'delete', '', { now: NOW, ...callbacks }), /unsupported batch action/);
});
