import { escapeHtml, renderState } from './view-utils.mjs?v=2.7.3';

function readingRows(items) {
  return items.length ? items.slice(0, 8).map((item) => `<div class="knowledge-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.sourceType || '网页')} · ${Number(item.progress) || 0}%</small></div><div><button data-reading-progress="${escapeHtml(item.id)}">进度</button><button data-reading-to-card="${escapeHtml(item.id)}">转卡片</button><button data-reading-delete="${escapeHtml(item.id)}">删除</button></div></div>`).join('') : renderState('empty', 'AI 阅读');
}

function cardRows(items) {
  return items.length ? items.slice(0, 8).map((item) => `<div class="knowledge-card"><span>${escapeHtml(item.company || '个人')}</span><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.insight || item.quote || '等待补充理解')}</p><footer><small>来源已保留 · ${escapeHtml(item.reviewStatus || 'pending')}</small><div><button data-knowledge-edit="${escapeHtml(item.id)}">编辑</button>${item.reviewStatus === 'approved' ? '' : `<button data-knowledge-review="${escapeHtml(item.id)}">审核</button>`}<button data-knowledge-delete="${escapeHtml(item.id)}">删除</button></div></footer></div>`).join('') : renderState('empty', '知识卡片');
}

function assetRows(items) {
  return items.length ? items.slice(0, 8).map((item) => `<div class="asset-row"><div class="asset-icon">${item.mediaType === 'video' ? '▶' : '▧'}</div><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.licenseStatus || '授权待确认')} · ${escapeHtml(item.reuseScope || '复用范围待确认')}</small></div><div><button data-asset-edit="${escapeHtml(item.id)}">管理</button><button data-asset-delete="${escapeHtml(item.id)}">删除</button></div></div>`).join('') : renderState('empty', '素材资产');
}

function brainstormRows(items) {
  return items.length ? items.slice(0, 6).map((item) => `<div class="brainstorm-row"><button data-brainstorm-open="${escapeHtml(item.id)}"><span>◎</span><div><strong>${escapeHtml(item.title)}</strong><small>${item.nodes?.length || 0} 个方向 · ${item.selectedNodeId ? '已选方向' : '探索中'}</small></div><b>进入 →</b></button><button data-brainstorm-delete="${escapeHtml(item.id)}">删除</button></div>`).join('') : renderState('empty', '知识头脑风暴');
}

export function render(container, viewModel = {}) {
  if (!container) return;
  container.innerHTML = `<section class="knowledge-workspace-intro"><div><span class="growth-kicker">KNOWLEDGE FLOW</span><h2>阅读 → 理解 → 行动 → 复用</h2><p>只保存来源、划线、你的理解与行动结论，不保存原文正文；正式知识仍进入人工审核。</p></div><div class="knowledge-intro-actions"><button data-reading-capture>＋ 添加阅读</button><button data-brainstorm-capture>＋ 发起头脑风暴</button></div></section>
  <div class="knowledge-workspace-grid">
    <article class="knowledge-panel knowledge-reading"><header><div><span>01</span><h3>AI 阅读</h3></div><small>${viewModel.readingItems?.length || 0} 项</small></header>${readingRows(viewModel.readingItems || [])}</article>
    <article class="knowledge-panel knowledge-cards"><header><div><span>02</span><h3>知识卡片</h3></div><small>${viewModel.knowledgeReview?.length || 0} 待审核</small></header><div class="knowledge-card-grid">${cardRows(viewModel.knowledgeCards || [])}</div></article>
    <article class="knowledge-panel knowledge-assets"><header><div><span>03</span><h3>素材资产</h3></div><button data-asset-capture>＋ 入库</button></header>${assetRows(viewModel.contentAssets || [])}</article>
    <article class="knowledge-panel knowledge-brainstorm"><header><div><span>04</span><h3>知识头脑风暴</h3></div><small>移动端自动切换大纲</small></header>${brainstormRows(viewModel.brainstorms || [])}</article>
  </div>`;
}
