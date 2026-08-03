import test from 'node:test';
import assert from 'node:assert/strict';

import { parseIcsCalendar } from '../src/app/ics-calendar.mjs';

test('parses timed and all-day ICS events with Asia Shanghai semantics', () => {
  const events = parseIcsCalendar(`BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:meeting-1\r\nSUMMARY:经营复盘\r\nDTSTART;TZID=Asia/Shanghai:20260803T100000\r\nDTEND;TZID=Asia/Shanghai:20260803T110000\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:day-1\r\nSUMMARY:交付日\r\nDTSTART;VALUE=DATE:20260804\r\nEND:VEVENT\r\nEND:VCALENDAR`);

  assert.equal(events[0].startAt, '2026-08-03T02:00:00.000Z');
  assert.equal(events[0].endAt, '2026-08-03T03:00:00.000Z');
  assert.equal(events[0].allDay, false);
  assert.equal(events[1].startAt, '2026-08-04T00:00:00.000Z');
  assert.equal(events[1].allDay, true);
});

test('deduplicates UID and start while redacting private titles and dropping descriptions', () => {
  const events = parseIcsCalendar(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:private-1
SUMMARY:家庭事项
DESCRIPTION:不应进入工作台的私人正文
CLASS:PRIVATE
DTSTART:20260803T120000Z
DTEND:20260803T130000Z
END:VEVENT
BEGIN:VEVENT
UID:private-1
SUMMARY:重复事件
DTSTART:20260803T120000Z
END:VEVENT
END:VCALENDAR`);

  assert.equal(events.length, 1);
  assert.equal(events[0].title, '个人安排');
  assert.equal(events[0].privacy, 'private');
  assert.equal('description' in events[0], false);
});
