import test from 'node:test';
import assert from 'node:assert/strict';

import { createOperatingLoop } from '../src/app/operating-loop.mjs';

const now = '2026-08-02T07:30:00.000Z';
const business = {
  wanjia: {
    source: 'wanjia', mode: 'read_only', contractVersion: '1.3', fetchedAt: now,
    summary: { paymentGmv: 8000, redeemedGmv: 6000, activeMerchants: 4 },
    records: [{
      id: 'merchant-1', sourceRecordId: 'rec-merchant-1', merchantName: '测试商家', stage: '执行中',
      nextAction: '确认下周直播', riskLevel: '中', revenueStatus: '待收款', updatedAt: '2026-07-20T00:00:00.000Z',
    }],
    health: { recordCount: 1, durationMs: 25, lastSuccessAt: now, safeCode: null },
  },
};

test('authenticated operating loop connects facts, decisions, targets, brief, conflicts and approvals', async () => {
  const snapshots = [];
  const healthRows = [];
  const approvalClient = {
    async preview(proposal) { return { approvalId: 'approval-1', status: 'previewed', ...proposal, fieldName: '当前阶段', before: '执行中', after: proposal.value }; },
    async execute(approvalId) { return { approvalId, status: 'executed', verified: true, executedAt: now }; },
  };
  const loop = createOperatingLoop({
    userId: 'user-1', deviceId: 'device-1', now: () => now, date: () => '2026-08-02',
    refreshBusiness: async (source) => business[source], approvalClient,
    saveSnapshots: async (rows) => snapshots.push(...rows),
    saveHealth: async (row) => healthRows.push(row),
  });

  await loop.refresh('wanjia');
  assert.equal(loop.getState().health[0].state, 'synced');
  assert.ok(snapshots.some((row) => row.metricKey === 'wanjia.paymentGmv'));
  assert.equal(healthRows[0].recordCount, 1);
  assert.equal(loop.getState().decisions.length, 1);

  loop.confirmTargets([{ metricKey: 'wanjia.paymentGmv', value: 10000, confirmation: 'confirmed', period: '2026-08' }]);
  assert.equal(loop.getState().gaps[0].gap, 2000);
  const firstBrief = loop.ensureDailyBrief();
  const secondBrief = loop.ensureDailyBrief();
  assert.equal(firstBrief.id, secondBrief.id);
  assert.equal(loop.getState().briefs.length, 1);
  assert.equal(firstBrief.reviewStatus, 'pending_review');

  loop.setConflicts([{ id: 'targets:target-1', entityType: 'targets' }]);
  assert.equal(loop.getState().conflicts.length, 1);
  const factsBefore = JSON.stringify(loop.getState().sources);
  await loop.previewFeishu({ source: 'wanjia', recordId: 'rec-merchant-1', action: 'set_status', value: '已完成' });
  assert.equal(JSON.stringify(loop.getState().sources), factsBefore, 'preview must not mutate business facts');
  const executed = await loop.executeFeishu('approval-1');
  assert.equal(executed.verified, true);
  assert.equal(loop.getState().approvals[0].status, 'executed');
});

test('unverified Feishu execution never becomes successful local state', async () => {
  const loop = createOperatingLoop({
    userId: 'user-1', deviceId: 'device-1', now: () => now, date: () => '2026-08-02',
    refreshBusiness: async () => business.wanjia,
    approvalClient: {
      preview: async () => ({ approvalId: 'approval-2', status: 'previewed' }),
      execute: async () => ({ approvalId: 'approval-2', status: 'executed', verified: false }),
    },
  });
  await loop.previewFeishu({ source: 'wanjia', recordId: 'rec-1', action: 'set_status', value: '完成' });
  await assert.rejects(() => loop.executeFeishu('approval-2'), /readback verification required/);
  assert.equal(loop.getState().approvals[0].status, 'previewed');
});

test('operating loop hydrates synchronized decisions and briefs without duplicating the daily brief', () => {
  const existingBrief = {
    id: 'daily-brief:2026-08-02:existing', kind: 'daily_brief', date: '2026-08-02',
    fingerprint: 'existing', reviewStatus: 'pending_review', sections: {},
  };
  const loop = createOperatingLoop({
    userId: 'user-1', deviceId: 'device-1', now: () => now, date: () => '2026-08-02',
    refreshBusiness: async () => business.wanjia,
    approvalClient: { preview: async () => ({}), execute: async () => ({ verified: true }) },
    initialState: {
      decisions: [{ id: 'wanjia:rec-1:risk', source: 'wanjia', sourceRecordId: 'rec-1', category: 'risk', status: 'open' }],
      briefs: [existingBrief],
    },
  });

  assert.equal(loop.getState().decisions.length, 1);
  assert.equal(loop.getState().briefs.length, 1);

  const updated = loop.updateDecision({
    ...loop.getState().decisions[0],
    decisionScope: 'owner',
    requiresCeoDecision: false,
    revision: 2,
  });
  assert.equal(updated.decisionScope, 'owner');
  assert.equal(loop.getState().decisions[0].revision, 2);
  updated.decisionScope = 'ceo';
  assert.equal(loop.getState().decisions[0].decisionScope, 'owner', 'returned decisions must be cloned');
  assert.throws(() => loop.updateDecision({ id: 'missing', status: 'open' }), /decision not found/);
  assert.throws(() => loop.updateDecision({ id: '', status: 'open' }), /decision id is required/);
});

test('operating loop expands nested source records and regenerates today brief with tasks and decisions', async () => {
  const nested = structuredClone(business.wanjia);
  nested.records = { source: 'wanjia', records: business.wanjia.records };
  const loop = createOperatingLoop({
    userId: 'user-1', deviceId: 'device-1', now: () => now, date: () => '2026-08-02',
    refreshBusiness: async () => nested,
    getTasks: () => [{ id: 'task-1', title: '今天必须处理', status: 'open', priority: 3, dueDate: '2026-08-02' }],
    approvalClient: { preview: async () => ({}), execute: async () => ({ verified: true }) },
    initialState: {
      briefs: [{
        id: 'daily-brief:2026-08-02:old', kind: 'daily_brief', date: '2026-08-02',
        fingerprint: 'old', reviewStatus: 'pending_review', sections: { todayTop3: [] },
      }],
    },
  });

  await loop.refresh('wanjia');
  const brief = loop.ensureDailyBrief();
  assert.equal(loop.getState().decisions.length, 1, 'nested Feishu records must reach risk detection');
  assert.equal(brief.sections.todayTop3[0].title, '今天必须处理');
  assert.match(brief.sections.todayTop3[1].title, /^测试商家：超过 7 天未更新/);
  assert.notEqual(brief.id, 'daily-brief:2026-08-02:old', 'the regenerated brief must be returned instead of the stale first brief');
});
