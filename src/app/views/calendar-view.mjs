import { escapeHtml } from './view-utils.mjs';

const COMPANY_LABELS = { wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', life: '个人', ceo: 'CEO' };

export function render(container, viewModel = {}) {
  if (!container) return;
  const events = viewModel.calendar || [];
  const conflicts = viewModel.calendarConflicts || [];
  const currentView = viewModel.calendarView || 'week';
  const externalCalendarState = viewModel.externalCalendarState || 'pending_configuration';
  const emptyState = externalCalendarState === 'synced'
    ? '<div class="v13-state" data-state="empty">飞书日历已连接，当前时间范围内没有可见日程。</div>'
    : '<div class="v13-state" data-state="pending_configuration">外部日历尚未配置；本地任务与项目节点仍会正常显示。</div>';
  container.innerHTML = `<div class="calendar-toolbar"><div class="workspace-switch" role="group" aria-label="日历视图"><button class="${currentView === 'week' ? 'active' : ''}" data-calendar-view="week">周</button><button class="${currentView === 'day' ? 'active' : ''}" data-calendar-view="day">日</button><button class="${currentView === 'month' ? 'active' : ''}" data-calendar-view="month">月</button></div><div class="calendar-legend"><span data-company="wanjia">万嘉</span><span data-company="huahuo">花火</span><span data-company="lingli">玲丽</span><span data-company="life">个人</span></div></div>
    ${conflicts.length ? `<div class="calendar-conflict">发现 ${conflicts.length} 组时间冲突，请优先调整。</div>` : ''}
    ${events.length ? `<div class="calendar-grid">${events.map((event) => `<article class="calendar-event" data-company="${escapeHtml(event.company)}"><time>${escapeHtml(event.startAt.slice(5, 16).replace('T', ' '))}</time><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(COMPANY_LABELS[event.company] || event.company)} · ${escapeHtml(event.source || '本地')}</span></article>`).join('')}</div>` : emptyState}`;
}
