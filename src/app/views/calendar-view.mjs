import { calendarLayout } from '../calendar-center.mjs?v=2.10.0';
import { calendarEventCapabilities } from '../calendar-event.mjs?v=2.10.0';
import { escapeHtml } from './view-utils.mjs?v=2.10.0';

const COMPANY_LABELS = { wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', life: '个人', ceo: 'CEO' };
const SOURCE_LABELS = {
  user_calendar: 'ZOS 日程', feishu: '飞书', feishu_calendar: '飞书', ics: '订阅日历',
  local_task: '任务', business_project: '项目', intelligence: '情报', countdown: '倒数日', focus: '专注',
};
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function eventCard(event, syncStates = {}) {
  const time = event.allDay ? '全天' : String(event.startAt || '').slice(11, 16);
  const capabilities = calendarEventCapabilities(event);
  const syncState = syncStates[event.id] || (capabilities.kind === 'external' ? 'readonly' : 'pending');
  return `<article class="calendar-event" data-company="${escapeHtml(event.company || 'ceo')}" data-source="${escapeHtml(event.source || 'local')}" data-calendar-event="${escapeHtml(event.id)}" ${capabilities.drag ? 'draggable="true"' : ''}>
    <button type="button" class="calendar-event-open" data-calendar-select="${escapeHtml(event.id)}">
      <time>${escapeHtml(time)}</time>
      <strong>${escapeHtml(event.title)}</strong>
      <span>${escapeHtml(COMPANY_LABELS[event.company] || event.company || 'CEO')} · ${escapeHtml(SOURCE_LABELS[event.source] || event.source || '本地')} · <i data-sync-state="${escapeHtml(syncState)}">${escapeHtml({ pending: '待同步', synced: '已同步', conflict: '有冲突', readonly: '只读' }[syncState] || '待同步')}</i></span>
    </button>
    ${capabilities.drag ? `<button type="button" class="calendar-reschedule" data-calendar-reschedule="${escapeHtml(event.id)}">改期</button>` : ''}
  </article>`;
}

function renderGrid(layout, selection = {}, syncStates = {}) {
  if (layout.view === 'list') {
    return `<div class="calendar-list">${layout.groups.map((group) => `<section><h3>${escapeHtml(group.date)}</h3>${group.events.map((event) => eventCard(event, syncStates)).join('')}</section>`).join('')}</div>`;
  }
  const className = layout.view === 'month' ? 'calendar-month-grid' : `calendar-${layout.view}-timeline`;
  selection ||= {};
  const startDate = selection.startDate || '';
  const endDate = selection.endDate || startDate;
  return `<div class="${className}">${layout.days.map((day, index) => {
    const selected = startDate && day.date >= (startDate < endDate ? startDate : endDate)
      && day.date <= (startDate < endDate ? endDate : startDate);
    const dayClass = ['calendar-day', selected ? 'is-selected' : '', day.inMonth === false ? 'outside-month' : ''].filter(Boolean).join(' ');
    return `<section class="${dayClass}" data-calendar-select-date="${escapeHtml(day.date)}" tabindex="0" data-calendar-drop-date="${escapeHtml(day.date)}"><header><span>${layout.view === 'week' ? `周${WEEK_LABELS[index]}` : ''}</span><strong>${escapeHtml(day.date.slice(5))}</strong></header><div>${day.events.map((event) => eventCard(event, syncStates)).join('') || '<span class="calendar-day-empty">无安排</span>'}</div></section>`;
  }).join('')}</div>`;
}

function renderViewSwitch(currentView) {
  return `<div class="workspace-switch calendar-view-switch" role="group" aria-label="日历视图">${['day', 'week', 'month', 'list'].map((view) => `<button class="${currentView === view ? 'active' : ''}" data-calendar-view="${view}">${{ day: '日', week: '周', month: '月', list: '列表' }[view]}</button>`).join('')}</div>`;
}

function reminderStatus(state) {
  const labels = {
    enabled: '关闭页面提醒已开启',
    permission_required: '关闭页面提醒未开启',
    denied: '浏览器通知已拒绝',
    unsupported: '当前设备不支持关闭页面提醒',
    pending_configuration: '推送服务待配置',
  };
  const action = state === 'permission_required'
    ? '<button data-enable-reminders>开启关闭页面提醒</button>'
    : '';
  return `<span class="calendar-reminder-state" data-state="${escapeHtml(state || 'pending_configuration')}">${escapeHtml(labels[state] || labels.pending_configuration)}${action}</span>`;
}

function externalSourceStatus(state, fetchedAt) {
  const labels = {
    synced: '外部日历已同步',
    cached: '外部日历暂用缓存',
    pending_configuration: '外部日历待配置',
    feishu_permission_denied: '飞书日历权限待检查',
    authentication_required: '登录后同步外部日历',
    source_timeout: '外部日历连接超时',
    source_refresh_failed: '外部日历读取失败',
  };
  const updated = fetchedAt ? ` · ${String(fetchedAt).slice(0, 16).replace('T', ' ')}` : '';
  return `<span class="calendar-source-state" data-state="${escapeHtml(state || 'pending_configuration')}">${escapeHtml(labels[state] || labels.source_refresh_failed)}${escapeHtml(updated)}</span>`;
}

function renderDetail(viewModel) {
  const event = (viewModel.calendar || []).find((row) => row.id === viewModel.selectedCalendarId);
  if (!event) return '';
  const capabilities = calendarEventCapabilities(event);
  const syncState = viewModel.calendarSyncStates?.[event.id] || (capabilities.kind === 'external' ? 'readonly' : 'pending');
  return `<aside class="calendar-drawer calendar-detail-drawer" data-calendar-panel="detail" aria-label="日程详情">
    <header><div><small>${escapeHtml(SOURCE_LABELS[event.source] || event.source || '本地')} · <span data-sync-state="${escapeHtml(syncState)}">${escapeHtml({ pending: '待同步', synced: '已同步', conflict: '同步冲突', readonly: '只读来源' }[syncState] || '待同步')}</span></small><h2>${escapeHtml(event.title)}</h2></div><button data-calendar-close aria-label="关闭">×</button></header>
    <dl><dt>开始</dt><dd>${escapeHtml(localDateTime(event.startAt).replace('T', ' '))}</dd><dt>结束</dt><dd>${escapeHtml(localDateTime(event.endAt).replace('T', ' '))}</dd><dt>归属</dt><dd>${escapeHtml(COMPANY_LABELS[event.company] || event.company || 'CEO')}</dd></dl>
    ${event.notes ? `<p class="calendar-notes">${escapeHtml(event.notes)}</p>` : ''}
    <footer>
      ${capabilities.kind === 'task' ? `<button data-calendar-task-toggle="${escapeHtml(event.id)}">${['done', 'completed'].includes(event.status) ? '设为待办' : '完成任务'}</button><button data-calendar-task-edit="${escapeHtml(event.id)}">编辑</button><button data-calendar-task-copy="${escapeHtml(event.id)}">复制</button><button data-calendar-task-reschedule="${escapeHtml(event.id)}">改期</button><button class="danger" data-calendar-task-delete="${escapeHtml(event.id)}">删除</button>` : ''}
      ${capabilities.kind === 'calendar' && capabilities.edit ? `<button data-calendar-edit="${escapeHtml(event.id)}">编辑</button>` : ''}
      ${capabilities.kind === 'calendar' && capabilities.remove ? `<button class="danger" data-calendar-delete="${escapeHtml(event.id)}">删除</button>` : ''}
      ${capabilities.kind !== 'task' && capabilities.copy ? `<button data-calendar-copy="${escapeHtml(event.id)}">复制</button>` : ''}
      ${capabilities.openSource ? `<a data-calendar-open-source href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">打开来源</a>` : ''}
    </footer>
  </aside>`;
}

function option(value, selected, label) {
  return `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`;
}

function renderEditor(viewModel) {
  const draft = viewModel.calendarDraft || {};
  const anchor = viewModel.calendarAnchor || new Date().toISOString().slice(0, 10);
  const kind = viewModel.calendarDraftKind || draft.kind || (draft.source === 'local_task' ? 'task' : 'calendar');
  const startAt = localDateTime(draft.startAt) || `${anchor}T09:00`;
  const endAt = localDateTime(draft.endAt) || `${anchor}T10:00`;
  const dueAt = localDateTime(draft.dueAt) || endAt;
  const frequency = draft.recurrenceRule?.frequency || 'none';
  const kindSwitch = draft.id ? '' : `<div class="calendar-kind-switch" role="group" aria-label="安排类型"><button type="button" data-calendar-kind="task" class="${kind === 'task' ? 'active' : ''}">任务</button><button type="button" data-calendar-kind="calendar" class="${kind === 'calendar' ? 'active' : ''}">日程</button></div>`;
  if (kind === 'task') {
    return `<aside class="calendar-drawer calendar-editor-drawer" data-calendar-panel="editor" aria-label="${draft.id ? '编辑任务' : '新增安排'}">
      <header><div><small>所选日期 ${escapeHtml(startAt.slice(0, 10))} — ${escapeHtml(dueAt.slice(0, 10))}</small><h2>${draft.id ? '编辑任务' : '新增安排'}</h2></div><button data-calendar-close aria-label="关闭">×</button></header>
      ${kindSwitch}
      <form data-calendar-form>
        <input type="hidden" name="scheduleKind" value="task">
        ${draft.id ? `<input type="hidden" name="id" value="${escapeHtml(draft.id)}">` : ''}
        <label>标题<input name="title" required maxlength="120" value="${escapeHtml(draft.title || '')}"></label>
        <label>说明<textarea name="description" rows="3" maxlength="2000">${escapeHtml(draft.description || '')}</textarea></label>
        <div class="calendar-form-row"><label>开始<input type="datetime-local" name="startAt" required value="${escapeHtml(startAt)}"></label><label>截止<input type="datetime-local" name="dueAt" required value="${escapeHtml(dueAt)}"></label></div>
        <label class="calendar-check"><input type="checkbox" name="allDay" ${draft.allDay === false ? '' : 'checked'}>全天任务</label>
        <div class="calendar-form-row"><label>归属<select name="company">${option('ceo', draft.company || 'ceo', 'CEO')}${option('wanjia', draft.company, '万嘉')}${option('huahuo', draft.company, '花火')}${option('lingli', draft.company, '玲丽')}${option('life', draft.company, '个人')}</select></label><label>优先级<select name="priority">${option('0', String(draft.priority ?? '2'), '无')}${option('1', String(draft.priority ?? '2'), '低')}${option('2', String(draft.priority ?? '2'), '普通')}${option('3', String(draft.priority ?? '2'), '高')}</select></label></div>
        <div class="calendar-form-row"><label>项目<input name="projectId" value="${escapeHtml(draft.projectId || '')}" placeholder="可选"></label><label>负责人<input name="assigneeIds" value="${escapeHtml((draft.assigneeIds || []).join(','))}" placeholder="多人用逗号分隔"></label></div>
        <div class="calendar-form-row"><label>提醒时间<input type="datetime-local" name="reminderAt" value="${escapeHtml(localDateTime(draft.reminderAt))}"></label><label>重复<input name="recurrence" value="${escapeHtml(draft.recurrence || '')}" placeholder="例如 weekly"></label></div>
        <label>子任务（每行一项）<textarea name="subtasks" rows="3">${escapeHtml((draft.subtasks || []).map((item) => item.title || item).join('\n'))}</textarea></label>
        <label class="calendar-check"><input type="checkbox" name="occupyCalendar" ${draft.occupyCalendar === false ? '' : 'checked'}>在日历中占位</label>
        <p class="calendar-form-error" data-calendar-form-error role="alert">${escapeHtml(viewModel.calendarFormError || '')}</p>
        <footer><button type="button" data-calendar-close>取消</button><button class="primary" type="submit">保存任务</button></footer>
      </form>
    </aside>`;
  }
  return `<aside class="calendar-drawer calendar-editor-drawer" data-calendar-panel="editor" aria-label="${draft.id ? '编辑日程' : '新增安排'}">
    <header><h2>${draft.id ? '编辑日程' : '新增安排'}</h2><button data-calendar-close aria-label="关闭">×</button></header>
    ${kindSwitch}
    <form data-calendar-form>
      <input type="hidden" name="scheduleKind" value="calendar">
      ${draft.id ? `<input type="hidden" name="id" value="${escapeHtml(draft.id)}">` : ''}
      <label>标题<input name="title" required maxlength="120" value="${escapeHtml(draft.title || '')}"></label>
      <div class="calendar-form-row"><label>开始<input type="datetime-local" name="startAt" required value="${escapeHtml(startAt)}"></label><label>结束<input type="datetime-local" name="endAt" required value="${escapeHtml(endAt)}"></label></div>
      <label class="calendar-check"><input type="checkbox" name="allDay" ${draft.allDay ? 'checked' : ''}>全天</label>
      <div class="calendar-form-row"><label>归属<select name="company">${option('ceo', draft.company || 'ceo', 'CEO')}${option('wanjia', draft.company, '万嘉')}${option('huahuo', draft.company, '花火')}${option('lingli', draft.company, '玲丽')}${option('life', draft.company, '个人')}</select></label><label>隐私<select name="privacy">${option('work', draft.privacy || 'work', '工作可见')}${option('private', draft.privacy, '仅显示忙碌')}</select></label></div>
      <div class="calendar-form-row"><label>重复<select name="recurrenceFrequency">${option('none', frequency, '不重复')}${option('daily', frequency, '每天')}${option('weekly', frequency, '每周')}${option('monthly', frequency, '每月')}${option('yearly', frequency, '每年')}</select></label><label>间隔<input type="number" name="recurrenceInterval" min="1" max="365" value="${escapeHtml(draft.recurrenceRule?.interval || 1)}"></label></div>
      <label>提醒（分钟前，逗号分隔）<input name="reminders" value="${escapeHtml((draft.reminders || []).join(','))}" placeholder="15,60"></label>
      <label>备注<textarea name="notes" rows="4" maxlength="2000">${escapeHtml(draft.notes || '')}</textarea></label>
      <p class="calendar-form-error" data-calendar-form-error role="alert">${escapeHtml(viewModel.calendarFormError || '')}</p>
      <footer><button type="button" data-calendar-close>取消</button><button class="primary" type="submit">保存日程</button></footer>
    </form>
  </aside>`;
}

function renderTrash(viewModel) {
  const rows = (viewModel.calendarTrash || []).filter((row) => ['calendar', 'tasks'].includes(row.entity));
  return `<aside class="calendar-drawer calendar-trash-drawer" data-calendar-panel="trash" aria-label="日历回收站"><header><div><small>保留删除记录，恢复后自动同步</small><h2>任务与日程回收站</h2></div><button data-calendar-close aria-label="关闭">×</button></header><div class="calendar-trash-list">${rows.length ? rows.map((row) => `<article><div><strong>${row.entity === 'tasks' ? '任务' : '日程'} · ${escapeHtml(row.title || '未命名')}</strong><small>${escapeHtml(row.deletedAt || '')}</small></div><button data-calendar-restore="${escapeHtml(row.id)}" data-calendar-restore-entity="${escapeHtml(row.entity)}">恢复</button></article>`).join('') : '<p>回收站为空</p>'}</div></aside>`;
}

function renderDeleteConfirm(viewModel) {
  const pending = viewModel.calendarPendingDelete;
  if (!pending) return '';
  const isTask = pending.entity === 'tasks';
  return `<aside class="calendar-drawer calendar-delete-confirm" data-calendar-panel="delete-confirm" role="alertdialog" aria-label="确认删除${isTask ? '任务' : '日程'}"><header><div><small>可在回收站恢复</small><h2>确认删除${isTask ? '任务' : '日程'}？</h2></div><button data-calendar-close aria-label="关闭">×</button></header><p>“${escapeHtml(pending.title || '未命名')}”将从当前设备移除，删除会同步到其他设备。</p><footer><button data-calendar-close>取消</button><button class="danger" data-calendar-confirm-delete>确认删除</button></footer></aside>`;
}

function renderSeriesScope(viewModel) {
  const action = viewModel.calendarPendingMutation?.action === 'delete' ? '删除' : '编辑';
  return `<aside class="calendar-drawer calendar-scope-dialog" data-calendar-panel="series" aria-label="重复日程范围"><header><h2>${action}重复日程</h2><button data-calendar-close aria-label="关闭">×</button></header><p>请选择本次操作影响的范围：</p><div class="calendar-scope-actions"><button data-calendar-series-scope="single">仅此日程</button><button data-calendar-series-scope="future">本次及以后</button><button data-calendar-series-scope="series">整个系列</button></div></aside>`;
}

function renderCalendarPanel(viewModel) {
  if (viewModel.calendarPanel === 'detail') return renderDetail(viewModel);
  if (viewModel.calendarPanel === 'editor') return renderEditor(viewModel);
  if (viewModel.calendarPanel === 'trash') return renderTrash(viewModel);
  if (viewModel.calendarPanel === 'delete-confirm') return renderDeleteConfirm(viewModel);
  if (viewModel.calendarPanel === 'series') return renderSeriesScope(viewModel);
  return '';
}

function renderDaySheet(viewModel, layout) {
  if (!viewModel.calendarDaySheetOpen || !viewModel.calendarSelectedDate) return '';
  const date = viewModel.calendarSelectedDate;
  const day = [...(layout.days || []), ...(layout.groups || [])].find((entry) => entry.date === date);
  const dayEvents = day?.events || [];
  return `<aside class="calendar-drawer calendar-day-sheet" data-calendar-panel="day-sheet" role="dialog" aria-modal="true" aria-labelledby="calendarDaySheetTitle">
    <header><div><small>已选日期</small><h2 id="calendarDaySheetTitle">${escapeHtml(date)}</h2></div><button data-calendar-day-sheet-close aria-label="关闭">×</button></header>
    <div class="calendar-day-sheet-events">${dayEvents.length ? dayEvents.map((event) => eventCard(event, viewModel.calendarSyncStates || {})).join('') : '<p class="calendar-day-empty">当天暂无安排。</p>'}</div>
    <footer><button class="primary" data-calendar-day-create="${escapeHtml(date)}">＋ 新增安排</button></footer>
  </aside><div class="task-drawer-backdrop" data-calendar-day-sheet-close></div>`;
}

export function renderCalendarHtml(viewModel = {}) {
  const events = viewModel.calendarFiltered || viewModel.calendar || [];
  const conflicts = viewModel.calendarConflicts || [];
  const currentView = viewModel.calendarView || 'month';
  const externalCalendarState = viewModel.externalCalendarState || 'pending_configuration';
  const layout = viewModel.calendarLayout || calendarLayout(events, {
    view: currentView,
    anchor: viewModel.calendarAnchor || new Date().toISOString(),
  });
  const emptyState = externalCalendarState === 'synced'
    ? '<div class="v13-state" data-state="empty">当前时间范围没有日程。</div>'
    : '<div class="v13-state" data-state="pending_configuration">外部日历尚未配置；ZOS 本地日程仍可正常使用。</div>';
  return `<div class="calendar-shell">
    ${viewModel.calendarUndoDelete ? `<div class="calendar-undo-banner"><span>已删除：${escapeHtml(viewModel.calendarUndoDelete.title || '未命名')}</span><button data-calendar-undo-delete>撤销</button></div>` : ''}
    <header class="calendar-commandbar">
      <div class="calendar-navigation"><button data-calendar-today>今天</button><button data-calendar-nav="prev" aria-label="上一周期">‹</button><button data-calendar-nav="next" aria-label="下一周期">›</button><input type="date" data-calendar-anchor value="${escapeHtml(viewModel.calendarAnchor || '')}"></div>
      ${renderViewSwitch(currentView)}
      <div class="calendar-command-actions"><button data-calendar-sync>同步当前范围</button><button data-calendar-trash>回收站</button><button class="primary" data-calendar-capture>＋ 新增安排</button></div>
    </header>
    <nav class="calendar-quick-filters" aria-label="日历筛选">${[['all','全部'],['task','任务'],['schedule','日程'],['wanjia','万嘉'],['huahuo','花火'],['lingli','玲丽'],['life','个人']].map(([value, label]) => `<button data-calendar-filter="${value}" class="${(viewModel.calendarFilter || 'all') === value ? 'active' : ''}">${label}</button>`).join('')}</nav>
    <div class="calendar-layer-filters"><label><input type="checkbox" data-calendar-layer="focus" ${viewModel.showFocus ? 'checked' : ''}>专注记录</label><span>重要日期已移至工作首页与生活首页</span>${externalSourceStatus(externalCalendarState, viewModel.externalCalendarFetchedAt)}${reminderStatus(viewModel.notificationState)}<span>${viewModel.calendarSyncState === 'loading' ? '正在同步…' : '本地优先 · 云端同步'}</span></div>
    ${conflicts.length ? `<div class="calendar-conflict">发现 ${conflicts.length} 组时间冲突，请优先调整。</div>` : ''}
    ${renderGrid(layout, viewModel.calendarSelection, viewModel.calendarSyncStates || {})}
    ${events.length ? '' : emptyState}
    ${renderDaySheet(viewModel, layout)}
    ${renderCalendarPanel(viewModel)}
  </div>`;
}

export function render(container, viewModel = {}) {
  if (container) container.innerHTML = renderCalendarHtml(viewModel);
}
