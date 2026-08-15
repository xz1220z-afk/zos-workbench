import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { render as renderDashboard } from '../src/app/views/dashboard-view.mjs';
import { renderAiCommandHtml } from '../src/app/views/ai-command-view.mjs';

function dashboardFixture(aiCommand = {}) {
  return {
    state: 'ready', decisions: [], importantDates: { work: [] }, todayTop3: [],
    autoRefresh: {}, companyOperating: {}, mustRead: [], health: [], calendar: [], weather: {},
    reminderQueue: [], gaps: [], calendarConflicts: [], sources: {}, intelligenceState: 'ready',
    aiCommand: {
      input: '', scope: 'auto', state: 'idle', voice: { supported: true, state: 'idle' },
      result: null, preview: null, undo: null, ...aiCommand,
    },
  };
}

test('work homepage renders the AI command surface before every business module', () => {
  const root = { innerHTML: '' };
  renderDashboard(root, dashboardFixture());
  const ai = root.innerHTML.indexOf('data-ai-command-form');
  const hero = root.innerHTML.indexOf('data-home-presence="work"');
  const kpis = root.innerHTML.indexOf('v14-kpi-grid');
  assert.ok(ai >= 0);
  assert.ok(ai < hero);
  assert.ok(ai < kpis);
  assert.match(root.innerHTML, /按住说话或点击麦克风/);
  assert.match(root.innerHTML, /不持续监听/);
});

test('structured OpenAI result keeps evidence and judgment visibly separate', () => {
  const html = renderAiCommandHtml(dashboardFixture({
    state: 'completed',
    result: {
      task: '今天万嘉有什么风险', answer: '先核验日报',
      sources: [{ label: '林客日报', date: '2026-08-15' }],
      sections: {
        facts: ['数据日期为今天'], inference: ['可能存在延迟'], advice: ['先核验商家 ID'],
        pending: ['负责人待确认'], next: ['打开万嘉页面'],
      },
      execution: { level: 'L0', actions: [{ type: 'navigate', target: 'local-life', label: '打开万嘉' }] },
    },
  }).aiCommand);
  for (const label of ['事实', '推断', '建议', '待确认', '下一步']) assert.match(html, new RegExp(label));
  assert.match(html, /林客日报/);
  assert.match(html, /2026-08-15/);
  assert.match(html, /data-ai-command-action="0"/);
});

test('unsupported voice leaves keyboard submission enabled', () => {
  const html = renderAiCommandHtml({
    input: '查询知识库', scope: 'knowledge', state: 'unsupported',
    voice: { supported: false, state: 'unsupported' }, result: null,
  });
  assert.match(html, /当前浏览器不支持语音/);
  assert.match(html, /name="task"/);
  assert.doesNotMatch(html, /data-ai-command-submit[^>]*disabled/);
});

test('L2 preview names the exact target, impact, test and rollback without an execution claim', () => {
  const html = renderAiCommandHtml({
    input: '写入飞书', scope: 'wanjia', state: 'preview_required', voice: { supported: true, state: 'idle' },
    preview: {
      type: 'feishu_write', target: '04.03 任务管理', changes: { title: '跟进商家' },
      impact: '新增一条记录', testPlan: '回读记录', rollback: '删除新增记录',
    },
  });
  assert.match(html, /等待你的确认/);
  assert.match(html, /04\.03 任务管理/);
  assert.match(html, /新增一条记录/);
  assert.match(html, /回读记录/);
  assert.match(html, /删除新增记录/);
  assert.doesNotMatch(html, /已执行|执行成功/);
});

test('command surface uses responsive touch targets and reduced-motion safety', async () => {
  const css = await readFile(new URL('../assets/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.ai-command-mic[\s\S]{0,400}min-width:\s*(?:4[89]|[5-9]\d|[1-9]\d{2,})px/);
  assert.match(css, /\.ai-command-mic[\s\S]{0,450}min-height:\s*48px/);
  assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*\.ai-command/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.ai-command/);
});
