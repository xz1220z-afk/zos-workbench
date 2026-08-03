import { calendarLayout } from '../calendar-center.mjs';
import { escapeHtml } from './view-utils.mjs';

const COMPANY_LABELS = { wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', life: '个人', ceo: 'CEO' };
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function eventCard(event) {
  const time = event.allDay ? '全天' : event.startAt.slice(11, 16);
  return `<article class="calendar-event" data-company="${escapeHtml(event.company)}" data-source="${escapeHtml(event.source || 'local')}"><time>${escapeHtml(time)}</time><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(COMPANY_LABELS[event.company] || event.company)} · ${escapeHtml(event.source || '本地')}</span></article>`;
}

function renderGrid(layout) {
  if (layout.view === 'list') return `<div class="calendar-list">${layout.groups.map((group) => `<section><h3>${escapeHtml(group.date)}</h3>${group.events.map(eventCard).join('')}</section>`).join('')}</div>`;
  const className = layout.view === 'month' ? 'calendar-month-grid' : `calendar-${layout.view}-timeline`;
  return `<div class="${className}">${layout.days.map((day, index) => `<section class="calendar-day ${day.inMonth === false ? 'outside-month' : ''}"><header><span>${layout.view === 'week' ? `周${WEEK_LABELS[index]}` : ''}</span><strong>${escapeHtml(day.date.slice(5))}</strong></header><div>${day.events.map(eventCard).join('') || '<span class="calendar-day-empty">无安排</span>'}</div></section>`).join('')}</div>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const events = viewModel.calendar || [];
  const conflicts = viewModel.calendarConflicts || [];
  const currentView = viewModel.calendarView || 'week';
  const externalCalendarState = viewModel.externalCalendarState || 'pending_configuration';
  const layout = viewModel.calendarLayout || calendarLayout(events, {
    view: currentView, anchor: viewModel.calendarAnchor || new Date().toISOString(),
  });
  const emptyState = externalCalendarState === 'synced'
    ? '<div class="v13-state" data-state="empty">飞书日历已连接，当前时间范围内没有可见日程。</div>'
    : '<div class="v13-state" data-state="pending_configuration">外部日历尚未配置；本地任务、倒数日与专注记录仍会正常显示。</div>';
  container.innerHTML = `<div class="calendar-toolbar"><div class="workspace-switch" role="group" aria-label="日历视图">${['day', 'week', 'month', 'list'].map((view) => `<button class="${currentView === view ? 'active' : ''}" data-calendar-view="${view}">${{ day: '日', week: '周', month: '月', list: '列表' }[view]}</button>`).join('')}</div><div class="calendar-layer-filters"><label><input type="checkbox" data-calendar-layer="countdown" ${viewModel.showCountdowns === false ? '' : 'checked'}>倒数日</label><label><input type="checkbox" data-calendar-layer="focus" ${viewModel.showFocus ? 'checked' : ''}>专注记录</label></div><button class="v13-action" data-calendar-capture>＋ 新建日程</button><button class="v13-action" data-countdown-capture>＋ 倒数日</button></div>
    ${conflicts.length ? `<div class="calendar-conflict">发现 ${conflicts.length} 组时间冲突，请优先调整。</div>` : ''}
    ${events.length ? renderGrid(layout) : emptyState}`;
}
