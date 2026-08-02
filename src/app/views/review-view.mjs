import { escapeHtml, renderState } from './view-utils.mjs';

export function render(container, viewModel = {}) {
  if (!container) return;
  const drafts = (viewModel.inbox || []).filter((item) => item.kind === 'review_draft');
  container.innerHTML = `<div class="review-lanes">
    <article><h3>本周经营复盘</h3><p>汇总真实来源状态、目标差距、风险、决策和冲突。</p><button class="v13-action" data-review-draft="weekly_business">生成待审草稿</button></article>
    <article><h3>本月公司复盘</h3><p>万嘉、花火、玲丽分别核对收入、交付、回款与组织问题。</p><button class="v13-action" data-review-draft="monthly_company">生成待审草稿</button></article>
    <article><h3>生活复盘</h3><p>健康、关系、学习和个人安排仅保存在私有空间。</p><button class="v13-action" data-review-draft="life">生成私有草稿</button></article>
  </div><div class="v14-section"><div class="v14-section-head"><h3>待审核复盘</h3><span>不会自动外发</span></div>${drafts.length ? `<div class="v13-list">${drafts.slice(-8).reverse().map((item) => `<div class="v13-row"><strong>${escapeHtml(item.title)}</strong><span class="v13-chip">待审核</span></div>`).join('')}</div>` : renderState('empty', '复盘草稿')}</div>`;
}
