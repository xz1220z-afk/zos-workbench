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

test('daily briefing makes company coverage and source freshness visible', () => {
  const container = { innerHTML: '' };
  render(container, {
    intelligenceCompany: 'all',
    intelligenceFetchedAt: '2026-08-03T08:00:00.000Z',
    intelligenceSources: {
      intelligence_feishu: { state: 'synced', count: 8 },
      intelligence_aihot: { state: 'synced', count: 4 },
      intelligence_cache: { state: 'synced', count: 12 },
    },
    intelligence: [{
      externalId: 'aihot:daily', title: '本地生活平台规则更新', sourceName: 'AI HOT',
      sourceUrl: 'https://aihot.virxact.com/items/daily', factSummary: '规则发生变化。',
      impactAnalysis: '万嘉需核对在投门店素材。', suggestedAction: '今天完成素材检查。',
      credibility: 'medium', score: 88, relevantCompanies: ['wanjia', 'ceo'],
      capturedAt: '2026-08-03T07:30:00.000Z', publishedAt: '2026-08-03T07:00:00.000Z',
    }],
  });

  assert.match(container.innerHTML, /每日行业情报/);
  assert.match(container.innerHTML, /万嘉 1/);
  assert.match(container.innerHTML, /花火 0/);
  assert.match(container.innerHTML, /玲丽 0/);
  assert.match(container.innerHTML, /飞书候选池/);
  assert.match(container.innerHTML, /AI HOT/);
  assert.match(container.innerHTML, /已同步 4 条/);
  assert.match(container.innerHTML, /更新于/);
});

test('intelligence workbench renders combined filters, sort, result count and ignore action', () => {
  const container = { innerHTML: '' };
  render(container, {
    intelligenceFilters: { company: 'all', source: 'all', credibility: 'all', status: 'all', age: 'all', search: '', sortBy: 'newest' },
    intelligenceTotal: 12,
    intelligence: [{
      externalId: 'new-1', title: '最新平台规则', sourceName: '平台公告', sourceUrl: '',
      factSummary: '规则更新', credibility: 'high', status: 'candidate', relevantCompanies: ['wanjia'],
      capturedAt: '2026-08-07T08:00:00Z',
    }],
  });
  assert.match(container.innerHTML, /data-intelligence-search/);
  assert.match(container.innerHTML, /data-intelligence-filter="source"/);
  assert.match(container.innerHTML, /data-intelligence-filter="credibility"/);
  assert.match(container.innerHTML, /data-intelligence-filter="status"/);
  assert.match(container.innerHTML, /data-intelligence-filter="age"/);
  assert.match(container.innerHTML, /data-intelligence-sort/);
  assert.match(container.innerHTML, /最新优先/);
  assert.match(container.innerHTML, /1 \/ 12 条/);
  assert.match(container.innerHTML, /data-intelligence-reset/);
  assert.match(container.innerHTML, /data-intelligence-status="ignored"/);
  assert.match(container.innerHTML, /data-intelligence-open="new-1"/);
});
