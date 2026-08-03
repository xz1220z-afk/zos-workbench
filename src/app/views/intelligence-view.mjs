import { escapeHtml, renderState } from './view-utils.mjs';

const COMPANY_LABELS = { wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', ceo: 'CEO' };

function sourceLink(value) {
  try {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return `<a class="v13-action" href="${escapeHtml(url.toString())}" target="_blank" rel="noopener noreferrer">查看来源</a>`;
  } catch { return ''; }
}

function card(item) {
  const companies = (item.relevantCompanies || []).map((company) => COMPANY_LABELS[company] || company).join(' · ') || '待判断';
  return `<article class="intelligence-card" data-intelligence-id="${escapeHtml(item.externalId)}">
    <div class="intelligence-card-head"><span class="source-pill">${escapeHtml(item.sourceName)}</span><span class="v13-chip">${escapeHtml(companies)}</span></div>
    <h3>${escapeHtml(item.title)}</h3>
    <p class="intelligence-fact"><strong>事实</strong>${escapeHtml(item.factSummary)}</p>
    <p><strong>影响</strong>${escapeHtml(item.impactAnalysis || '待人工判断')}</p>
    <p><strong>建议</strong>${escapeHtml(item.suggestedAction || '暂无建议动作')}</p>
    <footer><span>可信度 ${escapeHtml(item.credibility)} · 评分 ${escapeHtml(item.score ?? '—')}</span><span>${escapeHtml(item.publishedAt?.slice(0, 10) || item.capturedAt?.slice(0, 10) || '时间待核对')}</span></footer>
    <div class="intelligence-actions">${sourceLink(item.sourceUrl)}<button class="v13-action" data-intelligence-status="read" data-intelligence-id="${escapeHtml(item.externalId)}">标记已读</button><button class="v13-action v13-action-primary" data-intelligence-status="actioned" data-intelligence-id="${escapeHtml(item.externalId)}">转为行动</button></div>
  </article>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const items = viewModel.intelligence || [];
  const filter = viewModel.intelligenceCompany || 'all';
  const tabs = [['all', '今日必看'], ['wanjia', '万嘉'], ['huahuo', '花火'], ['lingli', '玲丽'], ['ceo', 'CEO']];
  container.innerHTML = `<div class="intelligence-toolbar">
      <div class="filter-tabs" role="tablist">${tabs.map(([key, label]) => `<button class="filter-tab ${filter === key ? 'active' : ''}" data-intelligence-company="${key}">${label}</button>`).join('')}</div>
      <button class="v13-action" data-refresh-intelligence>↻ 刷新私有情报</button>
    </div>
    <div class="intelligence-source-note">来源：飞书 ZOS 情报候选池 + AI HOT 公开精选 / Supabase 私有缓存 · 自动补采最近 24 小时，只保存摘要与判断，不保存文章正文</div>
    ${items.length ? `<div class="intelligence-grid">${items.map(card).join('')}</div>` : renderState(viewModel.intelligenceState || 'empty', '每日行业情报')}`;
}
