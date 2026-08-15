import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAiCommand,
  normalizeAiCommandResult,
  sanitizeAiActivity,
  transitionAiCommand,
} from '../src/app/ai-command-center.mjs';

test('a command preserves editable input and advances through explicit states', () => {
  const command = createAiCommand('  查一下万嘉今天的数据  ', {
    id: 'cmd-1', scope: 'wanjia', now: '2026-08-15T09:00:00.000Z',
  });
  assert.deepEqual(command, {
    id: 'cmd-1', input: '查一下万嘉今天的数据', scope: 'wanjia',
    state: 'idle', createdAt: '2026-08-15T09:00:00.000Z', error: null,
  });
  assert.equal(transitionAiCommand(command, 'routing').state, 'routing');
  assert.throws(() => transitionAiCommand(command, 'invented'), /invalid_ai_command_state/);
});

test('command results distinguish facts, inference, advice, pending items and next step', () => {
  const result = normalizeAiCommandResult({
    answer: '先核验日报',
    sources: [{ label: '林客日报', date: '2026-08-15' }],
    facts: ['日报日期为 2026-08-15'],
    inference: ['异常可能来自数据延迟'],
    advice: ['先核验商家 ID'],
    pending: ['待确认负责人'],
    next: ['打开万嘉页面'],
  }, { task: '今天万嘉有什么风险', execution: { level: 'L0', actions: [] } });
  assert.equal(result.task, '今天万嘉有什么风险');
  assert.equal(result.answer, '先核验日报');
  assert.deepEqual(result.sources, [{ label: '林客日报', date: '2026-08-15' }]);
  assert.deepEqual(result.sections.facts, ['日报日期为 2026-08-15']);
  assert.deepEqual(result.sections.inference, ['异常可能来自数据延迟']);
  assert.deepEqual(result.sections.advice, ['先核验商家 ID']);
  assert.deepEqual(result.sections.pending, ['待确认负责人']);
  assert.deepEqual(result.sections.next, ['打开万嘉页面']);
  assert.equal(result.execution.level, 'L0');
});

test('plain OpenAI answers remain visible without inventing facts', () => {
  const result = normalizeAiCommandResult({ answer: '建议先查看日报。', sources: ['工作台'] }, { task: '我该做什么' });
  assert.deepEqual(result.sections.facts, []);
  assert.deepEqual(result.sections.advice, ['建议先查看日报。']);
  assert.deepEqual(result.sections.inference, []);
});

test('safe activity summary excludes transcript, answer and raw source bodies', () => {
  const command = createAiCommand('读取私人正文', { id: 'cmd-2', scope: 'life', now: '2026-08-15T09:00:00.000Z' });
  const item = sanitizeAiActivity({ ...command, answer: '私人内容', rawSources: [{ body: '正文' }] });
  assert.deepEqual(item, {
    id: 'cmd-2', scope: 'life', state: 'idle', createdAt: '2026-08-15T09:00:00.000Z',
  });
  assert.equal(Object.hasOwn(item, 'input'), false);
  assert.equal(Object.hasOwn(item, 'answer'), false);
  assert.equal(Object.hasOwn(item, 'rawSources'), false);
});
