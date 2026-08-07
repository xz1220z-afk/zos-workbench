import { escapeHtml, renderState } from './view-utils.mjs?v=2.0.3';

const AUTHORITY = {
  business_fact: '飞书事实', knowledge_metadata: '知识元数据', intelligence_candidate: '情报候选',
  user_action: '本人行动', private_life: '个人私有', content_work: '内容工作',
  agent_record: 'Agent 记录', content_asset: '素材资产',
};

export function render(container, viewModel = {}) {
  if (!container) return;
  const results = viewModel.searchResults || [];
  container.innerHTML = `<form class="global-search" id="globalSearchForm"><label for="globalSearchInput">搜索工作台</label><div><input id="globalSearchInput" name="query" value="${escapeHtml(viewModel.searchQuery || '')}" placeholder="搜索项目、商家、知识、内容、Agent 和行动…" autocomplete="off"><button class="v13-action v13-action-primary">搜索</button></div><p>结果会明确标注事实源、知识元数据、内容工作或个人私有内容。</p></form>
    ${viewModel.searchQuery ? (results.length ? `<div class="search-result-list">${results.map((item) => `<article><span class="source-pill">${escapeHtml(AUTHORITY[item.authority] || item.authority)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.subtitle || item.source)}</p></article>`).join('')}</div>` : renderState('empty', '搜索结果')) : renderState('empty', '搜索关键词')}`;
}
