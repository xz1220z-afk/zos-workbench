import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentRuntimeAvailability,
  completeAgentTaskArchive,
  confirmContextCandidate,
  createAgentTaskArchive,
  createContextCandidate,
} from '../src/app/agent-task-context.mjs';

test('a task archive keeps an Agent rule snapshot and creates a pending local context candidate only after a result', () => {
  const archive = createAgentTaskArchive({
    id: 'archive-1', agentId: 'WANJIA-001', objective: '核验今日商家风险', taskId: 'task-1',
    agentRules: { outputContract: '事实、推断、建议、待确认、下一步。', scopeOut: '不自动写飞书' },
    inputRefs: ['林客日报 2026-08-08'], now: '2026-08-08T10:00:00.000Z',
  });
  assert.equal(archive.phase, 'draft');
  assert.equal(archive.agentRules.outputContract, '事实、推断、建议、待确认、下一步。');
  assert.throws(() => createContextCandidate(archive), /agent_archive_not_completed/);

  const completed = completeAgentTaskArchive(archive, {
    factSummary: '数据日期待校验', recommendationSummary: '先补齐日报',
  }, { now: '2026-08-08T10:10:00.000Z' });
  const candidate = createContextCandidate(completed, { id: 'context-1', now: '2026-08-08T10:11:00.000Z' });
  assert.equal(candidate.status, 'pending_confirmation');
  assert.equal(candidate.agentId, 'WANJIA-001');
  assert.equal(candidate.summary.includes('日报'), true);
});

test('context candidates are edited only during explicit confirmation and retain a local-only privacy boundary', () => {
  const archive = completeAgentTaskArchive(createAgentTaskArchive({
    agentId: 'REL-001', objective: '准备关怀草稿', privacy: 'private', now: '2026-08-08T10:00:00.000Z',
  }), { factSummary: '已确认重要日子', recommendationSummary: '先准备一件小礼物' }, { now: '2026-08-08T10:10:00.000Z' });
  const candidate = createContextCandidate(archive, { now: '2026-08-08T10:11:00.000Z' });
  const confirmed = confirmContextCandidate(candidate, { summary: '重要日子需提前准备小礼物' }, { now: '2026-08-08T10:12:00.000Z' });
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.privacy, 'private');
  assert.equal(confirmed.summary, '重要日子需提前准备小礼物');
});

test('archive validation excludes raw bodies and sensitive context fields', () => {
  assert.throws(() => createAgentTaskArchive({ agentId: 'WANJIA-001', objective: '诊断', body: 'Vault 正文' }), /agent_context_field_forbidden/);
  assert.throws(() => completeAgentTaskArchive(createAgentTaskArchive({ agentId: 'WANJIA-001', objective: '诊断' }), { chat: '私聊全文' }), /agent_context_field_forbidden/);
});

test('runtime availability remains independent from the Agent identity lifecycle', () => {
  assert.equal(agentRuntimeAvailability({ status: 'draft' }), 'can_draft');
  assert.equal(agentRuntimeAvailability({ status: 'active' }, { aiReady: true }), 'can_analyze');
  assert.equal(agentRuntimeAvailability({ status: 'pilot' }, { aiReady: true }), 'pilot_limited');
  assert.equal(agentRuntimeAvailability({ status: 'deprecated' }, { aiReady: true }), 'can_draft');
});
