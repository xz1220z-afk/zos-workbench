import test from 'node:test';
import assert from 'node:assert/strict';

import { buildContinuityPrompts } from '../src/app/continuity-engine.mjs';

const NOW = '2026-08-16T10:00:00.000Z';

test('turns target gaps and overdue work into deterministic safe prompts', () => {
  const prompts = buildContinuityPrompts({
    targets: [{ id: 'target-1', metricKey: 'wanjia.paymentGmv', label: '万嘉支付 GMV' }],
    gaps: [{ metricKey: 'wanjia.paymentGmv', state: 'behind', gap: 2000 }],
    tasks: [{ id: 'task-1', title: '核对花火交付', status: 'open', dueDate: '2026-08-14' }],
    now: NOW,
  });

  assert.deepEqual(prompts.map((item) => item.kind), ['overdue_task', 'target_gap']);
  assert.equal(prompts[0].action, 'open_task');
  assert.equal(prompts[1].action, 'draft_task');
  assert.match(prompts[1].title, /万嘉支付 GMV/);
});

test('does not repeat a target gap when an open matching task already exists', () => {
  const prompts = buildContinuityPrompts({
    targets: [{ id: 'target-1', metricKey: 'wanjia.paymentGmv', label: '万嘉支付 GMV' }],
    gaps: [{ metricKey: 'wanjia.paymentGmv', state: 'behind', gap: 2000 }],
    tasks: [{ id: 'task-1', title: '推进万嘉支付 GMV', metricKey: 'wanjia.paymentGmv', status: 'open' }],
    now: NOW,
  });

  assert.equal(prompts.some((item) => item.kind === 'target_gap'), false);
});

test('prompts for a completed Agent run without a follow-up task and redacts private work', () => {
  const prompts = buildContinuityPrompts({
    agentRuns: [
      { id: 'run-public', agentId: 'WAN-001', objective: '诊断异常商家', status: 'completed', completedAt: '2026-08-16T09:00:00Z' },
      { id: 'run-private', agentId: 'REL-001', objective: '具体私人关系内容', status: 'completed', completedAt: '2026-08-16T09:30:00Z' },
    ],
    tasks: [],
    now: NOW,
  }, { limit: 10 });

  assert.equal(prompts.length, 2);
  assert.equal(prompts[0].private, true);
  assert.equal(prompts[0].title.includes('具体私人关系内容'), false);
  assert.match(prompts[0].title, /私密 Agent/);
  assert.equal(prompts[1].sourceId, 'run-public');
});

test('keeps an unsaved AI next step visible without persisting the answer body', () => {
  const prompts = buildContinuityPrompts({
    aiCommand: {
      id: 'cmd-1', state: 'completed',
      result: { sections: { next: ['核对最新飞书数据', '生成任务草案'] } },
    },
    tasks: [], now: NOW,
  });

  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].kind, 'ai_next_step');
  assert.equal(prompts[0].title, '核对最新飞书数据');
  assert.equal(prompts[0].action, 'draft_task');
  assert.equal(JSON.stringify(prompts).includes('answer'), false);
});

test('deduplicates equivalent prompts and respects a bounded limit', () => {
  const prompts = buildContinuityPrompts({
    tasks: [
      { id: 'a', title: '跟进客户', status: 'open', dueDate: '2026-08-14' },
      { id: 'b', title: ' 跟进客户 ', status: 'open', dueDate: '2026-08-13' },
      { id: 'c', title: '整理资料', status: 'open', dueDate: '2026-08-12' },
    ],
    now: NOW,
  }, { limit: 1 });

  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].title, '整理资料');
});
