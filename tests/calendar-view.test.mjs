import test from 'node:test';
import assert from 'node:assert/strict';

import { renderCalendarHtml } from '../src/app/views/calendar-view.mjs';

test('calendar HTML exposes navigation, drawers, source actions and recycle restore', () => {
  const html = renderCalendarHtml({
    calendar: [{
      id: 'local-1', title: '周会', startAt: '2026-08-03T02:00:00.000Z',
      endAt: '2026-08-03T03:00:00.000Z', company: 'ceo', source: 'user_calendar',
    }],
    calendarView: 'week',
    calendarAnchor: '2026-08-03',
    calendarPanel: 'detail',
    selectedCalendarId: 'local-1',
    calendarTrash: [{ id: 'old-1', title: '旧日程', entity: 'calendar' }],
  });
  for (const marker of [
    'data-calendar-today', 'data-calendar-nav="prev"', 'data-calendar-nav="next"',
    'data-calendar-edit', 'data-calendar-delete', 'data-calendar-copy',
  ]) assert.match(html, new RegExp(marker));

  const trash = renderCalendarHtml({
    calendar: [], calendarView: 'month', calendarAnchor: '2026-08-03',
    calendarPanel: 'trash', calendarTrash: [{ id: 'old-1', title: '旧日程', entity: 'calendar' }],
  });
  assert.match(trash, /data-calendar-restore="old-1"/);
});

test('calendar editor contains multi-day recurrence reminder and privacy fields', () => {
  const html = renderCalendarHtml({
    calendar: [], calendarView: 'week', calendarAnchor: '2026-08-03',
    calendarPanel: 'editor',
    calendarDraft: {
      title: '花火连拍', startAt: '2026-08-03T09:00:00.000Z', endAt: '2026-08-05T18:00:00.000Z',
      company: 'huahuo', privacy: 'work', reminders: [15],
    },
  });
  for (const name of ['startAt', 'endAt', 'recurrenceFrequency', 'reminders', 'privacy', 'notes']) {
    assert.match(html, new RegExp(`name="${name}"`));
  }
  assert.match(html, /data-calendar-form/);
});

test('external event detail is read-only and opens only a safe source URL', () => {
  const html = renderCalendarHtml({
    calendar: [{
      id: 'feishu-1', title: '客户沟通', startAt: '2026-08-03T02:00:00.000Z',
      endAt: '2026-08-03T03:00:00.000Z', company: 'wanjia', source: 'feishu_calendar',
      sourceUrl: 'https://open.feishu.cn/event/1',
    }],
    calendarView: 'day', calendarAnchor: '2026-08-03',
    calendarPanel: 'detail', selectedCalendarId: 'feishu-1',
  });
  assert.doesNotMatch(html, /data-calendar-delete/);
  assert.doesNotMatch(html, /data-calendar-edit/);
  assert.match(html, /data-calendar-open-source/);
});

test('recurring event mutations require a visible scope choice', () => {
  const html = renderCalendarHtml({
    calendar: [], calendarView: 'week', calendarAnchor: '2026-08-03',
    calendarPanel: 'series', calendarPendingMutation: { id: 'series-1', action: 'delete' },
  });
  for (const scope of ['single', 'future', 'series']) {
    assert.match(html, new RegExp(`data-calendar-series-scope="${scope}"`));
  }
});

test('empty calendar keeps the selected period grid visible alongside configuration guidance', () => {
  const html = renderCalendarHtml({
    calendar: [], calendarView: 'month', calendarAnchor: '2026-08-03',
    externalCalendarState: 'pending_configuration',
  });

  assert.match(html, /calendar-month-grid/);
  assert.match(html, /calendar-day-empty/);
  assert.match(html, /外部日历尚未配置/);
  assert.doesNotMatch(html, /data-calendar-layer="countdown"/);
});

test('month grid exposes selectable days and highlights every day in the active drag range', () => {
  const html = renderCalendarHtml({
    calendar: [], calendarView: 'month', calendarAnchor: '2026-08-10',
    calendarSelection: { startDate: '2026-08-10', endDate: '2026-08-12' },
  });

  for (const date of ['2026-08-10', '2026-08-11', '2026-08-12']) {
    assert.match(html, new RegExp(`calendar-day[^>]*is-selected[^>]*data-calendar-select-date="${date}"`));
  }
  assert.match(html, /data-calendar-select-date="2026-08-13" tabindex="0"/);
});

test('new arrangement drawer switches between task and schedule without dropping the selected range', () => {
  const html = renderCalendarHtml({
    calendar: [], calendarView: 'month', calendarAnchor: '2026-08-10',
    calendarPanel: 'editor', calendarDraftKind: 'task',
    calendarDraft: {
      startAt: '2026-08-10T00:00', dueAt: '2026-08-12T23:59', allDay: true,
      company: 'wanjia', priority: 2,
    },
  });

  assert.match(html, /新增安排/);
  assert.match(html, /data-calendar-kind="task"[^>]*class="active"/);
  assert.match(html, /data-calendar-kind="calendar"/);
  assert.match(html, /name="scheduleKind" value="task"/);
  assert.match(html, /name="startAt"[^>]*value="2026-08-10T00:00"/);
  assert.match(html, /name="dueAt"[^>]*value="2026-08-12T23:59"/);
  assert.match(html, /name="priority"/);
  assert.match(html, /保存任务/);
});

test('calendar exposes truthful closed-app reminder setup state', () => {
  const html = renderCalendarHtml({
    calendar: [], calendarView: 'month', calendarAnchor: '2026-08-04',
    externalCalendarState: 'pending_configuration', notificationState: 'permission_required',
  });
  assert.match(html, /data-enable-reminders/);
  assert.match(html, /开启关闭页面提醒/);
  const unavailable = renderCalendarHtml({
    calendar: [], calendarView: 'month', calendarAnchor: '2026-08-04',
    notificationState: 'pending_configuration',
  });
  assert.match(unavailable, /推送服务待配置/);
  assert.doesNotMatch(unavailable, /data-enable-reminders/);
});

test('calendar source rail distinguishes synced cached permission and configuration states', () => {
  for (const [state, label] of [
    ['synced', '外部日历已同步'],
    ['cached', '外部日历暂用缓存'],
    ['feishu_permission_denied', '飞书日历权限待检查'],
    ['pending_configuration', '外部日历待配置'],
  ]) {
    const html = renderCalendarHtml({ calendar: [], calendarView: 'week', calendarAnchor: '2026-08-04', externalCalendarState: state });
    assert.match(html, new RegExp(label));
  }
});
