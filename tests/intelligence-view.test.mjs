import test from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/app/views/intelligence-view.mjs';

test('daily intelligence shows source channels and a safe readable link', () => {
  const container = { innerHTML: '' };
  render(container, {
    intelligenceCompany: 'all',
    intelligence: [{
      externalId: 'aihot:1', title: 'AI 视频产品更新', sourceName: 'AI HOT',
      sourceUrl: 'https://aihot.virxact.com/items/1', factSummary: '真实摘要',
      impactAnalysis: '', suggestedAction: '', credibility: 'medium', score: 80,
      relevantCompanies: ['ceo', 'huahuo'], capturedAt: '2026-08-03T08:00:00.000Z',
    }],
  });

  assert.match(container.innerHTML, /飞书 ZOS 情报候选池/);
  assert.match(container.innerHTML, /AI HOT 公开精选/);
  assert.match(container.innerHTML, /href="https:\/\/aihot\.virxact\.com\/items\/1"/);
  assert.match(container.innerHTML, /target="_blank"/);
  assert.match(container.innerHTML, /rel="noopener noreferrer"/);
  assert.match(container.innerHTML, /查看来源/);
});

test('unsafe source protocols are never rendered as links', () => {
  const container = { innerHTML: '' };
  render(container, {
    intelligence: [{
      externalId: 'x', title: '候选', sourceName: '待核对', sourceUrl: 'javascript:alert(1)',
      factSummary: '摘要', credibility: 'low', relevantCompanies: [], capturedAt: '2026-08-03T08:00:00.000Z',
    }],
  });
  assert.doesNotMatch(container.innerHTML, /javascript:/i);
  assert.doesNotMatch(container.innerHTML, /查看来源/);
});
