import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExecutionPreview,
  classifyControlledAction,
  executeControlledAction,
} from '../src/app/controlled-execution.mjs';

test('policy classifies read-only, reversible draft and external actions', () => {
  assert.equal(classifyControlledAction({ type: 'navigate' }), 'L0');
  assert.equal(classifyControlledAction({ type: 'save_task_draft' }), 'L1');
  assert.equal(classifyControlledAction({ type: 'save_inbox_draft' }), 'L1');
  assert.equal(classifyControlledAction({ type: 'feishu_write' }), 'L2');
  assert.equal(classifyControlledAction({ type: 'delete' }), 'L2');
});

test('read-only navigation executes without confirmation', async () => {
  const visited = [];
  const result = await executeControlledAction(
    { type: 'navigate', target: 'local-life' },
    { navigate: (page) => visited.push(page) },
  );
  assert.equal(result.status, 'completed');
  assert.equal(result.level, 'L0');
  assert.deepEqual(visited, ['local-life']);
});

test('local task draft returns an undo contract only after a real save', async () => {
  const result = await executeControlledAction(
    { type: 'save_task_draft', title: '核验商家数据' },
    { saveTaskDraft: (draft) => ({ ...draft, id: 't-1' }) },
  );
  assert.equal(result.level, 'L1');
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.undo, { entityType: 'tasks', recordId: 't-1' });
  await assert.rejects(
    () => executeControlledAction({ type: 'save_task_draft', title: '失败草案' }, {}),
    /draft_executor_unavailable/,
  );
});

test('Feishu write returns an exact L2 preview and calls no executor', async () => {
  let calls = 0;
  const action = {
    type: 'feishu_write', target: '04.03 任务管理',
    changes: { title: '跟进商家' }, impact: '新增 1 条任务草案',
    testPlan: '回读记录 ID', rollback: '删除本次新增记录',
  };
  const result = await executeControlledAction(action, { externalWrite: () => { calls += 1; } });
  assert.equal(result.status, 'preview_required');
  assert.equal(result.level, 'L2');
  assert.deepEqual(result.preview, buildExecutionPreview(action));
  assert.equal(result.preview.target, '04.03 任务管理');
  assert.equal(calls, 0);
});

test('unknown mutating actions fail closed as L2', () => {
  assert.equal(classifyControlledAction({ type: 'mystery_write', mutates: true }), 'L2');
});
