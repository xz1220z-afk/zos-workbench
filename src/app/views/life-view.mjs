import { escapeHtml, renderState } from './view-utils.mjs?v=2.0.0';

export function render(container, viewModel = {}) {
  if (!container) return;
  const summary = viewModel.lifeSummary || [];
  const items = viewModel.life || [];
  const importantDates = viewModel.importantDates?.life || [];
  const dateRows = importantDates.length ? `<div class="v13-list">${importantDates.slice(0, 6).map((item) => `<div class="v13-row"><div><strong>${escapeHtml(item.title)}</strong><div class="v13-meta">${escapeHtml(item.occurrence)} · 仅自己可见</div></div><span class="v13-chip">${item.days === 0 ? '今天' : `${item.days} 天`}</span></div>`).join('')}</div>` : renderState('empty', '重要日子');
  const drawer = viewModel.importantDatesPanel === 'life' ? `<aside class="important-dates-drawer" role="dialog" aria-modal="true" aria-label="全部重要日子"><header><div><small>仅自己可见</small><h2>重要日子</h2></div><button data-important-dates-close aria-label="关闭">×</button></header>${dateRows}<footer><button class="v13-action v13-action-primary" data-countdown-capture>＋ 新增重要日子</button></footer></aside><div class="task-drawer-backdrop" data-important-dates-close></div>` : '';
  container.innerHTML = `<div class="life-hero"><div><span class="v14-kicker">LIFE OS · 仅自己可见</span><h2>把生活安排好，工作才有稳定的能量</h2><p>工作端只会看到私人日程的忙碌占位，不会看到标题、备注和个人财务。</p></div><button class="v13-action v13-action-primary" data-life-capture>＋ 记录生活事项</button></div>
    <div class="life-area-grid">${summary.map((area) => `<article class="life-area-card"><span>${escapeHtml(area.icon)}</span><h3>${escapeHtml(area.label)}</h3><strong>${area.open}</strong><p>待处理 / ${area.count} 条记录</p></article>`).join('')}</div>
    <div class="v14-main-grid life-dashboard-grid"><div class="v14-section"><div class="v14-section-head"><h3>近期生活安排</h3><span>私有</span></div>${items.length ? `<div class="v13-list">${items.slice(0, 8).map((item) => `<div class="v13-row"><div><strong>${escapeHtml(item.title)}</strong><div class="v13-meta">${escapeHtml(item.area || '生活')} · ${escapeHtml(item.startAt?.slice(0, 16).replace('T', ' ') || '未设时间')}</div></div><span class="v13-chip">${escapeHtml(item.status || '待处理')}</span></div>`).join('')}</div>` : renderState('empty', '生活事项')}</div><div class="v14-section"><div class="v14-section-head"><h3>🎈 重要日子</h3><button class="v13-action" data-important-dates-open="life">查看全部</button></div>${dateRows}</div></div>${drawer}`;
}
