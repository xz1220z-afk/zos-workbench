import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decisionKey,
  deriveDecisions,
  reconcileDecisions,
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
