import { escapeHtml, renderState } from './view-utils.mjs?v=2.1.0';

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
  const workflowActions = (() => {
    if (item.status === 'ignored') return `<button class="v13-action" data-intelligence-status="read" data-intelligence-id="${escapeHtml(item.externalId)}">恢复</button>`;
    if (item.status === 'actioned' || item.status === 'knowledge_pending') return '';
    return `${item.status === 'candidate' ? `<button class="v13-action" data-intelligence-status="read" data-intelligence-id="${escapeHtml(item.externalId)}">标记已读</button>` : ''}<button class="v13-action v13-action-quiet" data-intelligence-status="ignored" data-intelligence-id="${escapeHtml(item.externalId)}">忽略</button><button class="v13-action v13-action-primary" data-intelligence-status="actioned" data-intelligence-id="${escapeHtml(item.externalId)}">转为行动</button>`;
  })();
  return `<article class="intelligence-card ${item.status === 'candidate' ? 'is-unread' : ''}" data-intelligence-id="${escapeHtml(item.externalId)}">
    <div class="intelligence-card-head"><span class="source-pill">${escapeHtml(item.sourceName)}</span><span class="v13-chip">${escapeHtml(companies)}</span></div>
    <h3>${escapeHtml(item.title)}</h3>
    <p class="intelligence-fact"><strong>事实</strong>${escapeHtml(item.factSummary)}</p>
    <p><strong>影响</strong>${escapeHtml(item.impactAnalysis || '待人工判断')}</p>
    <p><strong>建议</strong>${escapeHtml(item.suggestedAction || '暂无建议动作')}</p>
    <footer><span>可信度 ${escapeHtml(item.credibility)} · 评分 ${escapeHtml(item.score ?? '—')}</span><span>${escapeHtml(item.publishedAt?.slice(0, 10) || item.capturedAt?.slice(0, 10) || '时间待核对')}</span></footer>
    <div class="intelligence-actions">${sourceLink(item.sourceUrl)}${workflowActions}</div>
  </article>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const items = viewModel.intelligence || [];
  const filters = { company: viewModel.intelligenceCompany || 'all', source: 'all', credibility: 'all', status: 'all', age: 'all', search: '', sortBy: 'newest', ...(viewModel.intelligenceFilters || {}) };
  const option = (value, label, current) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`;
  const sourceNames = [...new Set((viewModel.intelligenceAll || items).map((item) => item.sourceName).filter(Boolean))];
  container.innerHTML = `${briefing(items, viewModel.intelligenceFetchedAt, viewModel.intelligenceSources)}
    <div class="intelligence-toolbar intelligence-workbench-toolbar">
      <input type="search" data-intelligence-search value="${escapeHtml(filters.search)}" placeholder="搜索标题、事实、标签或建议">
      <select data-intelligence-filter="company">${option('all', '全部公司', filters.company)}${option('wanjia', '万嘉', filters.company)}${option('huahuo', '花火', filters.company)}${option('lingli', '玲丽', filters.company)}${option('ceo', 'CEO', filters.company)}</select>
      <select data-intelligence-filter="source">${option('all', '全部来源', filters.source)}${sourceNames.map((name) => option(name, name, filters.source)).join('')}</select>
      <select data-intelligence-filter="credibility">${option('all', '全部可信度', filters.credibility)}${option('high', '高可信', filters.credibility)}${option('medium', '中可信', filters.credibility)}${option('low', '低可信', filters.credibility)}</select>
      <select data-intelligence-filter="status">${option('all', '全部状态', filters.status)}${option('candidate', '未读', filters.status)}${option('read', '已读', filters.status)}${option('actioned', '已行动', filters.status)}${option('ignored', '已忽略', filters.status)}</select>
      <select data-intelligence-filter="age">${option('all', '全部时间', filters.age)}${option('1d', '24 小时', filters.age)}${option('3d', '3 天', filters.age)}${option('7d', '7 天', filters.age)}${option('30d', '30 天', filters.age)}</select>
      <select data-intelligence-sort>${option('newest', '最新优先', filters.sortBy)}${option('score', '评分优先', filters.sortBy)}${option('credibility', '可信度优先', filters.sortBy)}</select>
      <button class="v13-action" data-intelligence-reset>重置</button><button class="v13-action" data-refresh-intelligence>↻ 刷新</button>
    </div><div class="intelligence-result-count">${items.length} / ${viewModel.intelligenceTotal ?? items.length} 条</div>
    <div class="intelligence-source-note">来源：飞书 ZOS 情报候选池 + AI HOT 公开精选 / Supabase 私有缓存 · 自动补采最近 24 小时，只保存摘要与判断，不保存文章正文</div>
    ${items.length ? `<div class="intelligence-grid">${items.map(card).join('')}</div>` : renderState(viewModel.intelligenceState || 'empty', '每日行业情报')}`;
}
