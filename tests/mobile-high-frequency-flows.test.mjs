import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCalendarHtml } from '../src/app/views/calendar-view.mjs';
import { render as renderIntelligence } from '../src/app/views/intelligence-view.mjs';
import { render as renderTasks } from '../src/app/views/task-view.mjs';
import { calendarLayout } from '../src/app/calendar-center.mjs';
import { createCeoOsApplication } from '../src/app.mjs';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('mobile high-frequency flows preserve month calendar, intelligence actions and grouped more menu', () => {
  assert.match(renderCalendarHtml({ calendarAnchor: '2026-08-16', calendar: [] }), /calendar-month-grid/);
  assert.match(index, /data-mobile-more-group="business"/);
  assert.match(index, /data-mobile-more-group="knowledge-ai"/);
  assert.match(index, /data-mobile-more-group="personal-system"/);
  const node = { innerHTML: '' };
  renderIntelligence(node, { items: [{ id: 'intel-1', title: 'Astra 模型发布', sourceName: '公开来源' }], filters: {} });
  assert.match(node.innerHTML, /data-intelligence-question="intel-1"/);
  assert.match(node.innerHTML, /data-intelligence-read="intel-1"/);
});

test('mobile intelligence disclosure stays open and retains its query through a filter redraw', () => {
  const app = createCeoOsApplication({ storage: createMemoryStorage(), createOperatingRuntime: false });
  app.runtime.intelligenceFiltersDisclosureOpen = true;
  app.setIntelligenceFilter('search', 'Astra');
  const node = { innerHTML: '' };
  renderIntelligence(node, {
    ...app.viewModel(),
    isMobile: true,
    intelligence: [{ id: 'intel-1', title: 'Astra 模型发布', sourceName: '公开来源' }],
  });
  assert.match(node.innerHTML, /<details[^>]*data-intelligence-filters[^>]*open/);
  assert.match(node.innerHTML, /data-intelligence-search value="Astra"/);
});

test('intelligence toggle and active search focus survive the delegated redraw chain', async () => {
  const listeners = new Map();
  const replacementSearch = {
    focusedWith: null,
    selection: null,
    focus(options) { this.focusedWith = options; },
    setSelectionRange(start, end) { this.selection = [start, end]; },
  };
  const activeSearch = {
    dataset: {}, selectionStart: 2, selectionEnd: 4,
    matches: (selector) => selector === '[data-intelligence-search]',
  };
  const intelligenceRoot = { innerHTML: '' };
  const document = {
    activeElement: activeSearch,
    defaultView: { innerWidth: 375, setTimeout, clearTimeout },
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) || []), listener]); },
    getElementById(id) { return id === 'intelligenceCenterRoot' ? intelligenceRoot : null; },
    querySelector(selector) {
      if (selector === '.page.active') return { id: 'page-intelligence' };
      if (selector === '[data-intelligence-search]') return replacementSearch;
      return null;
    },
  };
  const app = createCeoOsApplication({ document, storage: createMemoryStorage(), createOperatingRuntime: false });
  app.runtime.intelligence = [{ externalId: 'intel-1', title: 'Astra 模型发布', factSummary: '公开发布信息', sourceName: '公开来源', sourceUrl: 'https://example.test/astra', capturedAt: '2026-08-16T00:00:00.000Z' }];
  await app.start();
  for (const listener of listeners.get('toggle') || []) listener({ target: { open: true, matches: (selector) => selector === 'details[data-intelligence-filters]' } });
  app.setIntelligenceFilter('search', 'Astra');
  assert.equal(app.runtime.intelligenceFiltersDisclosureOpen, true);
  assert.deepEqual(replacementSearch.focusedWith, { preventScroll: true });
  assert.deepEqual(replacementSearch.selection, [2, 4]);
  assert.match(intelligenceRoot.innerHTML, /data-intelligence-question="intel-1"/);
  assert.match(intelligenceRoot.innerHTML, /data-intelligence-read="intel-1"/);
  assert.match(intelligenceRoot.innerHTML, /https:\/\/example\.test\/astra/);
  assert.match(intelligenceRoot.innerHTML, /data-intelligence-task-draft="intel-1"/);
  app.stop();
});

test('calendar day sheet reuses the selected expanded layout day for recurring and multi-day events', () => {
  const recurringLayout = calendarLayout([{
    id: 'weekly-ops', title: '每周经营会', startAt: '2026-08-03T02:00:00.000Z', endAt: '2026-08-03T03:00:00.000Z',
    recurrenceRule: { frequency: 'weekly', interval: 1 },
  }], { view: 'month', anchor: '2026-08-10', timeZone: 'UTC' });
  const recurring = renderCalendarHtml({
    calendar: [], calendarLayout: recurringLayout, calendarDaySheetOpen: true, calendarSelectedDate: '2026-08-10',
  });
  assert.match(recurring, /calendar-day-sheet-events">[\s\S]*每周经营会/);

  const multiDayLayout = calendarLayout([{
    id: 'shooting-trip', title: '三日拍摄', startAt: '2026-08-03T02:00:00.000Z', endAt: '2026-08-05T10:00:00.000Z',
  }], { view: 'month', anchor: '2026-08-10', timeZone: 'UTC' });
  const multiDay = renderCalendarHtml({
    calendar: [], calendarLayout: multiDayLayout, calendarDaySheetOpen: true, calendarSelectedDate: '2026-08-05',
  });
  assert.match(multiDay, /calendar-day-sheet-events">[\s\S]*三日拍摄/);
});

test('my-created quick filter uses persisted creator or local device identity and excludes unknown owners', () => {
  const node = { innerHTML: '' };
  renderTasks(node, {
    isMobile: true,
    taskQuickFilter: 'mine',
    taskOwnerDeviceId: 'device-current',
    tasks: [
      { id: 'legacy-local', title: '本机存量', deviceId: 'device-current' },
      { id: 'explicit-owner', title: '明确本人', creatorId: 'device-current', deviceId: 'device-other' },
      { id: 'other-owner', title: '他人创建', creatorId: 'device-other', deviceId: 'device-current' },
      { id: 'unknown-owner', title: '未知创建者' },
    ],
  });
  assert.match(node.innerHTML, /data-task-id="legacy-local"/);
  assert.match(node.innerHTML, /data-task-id="explicit-owner"/);
  assert.doesNotMatch(node.innerHTML, /data-task-id="other-owner"/);
  assert.doesNotMatch(node.innerHTML, /data-task-id="unknown-owner"/);
});

function createDelegatedDocument() {
  const listeners = new Map();
  const groups = new Map(['business', 'knowledge-ai', 'personal-system'].map((id) => [id, { innerHTML: '', setAttribute() {} }]));
  const host = { querySelector: (selector) => groups.get(selector.match(/"([^"]+)"/)?.[1]) || null };
  const document = {
    defaultView: { innerWidth: 375, setTimeout, clearTimeout },
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) || []), listener]); },
    getElementById() { return null; },
    querySelector(selector) {
      if (selector === '[data-mobile-more-groups]') return host;
      if (selector === '.page.active') return { id: 'page-settings' };
      return null;
    },
  };
  return {
    document,
    groups,
    async emit(type, event) {
      for (const listener of listeners.get(type) || []) await listener(event);
    },
  };
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test('delegated dynamic More button uses page focus handoff after redraw for keyboard and screen-reader activation', async () => {
  const browser = createDelegatedDocument();
  const calls = [];
  const originalWindow = globalThis.window;
  globalThis.window = { navigateTo: (...args) => calls.push(args) };
  try {
    const app = createCeoOsApplication({ document: browser.document, storage: createMemoryStorage(), createOperatingRuntime: false });
    await app.start();
    assert.match(browser.groups.get('business').innerHTML, /<button[^>]*data-page=/);
    await browser.emit('click', {
      target: {
        dataset: { page: 'local-life' },
        closest(selector) {
          return ['[data-mobile-more-item][data-page]', '[data-page]'].includes(selector) ? this : null;
        },
      },
    });
    assert.deepEqual(calls, [['local-life', { focusPage: true }]]);
    app.stop();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('touch long-press opens the existing task preview after its threshold and pointer cancellation prevents it', async () => {
  const listeners = new Map();
  const timers = new Map();
  let nextTimer = 0;
  const clock = {
    innerWidth: 375,
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const document = {
    defaultView: clock,
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) || []), listener]); },
    getElementById() { return null; },
    querySelector(selector) { return selector === '.page.active' ? { id: 'page-calendar' } : null; },
  };
  const emit = async (type, event) => {
    for (const listener of listeners.get(type) || []) await listener(event);
  };
  const target = {
    dataset: { calendarEvent: 'task-long-press' },
    closest(selector) { return selector === '[data-calendar-event][data-source="local_task"]' ? this : null; },
  };
  const app = createCeoOsApplication({ document, storage: createMemoryStorage(), createOperatingRuntime: false, now: () => '2026-08-16T00:00:00.000Z' });
  app.saveTask({ id: 'task-long-press', title: '长按预览任务', dueAt: '2026-08-16T10:00:00.000Z' });
  await app.start();

  await emit('pointerdown', { target, pointerType: 'touch', pointerId: 1 });
  const previewTimer = app.runtime.calendarEventLongPress.timer;
  timers.get(previewTimer)();
  assert.equal(app.runtime.calendarPanel, 'detail');
  assert.equal(app.runtime.selectedCalendarId, 'task-long-press');

  app.runtime.calendarPanel = null;
  app.runtime.selectedCalendarId = null;
  await emit('pointerdown', { target, pointerType: 'touch', pointerId: 2 });
  const cancelledTimer = app.runtime.calendarEventLongPress.timer;
  await emit('pointercancel', { target, pointerId: 2 });
  assert.equal(timers.has(cancelledTimer), false);
  assert.equal(app.runtime.calendarPanel, null);
  app.stop();
});
