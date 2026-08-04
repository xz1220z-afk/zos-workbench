import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarIdsFromList,
  feishuTimeToIso,
  normalizeFeishuCalendarEvents,
  nextCalendarPageToken,
  primaryCalendarId,
  userIdForEmail,
  userIdForName,
} from '../supabase/functions/_shared/feishu-calendar.mjs';

test('selects only readable, non-deleted calendars already shared with the app', () => {
  const ids = calendarIdsFromList({
    calendar_list: [
      { calendar_id: 'readable', role: 'reader', is_deleted: false },
      { calendar_id: 'owned', role: 'owner', is_deleted: false },
      { calendar_id: 'deleted', role: 'reader', is_deleted: true },
      { calendar_id: 'busy-only', role: 'free_busy_reader', is_deleted: false },
    ],
  });
  assert.deepEqual(ids, ['readable', 'owned']);
});

test('resolves the signed-in user and primary calendar from Feishu response contracts', () => {
  assert.equal(userIdForEmail({ user_list: [{ user_id: 'ou_owner', email: 'owner@example.com' }] }, 'owner@example.com'), 'ou_owner');
  assert.equal(primaryCalendarId({ calendars: [{ user_id: 'ou_owner', calendar: { calendar_id: 'primary-calendar' } }] }, 'ou_owner'), 'primary-calendar');
  assert.equal(userIdForEmail({ user_list: [] }, 'owner@example.com'), null);
  assert.equal(primaryCalendarId({ calendars: [] }, 'ou_owner'), null);
});

test('falls back to the configured owner name when Feishu and Supabase emails differ', () => {
  assert.equal(userIdForName({ items: [
    { user_id: 'ou_other', name: '其他人' },
    { user_id: 'ou_owner', name: '朱帅' },
  ] }, '朱帅'), 'ou_owner');
  assert.equal(userIdForName({ items: [] }, '朱帅'), null);
});

test('normalizes Feishu events to bounded metadata and redacts private titles', () => {
  const events = normalizeFeishuCalendarEvents([
    {
      event_id: 'event-public', summary: '客户复盘', visibility: 'public',
      start_time: { timestamp: '1785722400', timezone: 'Asia/Shanghai' },
      end_time: { timestamp: '1785726000', timezone: 'Asia/Shanghai' },
      updated_at: '1785720000', description: '不得进入工作台的正文',
      app_link: 'https://applink.feishu.cn/client/calendar/event/detail',
    },
    {
      event_id: 'event-private', summary: '体检安排', visibility: 'private',
      start_time: { date: '2026-08-04' }, end_time: { date: '2026-08-05' },
    },
  ]);
  assert.equal(events.length, 2);
  assert.equal(events[0].title, '客户复盘');
  assert.equal(events[0].source, 'feishu_calendar');
  assert.equal(events[0].company, 'ceo');
  assert.equal(events[0].sourceUrl, 'https://applink.feishu.cn/client/calendar/event/detail');
  assert.equal(events[1].title, '个人安排');
  assert.equal(events[1].privacy, 'private');
  assert.equal(events[1].allDay, true);
  assert.equal(Object.hasOwn(events[0], 'description'), false);
});

test('drops unsafe Feishu event links', () => {
  const [event] = normalizeFeishuCalendarEvents([{
    event_id: 'unsafe-link', summary: '测试', visibility: 'public',
    start_time: { timestamp: '1785722400' }, end_time: { timestamp: '1785726000' },
    app_link: 'javascript:alert(1)',
  }]);
  assert.equal(event.sourceUrl, null);
});

test('converts timestamp and all-day date values without inventing time', () => {
  assert.equal(feishuTimeToIso({ timestamp: '1785722400' }).allDay, false);
  assert.equal(feishuTimeToIso({ date: '2026-08-04' }).iso, '2026-08-04T00:00:00.000Z');
  assert.equal(feishuTimeToIso({}).iso, null);
});

test('pagination advances only with a new non-empty token', () => {
  assert.equal(nextCalendarPageToken({ has_more: true, page_token: 'next' }, ''), 'next');
  assert.equal(nextCalendarPageToken({ has_more: true, page_token: 'same' }, 'same'), null);
  assert.equal(nextCalendarPageToken({ has_more: false, page_token: 'next' }, ''), null);
});
