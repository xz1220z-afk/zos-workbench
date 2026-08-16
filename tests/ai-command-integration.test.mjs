import test from 'node:test';
import assert from 'node:assert/strict';

import { createCeoOsApplication } from '../src/app.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function application(options = {}) {
  return createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {}, defaultView: null },
    storage: memoryStorage(), createOperatingRuntime: false,
    now: () => '2026-08-15T09:00:00.000Z',
    ...options,
  });
}

test('AI command uses the existing OpenAI path and keeps the structured result', async () => {
  const requests = [];
  const app = application({
    askAi: async (request) => {
      requests.push(request);
      return {
        state: 'answered', answer: '先核验商家日报', sources: ['林客日报'],
        facts: ['数据日期为今天'], advice: ['核验商家 ID'], next: ['打开万嘉页面'],
        actions: [{ type: 'navigate', target: 'local-life', label: '打开万嘉' }],
      };
    },
  });
  const result = await app.submitAiCommand('今天万嘉有什么风险', { scope: 'auto' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].mode, 'command');
  assert.equal(requests[0].command.scope, 'wanjia');
  assert.equal(result.sections.facts[0], '数据日期为今天');
  assert.equal(app.viewModel().aiCommand.state, 'completed');
  assert.equal(app.viewModel().aiCommand.result.execution.actions[0].type, 'navigate');
});

test('L1 task draft is saved to the existing collection and can be undone', async () => {
  const app = application({
    askAi: async () => ({
      state: 'answered', answer: '已生成草案候选', sources: [],
      actions: [{ type: 'save_task_draft', title: '核验商家日报', description: '先核验日期与商家 ID。' }],
    }),
  });
  await app.submitAiCommand('保存为任务草案');
  const saved = await app.executeAiCommandAction(0);
  assert.equal(saved.level, 'L1');
  assert.equal(app.viewModel().tasks.length, 1);
  assert.equal(app.viewModel().tasks[0].title, '核验商家日报');
  assert.equal(app.viewModel().aiCommand.undo.recordId, app.viewModel().tasks[0].id);
  app.undoAiCommandAction();
  assert.equal(app.viewModel().tasks.length, 0);
  assert.equal(app.viewModel().aiCommand.undo, null);
});

test('L2 action is preview-only and remains pending explicit confirmation', async () => {
  const app = application({
    askAi: async () => ({
      state: 'answered', answer: '需要确认', sources: [],
      actions: [{ type: 'feishu_write', target: '04.03 任务管理', changes: { title: '跟进商家' }, impact: '新增一条记录' }],
    }),
  });
  await app.submitAiCommand('把任务写入飞书');
  const preview = await app.executeAiCommandAction(0);
  assert.equal(preview.status, 'preview_required');
  assert.equal(app.viewModel().aiCommand.state, 'preview_required');
  assert.equal(app.viewModel().tasks.length, 0);
  assert.equal(app.viewModel().aiCommand.preview.target, '04.03 任务管理');
});

test('failed AI request keeps the user input and exposes only a safe error', async () => {
  const app = application({ askAi: async () => { throw new Error('secret_internal_stack'); } });
  await assert.rejects(() => app.submitAiCommand('保留这段输入'), /ai_command_failed/);
  assert.equal(app.viewModel().aiCommand.input, '保留这段输入');
  assert.equal(app.viewModel().aiCommand.state, 'failed');
  assert.equal(app.viewModel().aiCommand.error, 'AI 暂时不可用，请稍后重试。');
  assert.doesNotMatch(JSON.stringify(app.viewModel().aiCommand), /secret_internal_stack/);
});
