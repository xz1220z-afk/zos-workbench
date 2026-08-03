import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTodayTop3 } from '../src/app/priority-engine.mjs';

test('ranks overdue, due-today and cash or delivery risks ahead of lower-signal items', () => {
  const top3 = buildTodayTop3({
    tasks: [
      { id: 'late', title: '确认逾期交付', status: 'open', dueDate: '2026-08-02', owner: '项目负责人' },
      { id: 'today', title: '核对今日回款', status: 'open', dueDate: '2026-08-03' },
      { id: 'later', title: '整理下周资料', status: 'open', dueDate: '2026-08-06', priority: 3 },
    ],
    risks: [{ id: 'risk-1', title: '花火待回款超过约定时间', severity: 'high', type: 'cash' }],
    calendarConflicts: [{ id: 'conflict-1', title: '团队会与客户沟通冲突' }],
    intelligence: [{ externalId: 'intel-1', title: '平台规则更新', score: 95 }],
  }, { date: '2026-08-03' });

  assert.deepEqual(top3.map((item) => item.title), ['确认逾期交付', '核对今日回款', '花火待回款超过约定时间']);
  assert.equal(top3[0].reason, '已逾期 1 天');
  assert.equal(top3[1].reason, '今天到期');
  assert.match(top3[2].reason, /高风险.*回款/);
});

test('keeps source, owner and due date explicit and never invents missing facts', () => {
  const [item] = buildTodayTop3({
    decisions: [{ id: 'decision-1', factSummary: '需要确认一项经营决策', severity: 'high', status: 'open', recommendedAction: '核对事实后决定' }],
  }, { date: '2026-08-03' });

  assert.equal(item.sourceType, 'decision');
  assert.equal(item.sourceId, 'decision-1');
  assert.equal(item.owner, null);
  assert.equal(item.dueAt, null);
  assert.equal(item.recommendedAction, '核对事实后决定');
});

test('deduplicates equivalent actions and excludes completed tasks', () => {
  const top3 = buildTodayTop3({
    tasks: [
      { id: 'done', title: '已完成', status: 'done', dueDate: '2026-08-01' },
      { id: 'one', title: '  跟进客户  ', status: 'open', dueDate: '2026-08-03' },
    ],
    decisions: [{ id: 'two', title: '跟进客户', status: 'open', severity: 'high' }],
  }, { date: '2026-08-03' });

  assert.deepEqual(top3.map((item) => item.title), ['跟进客户']);
});
