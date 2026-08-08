import test from 'node:test';
import assert from 'node:assert/strict';
import { createCeoOsApplication } from '../src/app.mjs';
import { calendarLayout } from '../src/app/calendar-center.mjs';
import { renderCalendarHtml } from '../src/app/views/calendar-view.mjs';

test('calendar opens in month mode by default and keeps other views optional', () => {
  const app = createCeoOsApplication({ document: { getElementById: () => null, addEventListener() {} }, storage: { getItem: () => null, setItem() {} }, createOperatingRuntime: false });
  assert.equal(app.runtime.calendarView, 'month');
  app.setCalendarView('week');
  assert.equal(app.runtime.calendarView, 'week');
  app.setCalendarView('unsupported');
  assert.equal(app.runtime.calendarView, 'month');
});

test('calendar helpers and rendering also default to the month view', () => {
  assert.equal(calendarLayout([], { anchor: '2026-08-08' }).view, 'month');
  assert.match(renderCalendarHtml({ calendarAnchor: '2026-08-08', calendar: [] }), /calendar-month-grid/);
});
