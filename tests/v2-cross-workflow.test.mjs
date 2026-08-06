import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildSearchIndex, searchWorkspace } from '../src/app/search-center.mjs';

const root = new URL('../', import.meta.url);

test('global search indexes content, reading, cards, social insight and agent records', () => {
  const index = buildSearchIndex({
    content: [{ id: 'c1', title: '阳西商家增长脚本', company: 'wanjia' }],
    reading: [{ id: 'r1', title: '婚礼影像趋势', sourceType: 'video' }],
    cards: [{ id: 'k1', title: '招生转化方法', company: 'lingli' }],
    social: [{ id: 's1', claim: '用户在问团购怎么拍', platform: 'douyin' }],
    agentRuns: [{ id: 'a1', objective: '诊断万嘉本周内容', agentId: 'wanjia-growth' }],
  });
  assert.equal(searchWorkspace(index, '商家增长')[0].source, 'content_growth');
  assert.equal(searchWorkspace(index, '婚礼影像')[0].source, 'reading');
  assert.equal(searchWorkspace(index, '招生转化')[0].source, 'knowledge_card');
  assert.equal(searchWorkspace(index, '团购怎么拍')[0].source, 'social_insight');
  assert.equal(searchWorkspace(index, '诊断万嘉')[0].source, 'agent_run');
});

test('v2 heavy workspaces render only for their active route in the browser', async () => {
  const app = await readFile(new URL('src/app.mjs', root), 'utf8');
  assert.match(app, /activePageId/);
  assert.match(app, /activePage === 'content-growth'/);
  assert.match(app, /activePage === 'agent-workbench'/);
  assert.match(app, /activePage === 'zos-brain'/);
  assert.match(app, /activePage === 'intelligence'/);
});
