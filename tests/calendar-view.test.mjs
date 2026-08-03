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
