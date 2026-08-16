import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExecutionLedger } from '../src/app/execution-ledger.mjs';
import { sanitizeAiActivity } from '../src/app/ai-command-center.mjs';

test('execution ledger merges safe activities, agent work and approvals in newest-first order', () => {
  const ledger = buildExecutionLedger({
    commands: [{ id: 'cmd-1', scope: 'wanjia', intent: 'business_query', riskLevel: 'L0', state: 'completed', createdAt: '2026-08-16T08:00:00Z', updatedAt: '2026-08-16T08:05:00Z' }],
    agentRuns: [{ id: 'run-1', agentId: 'WAN-001', objective: '检查异常商家', status: 'running', updatedAt: '2026-08-16T09:00:00Z' }],
    approvals: [{ approvalId: 'approval-1', target: '飞书商家表', status: 'preview_required', createdAt: '2026-08-16T10:00:00Z' }],
  });
  assert.deepEqual(ledger.map((item) => item.id), ['approval-1', 'run-1', 'cmd-1']);
  assert.equal(ledger[0].state, 'awaiting_confirmation');
  assert.equal(ledger[1].state, 'running');
  assert.equal(ledger[2].kind, 'ai_command');
});

test('ledger respects limits and redacts private relationship objectives', () => {
  const ledger = buildExecutionLedger({
    agentRuns: [
      { id: 'private', agentId: 'REL-001', objective: '私人关系具体事项', status: 'draft', updatedAt: '2026-08-16T10:00:00Z' },
      { id: 'public', agentId: 'WAN-001', objective: '检查经营数据', status: 'completed', updatedAt: '2026-08-16T09:00:00Z' },
    ],
  }, { limit: 1 });
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].summary, '私密任务');
  assert.equal(JSON.stringify(ledger).includes('私人关系具体事项'), false);
});

test('safe AI activity adds routing metadata but excludes prompts and answers', () => {
  const activity = sanitizeAiActivity({
    id: 'cmd-2', scope: 'wanjia', state: 'completed', createdAt: '2026-08-16T09:00:00Z', updatedAt: '2026-08-16T09:01:00Z',
    route: { intent: 'business_query', agentId: 'WAN-001', riskLevel: 'L0' },
    input: '敏感输入', result: { answer: '敏感答案' }, rawSources: [{ body: '正文' }],
  });
  assert.deepEqual(activity, {
    id: 'cmd-2', scope: 'wanjia', state: 'completed', createdAt: '2026-08-16T09:00:00Z', updatedAt: '2026-08-16T09:01:00Z',
    intent: 'business_query', agentId: 'WAN-001', riskLevel: 'L0',
  });
  assert.equal(Object.hasOwn(activity, 'input'), false);
  assert.equal(Object.hasOwn(activity, 'result'), false);
});
