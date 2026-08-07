import { escapeHtml, renderState } from './view-utils.mjs?v=2.0.2';

const COMPANY_LABELS = { wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', ceo: 'CEO' };
const SOURCE_LABELS = {
  intelligence_feishu: '飞书候选池',
  intelligence_aihot: 'AI HOT',
  intelligence_cache: '私有缓存',
};

function displayTime(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '尚未记录';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function statusText(value = {}) {
  if (value.state === 'synced') return `已同步 ${Number(value.count) || 0} 条`;
  if (value.state === 'failed') return `更新失败 · ${value.safeCode || '待重试'}`;
  return '使用缓存';
}

function briefing(items = [], fetchedAt, sources = {}) {
  const coverage = Object.entries(COMPANY_LABELS).map(([key, label]) => ({
    key, label, count: items.filter((item) => (item.relevantCompanies || []).includes(key)).length,
  }));
  return `<section class="intelligence-daily-brief">
    <div><span class="v13-eyebrow">DAILY INTELLIGENCE</span><h2>每日行业情报</h2><p>只展示最近 72 小时的真实候选；先看事实，再决定是否转行动。</p></div>
    <div class="intelligence-coverage">${coverage.map((item) => `<span><strong>${escapeHtml(item.label)} ${item.count}</strong><small>条相关</small></span>`).join('')}</div>
    <div class="intelligence-source-health">${Object.entries(SOURCE_LABELS).map(([key, label]) => `<span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(statusText(sources[key]))}</small></span>`).join('')}<span><strong>本次读取</strong><small>更新于 ${escapeHtml(displayTime(fetchedAt))}</small></span></div>
  </section>`;
}

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
  container.innerHTML = `${briefing(items, viewModel.intelligenceFetchedAt, viewModel.intelligenceSources)}
    <div class="intelligence-toolbar">
      <div class="filter-tabs" role="tablist">${tabs.map(([key, label]) => `<button class="filter-tab ${filter === key ? 'active' : ''}" data-intelligence-company="${key}">${label}</button>`).join('')}</div>
      <button class="v13-action" data-refresh-intelligence>↻ 刷新私有情报</button>
    </div>
    <div class="intelligence-source-note">来源：飞书 ZOS 情报候选池 + AI HOT 公开精选 / Supabase 私有缓存 · 自动补采最近 24 小时，只保存摘要与判断，不保存文章正文</div>
    ${items.length ? `<div class="intelligence-grid">${items.map(card).join('')}</div>` : renderState(viewModel.intelligenceState || 'empty', '每日行业情报')}`;
}
