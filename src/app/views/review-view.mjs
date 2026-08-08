import { escapeHtml, renderState } from './view-utils.mjs?v=2.3.1';

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `¥${number.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}` : '—';
}

function contentReview(performance = {}) {
  const metrics = [
    ['已发布', performance.published ?? 0],
    ['播放', performance.views ?? 0],
    ['互动', performance.interactions ?? 0],
    ['有效线索', performance.leads ?? 0],
    ['关联回款', formatMoney(performance.revenue ?? 0)],
  ];
  return `<div class="review-content-metrics">${metrics.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>`;
}

function reviewRows(items, emptyLabel, renderRow) {
  return items.length
    ? `<div class="v13-list">${items.slice(-8).reverse().map(renderRow).join('')}</div>`
    : renderState('empty', emptyLabel);
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const drafts = (viewModel.inbox || []).filter((item) => item.kind === 'review_draft');
  const experiments = viewModel.contentExperiments || [];
  const compounds = viewModel.compoundCandidates || [];
  container.innerHTML = `<div class="review-lanes">
    <article><h3>本周经营复盘</h3><p>汇总真实来源状态、目标差距、风险、决策和冲突。</p><button class="v13-action" data-review-draft="weekly_business">生成待审草稿</button></article>
    <article><h3>本月公司复盘</h3><p>万嘉、花火、玲丽分别核对收入、交付、回款与组织问题。</p><button class="v13-action" data-review-draft="monthly_company">生成待审草稿</button></article>
    <article><h3>生活复盘</h3><p>健康、关系、学习和个人安排仅保存在私有空间。</p><button class="v13-action" data-review-draft="life">生成私有草稿</button></article>
  </div>
  <div class="v14-section"><div class="v14-section-head"><h3>内容表现复盘</h3><span>仅统计真实录入结果</span></div>${contentReview(viewModel.contentPerformance)}</div>
  <div class="review-growth-grid">
    <div class="v14-section"><div class="v14-section-head"><h3>实验结果</h3><span>标题 / 封面 / 开头 / 时间</span></div>${reviewRows(experiments, '待复盘实验', (item) => `<div class="v13-row"><div><strong>${escapeHtml(item.title || '未命名实验')}</strong><small>${escapeHtml(item.variable || '等待设置变量')}</small></div><span class="v13-chip">${item.winnerId ? `胜出 ${escapeHtml(item.winnerId)}` : '采集中'}</span></div>`)}</div>
    <div class="v14-section"><div class="v14-section-head"><h3>资产复利候选</h3><span>审核后再进入长期知识库</span></div>${reviewRows(compounds, '复利候选', (item) => `<div class="v13-row"><div><strong>${escapeHtml(item.title || '未命名候选')}</strong><small>${escapeHtml(item.type || '待分类')}</small></div><span class="v13-chip">${item.status === 'approved' ? '已审核' : '待审核'}</span></div>`)}</div>
  </div>
  <div class="v14-section"><div class="v14-section-head"><h3>待审核复盘</h3><span>不会自动外发</span></div>${reviewRows(drafts, '复盘草稿', (item) => `<div class="v13-row"><strong>${escapeHtml(item.title)}</strong><span class="v13-chip">待审核</span></div>`)}</div>`;
}
