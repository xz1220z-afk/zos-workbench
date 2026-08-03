# ZOS Smart Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade ZOS Calendar Center into a four-device smart calendar with local CRUD, recoverable deletion, multi-day and recurring events, date navigation, responsive TickTick-like interactions, and range-aware read-only Feishu synchronization.

**Architecture:** Keep editable ZOS events in the existing `calendar` collection and preserve external Feishu/ERP/task layers as read-only projections. Add small pure modules for range navigation, draft validation, recurrence expansion, and series exceptions; compose them through `calendar-center.mjs`, `app.mjs`, and `calendar-view.mjs`. Reuse revision/deviceId/tombstone synchronization, adding a deterministic restore operation and bounded Edge Function range parameters.

**Tech Stack:** Vanilla ES modules, Node.js built-in test runner, localStorage state store, Supabase owner-RLS records, Supabase Edge Functions/Deno, Feishu Calendar API, HTML/CSS PWA, GitHub Pages.

## Global Constraints

- ZOS-created calendar events are editable and recoverable; Feishu, ERP, task, intelligence, countdown, and focus projections remain read-only in Calendar Center.
- Local calendar changes synchronize through the existing owner-scoped Supabase `zos_records` contract; no credentials or note bodies enter domain state.
- A deletion creates a tombstone and can be restored; this release performs no automatic physical purge.
- Private events render as `个人安排` in company contexts and never expose title, notes, reminders, or owner details.
- The first calendar render uses local state and cached external items; remote refresh must not block interaction or blank the page.
- No third-party calendar or drag library is added; use focused vanilla JavaScript modules and pointer/HTML drag events.
- All work uses TDD: write one failing test, observe the expected failure, add the minimal implementation, run the focused tests, then commit.
- Preserve untracked `.superpowers/` and `package-lock.json`; do not add, modify, delete, or commit them.
- Production release requires three gates: unit/contract, full regression/PWA, and deployed function/Pages readback.

---

## File Structure

- Create `src/app/calendar-range.mjs`: anchor normalization, visible ranges, period navigation, and ISO query boundaries.
- Create `src/app/calendar-event.mjs`: local draft normalization, validation, editability checks, and safe source URLs.
- Create `src/app/calendar-recurrence.mjs`: bounded recurrence expansion plus single/future/series exception decisions.
- Modify `src/app/calendar-center.mjs`: aggregate sources, expand recurrences, place multi-day events across covered dates, and filter by overlap rather than start time only.
- Modify `src/app/state-store.mjs`: restore tombstoned entities with a higher revision.
- Modify `src/app/views/calendar-view.mjs`: pure calendar HTML renderer, toolbar/navigation, detail drawer, editor drawer, recycle bin, and source-aware actions.
- Modify `src/app.mjs`: runtime calendar state, CRUD/restore/series actions, form handlers, date navigation, drag changes, and range refresh orchestration.
- Modify `src/app/browser-runtime.mjs`: pass validated `start`/`end` query parameters to the calendar Edge Function.
- Modify `supabase/functions/zos-calendar-data/index.ts`: validate and enforce bounded date ranges for Feishu and ICS reads.
- Modify `supabase/functions/_shared/feishu-calendar.mjs`: retain only safe Feishu event deep links for “打开来源”.
- Modify `assets/app.css`: desktop time grid, month span bars, drawers, responsive mobile list, touch targets, drag and error states.
- Modify `sw.js` and `manifest.webmanifest`: cache new modules and release v1.8.0.
- Modify calendar, state, application, UI, Edge Function, integration, and PWA tests.
- Create `docs/zos-ceo-os-v1.8.0-production-acceptance.md`: three-gate release evidence and remaining real-device evidence.

---

### Task 1: Calendar Range and Navigation Contract

**Files:**
- Create: `src/app/calendar-range.mjs`
- Create: `tests/calendar-range.test.mjs`
- Modify: `src/app/calendar-center.mjs`

**Interfaces:**
- Consumes: ISO timestamps or `YYYY-MM-DD` anchors and view names `day|week|month|list`.
- Produces: `calendarVisibleRange({ view, anchor, timeZone }) -> { startDate, endDate, queryStart, queryEnd, days }`, `moveCalendarAnchor(anchor, view, direction) -> YYYY-MM-DD`, and `calendarRangeKey(range) -> string`.

- [ ] **Step 1: Write failing range and navigation tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarRangeKey, calendarVisibleRange, moveCalendarAnchor } from '../src/app/calendar-range.mjs';

test('calendar ranges match the visible day week month and list windows', () => {
  assert.deepEqual(calendarVisibleRange({ view: 'day', anchor: '2026-08-03' }).days, 1);
  assert.deepEqual(calendarVisibleRange({ view: 'week', anchor: '2026-08-05' }).startDate, '2026-08-03');
  assert.deepEqual(calendarVisibleRange({ view: 'month', anchor: '2026-08-05' }).days, 42);
  assert.deepEqual(calendarVisibleRange({ view: 'list', anchor: '2026-08-05' }).days, 31);
});

test('calendar navigation preserves date semantics across periods', () => {
  assert.equal(moveCalendarAnchor('2026-08-03', 'day', 1), '2026-08-04');
  assert.equal(moveCalendarAnchor('2026-08-03', 'week', -1), '2026-07-27');
  assert.equal(moveCalendarAnchor('2026-01-31', 'month', 1), '2026-02-28');
  assert.match(calendarRangeKey(calendarVisibleRange({ view: 'week', anchor: '2026-08-05' })), /^2026-08-03\/2026-08-10$/);
});
```

- [ ] **Step 2: Run the focused test and observe RED**

Run: `node --test tests/calendar-range.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `calendar-range.mjs`.

- [ ] **Step 3: Implement the range primitives**

```js
const VIEWS = new Set(['day', 'week', 'month', 'list']);

function dateKey(value) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('calendar_anchor_invalid');
  return date.toISOString().slice(0, 10);
}

function addDays(value, count) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function calendarVisibleRange({ view = 'week', anchor }) {
  const resolvedView = VIEWS.has(view) ? view : 'week';
  const key = dateKey(anchor);
  const weekday = (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7;
  let startDate = key;
  let days = 1;
  if (resolvedView === 'week') { startDate = addDays(key, -weekday); days = 7; }
  if (resolvedView === 'month') {
    const first = `${key.slice(0, 7)}-01`;
    const firstWeekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
    startDate = addDays(first, -firstWeekday); days = 42;
  }
  if (resolvedView === 'list') days = 31;
  const endDate = addDays(startDate, days);
  return {
    view: resolvedView, anchor: key, startDate, endDate, days,
    queryStart: `${startDate}T00:00:00+08:00`, queryEnd: `${endDate}T00:00:00+08:00`,
  };
}

export function moveCalendarAnchor(anchor, view, direction) {
  const key = dateKey(anchor);
  if (view === 'day') return addDays(key, direction);
  if (view === 'week') return addDays(key, direction * 7);
  if (view === 'list') return addDays(key, direction * 31);
  const source = new Date(`${key}T12:00:00Z`);
  const day = source.getUTCDate();
  const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + direction, 1, 12));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

export function calendarRangeKey({ startDate, endDate }) { return `${startDate}/${endDate}`; }
```

- [ ] **Step 4: Run focused tests and existing layout tests**

Run: `node --test tests/calendar-range.test.mjs tests/calendar-center.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the range contract**

```bash
git add src/app/calendar-range.mjs src/app/calendar-center.mjs tests/calendar-range.test.mjs
git commit -m "feat: add calendar range navigation contract"
```

---

### Task 2: Local Event Draft Validation and Source Authority

**Files:**
- Create: `src/app/calendar-event.mjs`
- Create: `tests/calendar-event.test.mjs`
- Modify: `src/app/calendar-center.mjs`

**Interfaces:**
- Consumes: editor form-shaped fields and existing calendar records.
- Produces: `normalizeCalendarDraft(input, existing) -> CalendarRecord`, `validateCalendarDraft(input)`, `calendarEventCapabilities(event) -> { edit, remove, drag, openSource, copy }`.

- [ ] **Step 1: Write failing validation and authority tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarEventCapabilities, normalizeCalendarDraft } from '../src/app/calendar-event.mjs';

test('calendar drafts preserve multi-day fields and reject inverted ranges', () => {
  const event = normalizeCalendarDraft({
    title: '花火连拍', startAt: '2026-08-10T09:00', endAt: '2026-08-12T18:00',
    company: 'huahuo', privacy: 'work', notes: '三日拍摄', allDay: false,
  });
  assert.equal(event.title, '花火连拍');
  assert.equal(event.company, 'huahuo');
  assert.throws(() => normalizeCalendarDraft({ title: '错误', startAt: '2026-08-12T10:00', endAt: '2026-08-11T10:00' }), /calendar_end_before_start/);
});

test('only ZOS local events expose destructive calendar actions', () => {
  assert.deepEqual(calendarEventCapabilities({ source: 'user_calendar' }), { edit: true, remove: true, drag: true, openSource: false, copy: true });
  assert.deepEqual(calendarEventCapabilities({ source: 'feishu', sourceUrl: 'https://open.feishu.cn/' }), { edit: false, remove: false, drag: false, openSource: true, copy: true });
});
```

- [ ] **Step 2: Run the focused test and observe RED**

Run: `node --test tests/calendar-event.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement normalized records and capability checks**

```js
const COMPANIES = new Set(['ceo', 'wanjia', 'huahuo', 'lingli', 'life']);
const PRIVACY = new Set(['work', 'private']);

function timestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('calendar_time_invalid');
  return date.toISOString();
}

export function normalizeCalendarDraft(input = {}, existing = {}) {
  const title = String(input.title || existing.title || '').trim();
  if (!title) throw new Error('calendar_title_required');
  const startAt = timestamp(input.startAt || existing.startAt);
  const endAt = timestamp(input.endAt || existing.endAt || new Date(new Date(startAt).getTime() + 3_600_000));
  if (new Date(endAt) < new Date(startAt)) throw new Error('calendar_end_before_start');
  return {
    ...existing, title, startAt, endAt, allDay: Boolean(input.allDay),
    company: COMPANIES.has(input.company) ? input.company : (existing.company || 'ceo'),
    privacy: PRIVACY.has(input.privacy) ? input.privacy : (existing.privacy || 'work'),
    notes: String(input.notes || '').trim(), reminders: Array.isArray(input.reminders) ? input.reminders : [],
    sourceUrl: /^https?:\/\//.test(String(input.sourceUrl || '')) ? String(input.sourceUrl) : null,
    status: 'scheduled', source: 'user_calendar',
  };
}

export function calendarEventCapabilities(event = {}) {
  const local = event.source === 'user_calendar';
  return { edit: local, remove: local, drag: local, openSource: !local && /^https?:\/\//.test(String(event.sourceUrl || '')), copy: true };
}
```

- [ ] **Step 4: Run the focused domain tests**

Run: `node --test tests/calendar-event.test.mjs tests/calendar-center.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit event validation**

```bash
git add src/app/calendar-event.mjs src/app/calendar-center.mjs tests/calendar-event.test.mjs
git commit -m "feat: validate editable calendar events"
```

---

### Task 3: Bounded Recurrence and Series Exceptions

**Files:**
- Create: `src/app/calendar-recurrence.mjs`
- Create: `tests/calendar-recurrence.test.mjs`
- Modify: `src/app/calendar-center.mjs`

**Interfaces:**
- Consumes: base events with `{ recurrenceRule, seriesId }`, exception records with `{ originalStartAt, exceptionType }`, and a visible range.
- Produces: `expandRecurringEvents(events, { rangeStart, rangeEnd }) -> CalendarOccurrence[]` and `seriesMutationRecords(base, occurrence, scope, patch) -> CalendarRecord[]`.

- [ ] **Step 1: Write failing recurrence tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { expandRecurringEvents, seriesMutationRecords } from '../src/app/calendar-recurrence.mjs';

test('weekly recurrence expands only inside the visible range and applies a cancelled exception', () => {
  const rows = expandRecurringEvents([
    { id: 'series-1', seriesId: 'series-1', title: '经营周会', startAt: '2026-08-03T02:00:00.000Z', endAt: '2026-08-03T03:00:00.000Z', recurrenceRule: { frequency: 'weekly', interval: 1, byWeekdays: [1] } },
    { id: 'exception-1', seriesId: 'series-1', originalStartAt: '2026-08-10T02:00:00.000Z', exceptionType: 'cancelled' },
  ], { rangeStart: '2026-08-01T00:00:00.000Z', rangeEnd: '2026-08-25T00:00:00.000Z' });
  assert.deepEqual(rows.map((row) => row.startAt.slice(0, 10)), ['2026-08-03', '2026-08-17', '2026-08-24']);
});

test('single occurrence deletion produces a synchronized cancelled exception', () => {
  const [record] = seriesMutationRecords(
    { id: 'series-1', seriesId: 'series-1', recurrenceRule: { frequency: 'weekly', interval: 1 } },
    { originalStartAt: '2026-08-10T02:00:00.000Z' }, 'single', { deleted: true },
  );
  assert.equal(record.exceptionType, 'cancelled');
  assert.equal(record.originalStartAt, '2026-08-10T02:00:00.000Z');
});
```

- [ ] **Step 2: Run the focused test and observe RED**

Run: `node --test tests/calendar-recurrence.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement daily, weekly, monthly, and yearly bounded iteration**

```js
const LIMIT = 500;
const SCAN_LIMIT = 20_000;

function dayDiff(base, candidate) {
  const left = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  const right = Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate());
  return Math.floor((right - left) / 86_400_000);
}

function matchesRule(base, candidate, rule) {
  const interval = Math.max(1, Number(rule.interval) || 1);
  const diff = dayDiff(base, candidate);
  if (diff < 0) return false;
  if (rule.frequency === 'daily') return diff % interval === 0;
  if (rule.frequency === 'weekly') {
    const isoWeekday = candidate.getUTCDay() || 7;
    const weekdays = Array.isArray(rule.byWeekdays) && rule.byWeekdays.length ? rule.byWeekdays : [base.getUTCDay() || 7];
    return Math.floor(diff / 7) % interval === 0 && weekdays.includes(isoWeekday);
  }
  const monthDiff = (candidate.getUTCFullYear() - base.getUTCFullYear()) * 12 + candidate.getUTCMonth() - base.getUTCMonth();
  if (rule.frequency === 'monthly') return monthDiff >= 0 && monthDiff % interval === 0 && candidate.getUTCDate() === base.getUTCDate();
  if (rule.frequency === 'yearly') return candidate.getUTCFullYear() >= base.getUTCFullYear()
    && (candidate.getUTCFullYear() - base.getUTCFullYear()) % interval === 0
    && candidate.getUTCMonth() === base.getUTCMonth() && candidate.getUTCDate() === base.getUTCDate();
  return false;
}

export function expandRecurringEvents(events = [], { rangeStart, rangeEnd }) {
  const exceptions = new Map(events.filter((row) => row.originalStartAt).map((row) => [`${row.seriesId}:${row.originalStartAt}`, row]));
  const output = [];
  for (const base of events.filter((row) => !row.originalStartAt)) {
    if (!base.recurrenceRule) { if (new Date(base.endAt || base.startAt) > new Date(rangeStart) && new Date(base.startAt) < new Date(rangeEnd)) output.push(base); continue; }
    const duration = new Date(base.endAt) - new Date(base.startAt);
    const first = new Date(base.startAt);
    let cursor = new Date(base.startAt);
    let emitted = 0;
    let occurrenceCount = 0;
    let scanned = 0;
    while (cursor < new Date(rangeEnd) && emitted < LIMIT && scanned < SCAN_LIMIT) {
      if (!matchesRule(first, cursor, base.recurrenceRule)) {
        cursor.setUTCDate(cursor.getUTCDate() + 1); scanned += 1; continue;
      }
      occurrenceCount += 1;
      if (base.recurrenceRule.count && occurrenceCount > base.recurrenceRule.count) break;
      if (base.recurrenceRule.until && cursor > new Date(base.recurrenceRule.until)) break;
      const originalStartAt = cursor.toISOString();
      const exception = exceptions.get(`${base.seriesId || base.id}:${originalStartAt}`);
      if (cursor >= new Date(rangeStart) && exception?.exceptionType !== 'cancelled') {
        output.push(exception?.exceptionType === 'modified' ? exception : {
          ...base, id: `${base.seriesId || base.id}@${originalStartAt}`,
          seriesId: base.seriesId || base.id, originalStartAt,
          startAt: originalStartAt, endAt: new Date(cursor.getTime() + duration).toISOString(),
        });
        emitted += 1;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1); scanned += 1;
    }
  }
  return output.sort((left, right) => left.startAt.localeCompare(right.startAt));
}

export function seriesMutationRecords(base, occurrence, scope, patch = {}) {
  if (scope === 'single') return [{
    seriesId: base.seriesId || base.id, originalStartAt: occurrence.originalStartAt || occurrence.startAt,
    exceptionType: patch.deleted ? 'cancelled' : 'modified', ...patch, source: 'user_calendar',
  }];
  if (scope === 'series') return [{ ...base, ...patch }];
  const boundary = occurrence.originalStartAt || occurrence.startAt;
  return [
    { ...base, recurrenceRule: { ...base.recurrenceRule, until: new Date(new Date(boundary).getTime() - 1).toISOString() } },
    { ...base, id: undefined, seriesId: undefined, startAt: boundary, ...patch },
  ];
}
```

- [ ] **Step 4: Add assertions for modified exceptions, count/until, future splits, and the 500-instance limit; then run tests**

Run: `node --test tests/calendar-recurrence.test.mjs tests/calendar-center.test.mjs`

Expected: PASS, including no result array longer than 500 instances per series.

- [ ] **Step 5: Commit the recurrence engine**

```bash
git add src/app/calendar-recurrence.mjs src/app/calendar-center.mjs tests/calendar-recurrence.test.mjs
git commit -m "feat: add bounded calendar recurrence"
```

---

### Task 4: Recoverable State and Calendar CRUD Actions

**Files:**
- Modify: `src/app/state-store.mjs`
- Modify: `src/app.mjs`
- Modify: `tests/state-store.test.mjs`
- Modify: `tests/app-composition.test.mjs`

**Interfaces:**
- Consumes: normalized local drafts, local IDs, tombstones, series scope.
- Produces: `store.restoreEntity(entityType, id)`, application actions `saveCalendar`, `deleteCalendar`, `restoreCalendar`, `copyCalendar`, and `moveCalendar`.

- [ ] **Step 1: Write failing restore and CRUD tests**

```js
test('deleted calendar records restore with a higher revision and no stale tombstone', () => {
  const store = createStateStore({ storage: memoryStorage(), now: () => '2026-08-03T12:00:00.000Z', deviceId: 'd1', createId: () => 'event-1' });
  const created = store.saveEntity('calendar', { title: '经营会', startAt: '2026-08-04T02:00:00.000Z' });
  const deleted = store.deleteEntity('calendar', created.id);
  const restored = store.restoreEntity('calendar', created.id);
  assert.equal(restored.revision, deleted.revision + 1);
  assert.equal(restored.deletedAt, null);
  assert.equal(store.load().tombstones.some((row) => row.id === created.id), false);
});

// Extend the existing app-composition fakeStore so calendar IDs, revisions,
// tombstones, and restoration behave like the production store.
saveEntity(entityType, fields) {
  const previous = state.collections[entityType].find((item) => item.id === fields.id);
  const record = { ...previous, ...structuredClone(fields), id: fields.id || `fake-${entityType}-${state.collections[entityType].length + 1}`, revision: (previous?.revision || 0) + 1, deletedAt: null };
  state.collections[entityType] = [...state.collections[entityType].filter((item) => item.id !== record.id), record];
  listeners.forEach((listener) => listener(structuredClone(state)));
  return structuredClone(record);
},
deleteEntity(entityType, id) {
  const previous = state.collections[entityType].find((item) => item.id === id);
  if (!previous) throw new Error('record not found');
  const tombstone = { ...previous, entity: entityType, revision: previous.revision + 1, deletedAt: '2026-08-03T09:00:00.000Z' };
  state.collections[entityType] = state.collections[entityType].filter((item) => item.id !== id);
  state.tombstones = [...state.tombstones, tombstone];
  return structuredClone(tombstone);
},
restoreEntity(entityType, id) {
  const tombstone = state.tombstones.find((item) => item.entity === entityType && item.id === id);
  if (!tombstone) throw new Error('tombstone_not_found');
  const restored = { ...tombstone, revision: tombstone.revision + 1, deletedAt: null };
  delete restored.entity;
  state.tombstones = state.tombstones.filter((item) => item !== tombstone);
  state.collections[entityType] = [...state.collections[entityType], restored];
  return structuredClone(restored);
},

test('application calendar actions edit delete restore copy and move only local events', () => {
  const store = fakeStore();
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} }, store,
    createOperatingRuntime: false, now: () => '2026-08-03T08:00:00.000Z',
  });
  const created = app.saveCalendar({ title: '周会', startAt: '2026-08-03T10:00', endAt: '2026-08-03T11:00' });
  assert.equal(app.saveCalendar({ ...created, title: '经营周会' }).title, '经营周会');
  assert.equal(app.moveCalendar(created.id, { startAt: '2026-08-04T10:00', endAt: '2026-08-04T11:00' }).startAt.slice(0, 10), '2026-08-04');
  const copy = app.copyCalendar(created.id);
  assert.notEqual(copy.id, created.id);
  app.deleteCalendar(created.id);
  assert.equal(app.restoreCalendar(created.id).title, '经营周会');
});
```

- [ ] **Step 2: Run the focused tests and observe RED**

Run: `node --test tests/state-store.test.mjs tests/app-composition.test.mjs`

Expected: FAIL because `restoreEntity`, `saveCalendar`, and related actions do not exist.

- [ ] **Step 3: Implement deterministic restoration**

```js
restoreEntity(entityType, id) {
  requireEntityType(entityType);
  const tombstone = state.tombstones.find((record) => record.entity === entityType && record.id === id);
  if (!tombstone) throw new Error('tombstone_not_found');
  const restored = touchRecord({ ...tombstone, deletedAt: null, entity: undefined }, { now: context.now(), deviceId: state.deviceId });
  state = persist({
    ...state,
    collections: { ...state.collections, [entityType]: [...state.collections[entityType].filter((row) => row.id !== id), restored] },
    tombstones: state.tombstones.filter((row) => !(row.entity === entityType && row.id === id)),
  });
  publish();
  return clone(restored);
}
```

- [ ] **Step 4: Implement application CRUD through `normalizeCalendarDraft` and call `signalLocalChange()` after each save/delete/restore**

```js
function saveCalendar(input = {}) {
  const existing = input.id ? store.load().collections.calendar.find((row) => row.id === input.id) : null;
  const saved = store.saveEntity('calendar', normalizeCalendarDraft(input, existing || {}));
  signalLocalChange(); renderAll(); return saved;
}

function deleteCalendar(id) {
  const existing = store.load().collections.calendar.find((row) => row.id === id);
  if (!existing) throw new Error('calendar_local_event_required');
  const result = store.deleteEntity('calendar', id);
  signalLocalChange(); renderAll(); return result;
}

function restoreCalendar(id) {
  const result = store.restoreEntity('calendar', id);
  signalLocalChange(); renderAll(); return result;
}
```

- [ ] **Step 5: Run focused store/application/sync tests**

Run: `node --test tests/state-store.test.mjs tests/app-composition.test.mjs tests/sync-engine.test.mjs tests/sync-controller.test.mjs`

Expected: PASS; restored revisions beat their deletion tombstones.

- [ ] **Step 6: Commit recoverable CRUD**

```bash
git add src/app/state-store.mjs src/app.mjs tests/state-store.test.mjs tests/app-composition.test.mjs
git commit -m "feat: add recoverable calendar CRUD"
```

---

### Task 5: Multi-Day Layout and Responsive Calendar Surface

**Files:**
- Modify: `src/app/calendar-center.mjs`
- Modify: `src/app/views/calendar-view.mjs`
- Create: `tests/calendar-view.test.mjs`
- Modify: `tests/calendar-center.test.mjs`

**Interfaces:**
- Consumes: expanded occurrences, current range/view, editor/detail/recycle runtime state.
- Produces: overlap-aware `calendarLayout`, pure `renderCalendarHtml(viewModel) -> string`, and source-aware event cards.

- [ ] **Step 1: Write failing multi-day placement and UI contract tests**

```js
test('multi-day events appear on every covered date and period filtering uses overlap', () => {
  const event = { id: 'trip', title: '三日拍摄', startAt: '2026-08-03T01:00:00.000Z', endAt: '2026-08-05T10:00:00.000Z', source: 'user_calendar' };
  const week = calendarLayout([event], { view: 'week', anchor: '2026-08-04' });
  assert.deepEqual(week.days.filter((day) => day.events.some((row) => row.id === 'trip')).map((day) => day.date), ['2026-08-03', '2026-08-04', '2026-08-05']);
});

test('calendar HTML exposes navigation, drawers, source actions and recycle restore', () => {
  const html = renderCalendarHtml({
    calendar: [{ id: 'local-1', title: '周会', startAt: '2026-08-03T02:00:00.000Z', endAt: '2026-08-03T03:00:00.000Z', company: 'ceo', source: 'user_calendar' }],
    calendarView: 'week', calendarAnchor: '2026-08-03', calendarPanel: 'detail', selectedCalendarId: 'local-1', calendarTrash: [{ id: 'old-1', title: '旧日程' }],
  });
  for (const marker of ['data-calendar-today', 'data-calendar-nav="prev"', 'data-calendar-nav="next"', 'data-calendar-edit', 'data-calendar-delete', 'data-calendar-copy', 'data-calendar-restore']) assert.match(html, new RegExp(marker));
});
```

- [ ] **Step 2: Run focused tests and observe RED**

Run: `node --test tests/calendar-center.test.mjs tests/calendar-view.test.mjs`

Expected: multi-day assertion fails and `renderCalendarHtml` is missing.

- [ ] **Step 3: Change layout grouping from start-date-only to covered-date overlap**

```js
function coveredDates(event, timeZone) {
  const start = dateKey(event.startAt, timeZone);
  const endInstant = new Date(event.endAt || event.startAt);
  if (!event.allDay) endInstant.setMilliseconds(endInstant.getMilliseconds() - 1);
  const end = dateKey(endInstant, timeZone) || start;
  const dates = [];
  for (let cursor = start; cursor <= end && dates.length < 370; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}
```

- [ ] **Step 4: Export a pure renderer and add toolbar, grids, drawers, editor fields, recurrence scope dialog, and recycle bin**

```js
export function renderCalendarHtml(viewModel = {}) {
  const events = viewModel.calendar || [];
  const currentView = viewModel.calendarView || 'week';
  return `<div class="calendar-shell">
    <header class="calendar-commandbar">
      <button data-calendar-today>今天</button>
      <button data-calendar-nav="prev" aria-label="上一周期">‹</button>
      <button data-calendar-nav="next" aria-label="下一周期">›</button>
      <input type="date" data-calendar-anchor value="${escapeHtml(viewModel.calendarAnchor || '')}">
      <button data-calendar-capture>＋ 新建日程</button>
      <button data-calendar-sync>同步当前范围</button>
      <button data-calendar-trash>回收站</button>
    </header>
    ${renderViewSwitch(currentView)}
    ${renderGrid(viewModel.calendarLayout || calendarLayout(events, { view: currentView, anchor: viewModel.calendarAnchor }))}
    ${renderCalendarPanel(viewModel)}
  </div>`;
}

export function render(container, viewModel = {}) {
  if (container) container.innerHTML = renderCalendarHtml(viewModel);
}
```

- [ ] **Step 5: Run layout and renderer tests**

Run: `node --test tests/calendar-center.test.mjs tests/calendar-view.test.mjs tests/v1.7-ui.test.mjs`

Expected: PASS and existing day/week/month/list controls remain present.

- [ ] **Step 6: Commit the calendar surface**

```bash
git add src/app/calendar-center.mjs src/app/views/calendar-view.mjs tests/calendar-center.test.mjs tests/calendar-view.test.mjs
git commit -m "feat: render multi-day smart calendar"
```

---

### Task 6: Navigation, Editor, Drag, Series, and Trash Interactions

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/app/views/calendar-view.mjs`
- Modify: `tests/app-composition.test.mjs`
- Modify: `tests/calendar-view.test.mjs`

**Interfaces:**
- Consumes: DOM events from calendar `click`, `submit`, `change`, `dragstart`, `dragover`, `drop`, and mobile long-press actions.
- Produces: runtime `{ calendarAnchor, calendarPanel, selectedCalendarId, calendarDraft, calendarMutationScope, externalCalendarRange }` and safe calls to Task 4 actions.

- [ ] **Step 1: Write failing application interaction tests**

```js
test('calendar navigation changes anchors and requests only the visible range', async () => {
  const calls = [];
  const document = { getElementById: () => null, addEventListener() {}, visibilityState: 'visible' };
  const app = createCeoOsApplication({
    document, storage: { getItem: () => 'device-1', setItem() {} }, store: fakeStore(),
    now: () => '2026-08-03T08:00:00.000Z',
    operatingRuntime: { loadExternalCalendar: async (range) => { calls.push(range); return { items: [], state: 'synced' }; } },
  });
  app.setCalendarView('month');
  await app.navigateCalendar(1);
  assert.equal(app.runtime.calendarAnchor, '2026-09-03');
  assert.equal(calls.at(-1).start, '2026-08-31T00:00:00+08:00');
});

test('external events cannot be dragged or deleted through public actions', () => {
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: { getItem: () => 'device-1', setItem() {} }, store: fakeStore(),
    createOperatingRuntime: false,
  });
  app.runtime.externalCalendar = [{ id: 'feishu:event-1', source: 'feishu', title: '飞书会议', startAt: '2026-08-04T02:00:00.000Z', endAt: '2026-08-04T03:00:00.000Z' }];
  assert.throws(() => app.deleteCalendar('feishu:event-1'), /calendar_local_event_required/);
  assert.throws(() => app.moveCalendar('feishu:event-1', { startAt: '2026-08-05T10:00' }), /calendar_local_event_required/);
});
```

- [ ] **Step 2: Run focused tests and observe RED**

Run: `node --test tests/app-composition.test.mjs tests/calendar-view.test.mjs`

Expected: FAIL because navigation and panel APIs are absent.

- [ ] **Step 3: Add runtime state and range-aware navigation**

```js
calendarView: 'week', calendarAnchor: now().slice(0, 10), calendarPanel: null,
selectedCalendarId: null, calendarDraft: null, calendarMutationScope: 'single',
externalCalendarRange: null, calendarSyncState: 'idle',
```

```js
async function refreshCalendarRange({ force = false } = {}) {
  const range = calendarVisibleRange({ view: runtime.calendarView, anchor: runtime.calendarAnchor });
  const key = calendarRangeKey(range);
  if (!force && runtime.externalCalendarRange === key) return runtime.externalCalendar;
  runtime.calendarSyncState = 'loading'; renderAll();
  const result = await operatingRuntime?.loadExternalCalendar?.({ start: range.queryStart, end: range.queryEnd });
  applyExternalCalendarResult(result || { items: [], state: 'authentication_required' });
  runtime.externalCalendarRange = key; runtime.calendarSyncState = 'synced'; renderAll();
  return runtime.externalCalendar;
}
```

- [ ] **Step 4: Replace prompt capture with editor/detail/trash panels and parse the calendar form**

```js
if (event.target?.matches?.('[data-calendar-form]')) {
  event.preventDefault();
  const data = new FormData(event.target);
  saveCalendar({
    id: data.get('id') || undefined, title: data.get('title'),
    startAt: data.get('startAt'), endAt: data.get('endAt'), allDay: data.get('allDay') === 'on',
    company: data.get('company'), privacy: data.get('privacy'), notes: data.get('notes'),
    recurrenceRule: recurrenceRuleFromForm(data), reminders: reminderRulesFromForm(data),
  });
  runtime.calendarPanel = null; runtime.calendarDraft = null; renderAll();
}
```

- [ ] **Step 5: Bind drag only for local events and use date/time deltas rather than replacing duration**

```js
function moveCalendar(id, { startAt, endAt }) {
  const existing = store.load().collections.calendar.find((row) => row.id === id);
  if (!existing) throw new Error('calendar_local_event_required');
  const duration = new Date(existing.endAt) - new Date(existing.startAt);
  return saveCalendar({ ...existing, startAt, endAt: endAt || new Date(new Date(startAt).getTime() + duration).toISOString() });
}
```

- [ ] **Step 6: Implement recurrence scope actions and mobile long-press fallback**

Use `seriesMutationRecords` to save exception/split records for `single`, `future`, and `series`; require an explicit scope choice before a recurring edit or deletion. Mobile event cards expose a visible `改期` action, so long-press support is an enhancement rather than the only path.

- [ ] **Step 7: Run application, view, recurrence, and sync tests**

Run: `node --test tests/app-composition.test.mjs tests/calendar-view.test.mjs tests/calendar-recurrence.test.mjs tests/sync-controller.test.mjs`

Expected: PASS; no external source is mutated.

- [ ] **Step 8: Commit interactions**

```bash
git add src/app.mjs src/app/views/calendar-view.mjs tests/app-composition.test.mjs tests/calendar-view.test.mjs
git commit -m "feat: add smart calendar interactions"
```

---

### Task 7: Range-Aware Feishu and ICS Synchronization

**Files:**
- Modify: `src/app/browser-runtime.mjs`
- Modify: `supabase/functions/zos-calendar-data/index.ts`
- Modify: `supabase/functions/_shared/feishu-calendar.mjs`
- Modify: `tests/calendar-edge-function.test.mjs`
- Modify: `tests/feishu-calendar.test.mjs`
- Create: `tests/browser-calendar-range.test.mjs`

**Interfaces:**
- Consumes: `{ start, end }` ISO boundaries from `calendarVisibleRange`.
- Produces: authenticated `GET /functions/v1/zos-calendar-data?start=<ISO>&end=<ISO>` response with bounded items and `{ state, source, fetchedAt, range }` metadata.

- [ ] **Step 1: Write failing browser query and Edge range contract tests**

```js
test('browser runtime sends encoded calendar range boundaries', async () => {
  function jsonResponse(body, status = 200) {
    return { ok: status >= 200 && status < 300, status, async json() { return structuredClone(body); } };
  }
  function signedInStorage() {
    const values = new Map([
      ['zos_supabase_session', JSON.stringify({ userId: 'user-1', accessToken: 'access-token' })],
      ['zos_supabase_config', JSON.stringify({ url: 'https://example.supabase.co', anonKey: 'anon' })],
    ]);
    return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) };
  }
  const store = { load: () => ({ collections: { tasks: [], decisions: [], targets: [], inbox: [] }, tombstones: [] }), loadBaseRevisions: () => ({}), saveBaseRevisions() {}, replaceSnapshot() {} };
  const urls = [];
  const runtime = await createBrowserOperatingRuntime({ storage: signedInStorage(), store, deviceId: 'd1', fetchImpl: async (url) => {
    urls.push(String(url));
    return String(url).includes('zos-calendar-data') ? jsonResponse({ items: [], state: 'synced' }) : jsonResponse([]);
  }});
  await runtime.loadExternalCalendar({ start: '2026-08-03T00:00:00+08:00', end: '2026-08-10T00:00:00+08:00' });
  assert.match(urls.at(-1), /start=2026-08-03T00%3A00%3A00%2B08%3A00/);
  assert.match(urls.at(-1), /end=2026-08-10T00%3A00%3A00%2B08%3A00/);
});
```

Add source assertions to `calendar-edge-function.test.mjs` for `searchParams.get('start')`, `searchParams.get('end')`, `MAX_RANGE_DAYS`, `range_invalid`, and filtering ICS items by overlap.

Add a Feishu normalization assertion that `app_link: 'https://applink.feishu.cn/client/calendar/event/detail'` becomes `sourceUrl`, while `javascript:alert(1)` becomes `null`.

- [ ] **Step 2: Run focused tests and observe RED**

Run: `node --test tests/browser-calendar-range.test.mjs tests/calendar-edge-function.test.mjs`

Expected: range query assertions fail.

- [ ] **Step 3: Pass the range through browser runtime**

```js
async function loadExternalCalendar(fetchImpl, config, token, { start, end } = {}) {
  const endpoint = new URL('/functions/v1/zos-calendar-data', `${config.url.replace(/\/$/, '')}/`);
  if (start) endpoint.searchParams.set('start', start);
  if (end) endpoint.searchParams.set('end', end);
  const response = await fetchImpl(endpoint, { headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('calendar_read_failed');
  const payload = await response.json();
  if (!Array.isArray(payload.items)) throw new Error('calendar_contract_invalid');
  return { items: payload.items, state: payload.state || 'synced', fetchedAt: payload.fetchedAt || null, range: payload.range || null };
}
```

- [ ] **Step 4: Validate a maximum 370-day server range and use it for Feishu API queries**

```ts
const MAX_RANGE_DAYS = 370;

function requestedRange(req: Request) {
  const url = new URL(req.url);
  const start = new Date(url.searchParams.get('start') || Date.now() - 30 * 86400_000);
  const end = new Date(url.searchParams.get('end') || Date.now() + 180 * 86400_000);
  const span = end.getTime() - start.getTime();
  if (!Number.isFinite(span) || span <= 0 || span > MAX_RANGE_DAYS * 86400_000) throw Object.assign(new Error('range_invalid'), { status: 400 });
  return { start, end, startTime: Math.floor(start.getTime() / 1000), endTime: Math.floor(end.getTime() / 1000) };
}
```

- [ ] **Step 5: Filter normalized ICS events by overlap and retain the 500-item response cap**

```ts
const items = parseIcsCalendar(body).filter((item) => {
  const itemStart = new Date(item.startAt).getTime();
  const itemEnd = new Date(item.endAt || item.startAt).getTime();
  return itemEnd > range.start.getTime() && itemStart < range.end.getTime();
}).slice(0, 500);
```

- [ ] **Step 6: Preserve safe Feishu event deep links without exposing descriptions or identity fields**

```js
function safeSourceUrl(value) {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

// Add to the normalized event object:
sourceUrl: safeSourceUrl(item?.app_link),
```

- [ ] **Step 7: Run browser/Edge/auth tests**

Run: `node --test tests/browser-calendar-range.test.mjs tests/calendar-edge-function.test.mjs tests/feishu-calendar.test.mjs tests/ics-calendar.test.mjs tests/supabase-auth.test.mjs`

Expected: PASS; anonymous access remains rejected and identity data is not returned.

- [ ] **Step 8: Commit range synchronization**

```bash
git add src/app/browser-runtime.mjs supabase/functions/zos-calendar-data/index.ts supabase/functions/_shared/feishu-calendar.mjs tests/browser-calendar-range.test.mjs tests/calendar-edge-function.test.mjs tests/feishu-calendar.test.mjs
git commit -m "feat: sync visible calendar ranges"
```

---

### Task 8: Responsive Styling, Offline Cache, and Release Version

**Files:**
- Modify: `assets/app.css`
- Modify: `sw.js`
- Modify: `manifest.webmanifest`
- Modify: `tests/v1.7-ui.test.mjs`
- Modify: `tests/pwa-baseline.test.mjs`

**Interfaces:**
- Consumes: the markup/data attributes from Task 5.
- Produces: keyboard/touch-accessible desktop and mobile calendar UI plus an offline-complete v1.8.0 shell.

- [ ] **Step 1: Write failing CSS/PWA assertions**

```js
test('smart calendar has desktop drawers, drag states and mobile touch fallbacks', () => {
  for (const selector of ['.calendar-commandbar', '.calendar-editor-drawer', '.calendar-detail-drawer', '.calendar-trash-drawer', '.calendar-event[draggable="true"]', '.calendar-drop-target']) assert.match(css, new RegExp(selector.replaceAll('.', '\\.')));
  assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*\.calendar-month-grid/);
  assert.match(css, /min-height:\s*44px/);
});

test('v1.8 offline shell caches every smart calendar module', () => {
  assert.match(serviceWorker, /zos-workbench-v1\.8\.0/);
  for (const asset of ['src/app/calendar-range.mjs', 'src/app/calendar-event.mjs', 'src/app/calendar-recurrence.mjs']) assert.match(serviceWorker, new RegExp(asset.replaceAll('.', '\\.')));
  assert.equal(manifest.version, '1.8.0');
});
```

- [ ] **Step 2: Run UI/PWA tests and observe RED**

Run: `node --test tests/v1.7-ui.test.mjs tests/pwa-baseline.test.mjs`

Expected: missing styles/modules/version assertions fail.

- [ ] **Step 3: Implement desktop and mobile CSS states**

```css
.calendar-commandbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:14px; }
.calendar-commandbar button, .calendar-commandbar input, .calendar-drawer button { min-height:44px; }
.calendar-editor-drawer, .calendar-detail-drawer, .calendar-trash-drawer { position:fixed; top:0; right:0; z-index:80; width:min(480px,100%); height:100dvh; overflow:auto; background:#0b1626; border-left:1px solid var(--cc-border); box-shadow:-18px 0 50px rgba(0,0,0,.38); }
.calendar-event[draggable="true"] { cursor:grab; }
.calendar-drop-target { outline:2px solid var(--cc-accent-gold); outline-offset:-2px; }
@media (max-width:767px) {
  .calendar-month-grid, .calendar-week-timeline { display:block; }
  .calendar-day { margin-bottom:8px; min-height:72px; }
  .calendar-editor-drawer, .calendar-detail-drawer, .calendar-trash-drawer { top:auto; bottom:0; height:min(88dvh,760px); border-left:0; border-top:1px solid var(--cc-border); border-radius:18px 18px 0 0; }
}
```

- [ ] **Step 4: Add the three modules to `ASSETS_TO_CACHE`, set `CACHE_NAME` and manifest version to v1.8.0, and retain cache reload error handling**

- [ ] **Step 5: Run UI/PWA and syntax tests**

Run: `node --test tests/v1.7-ui.test.mjs tests/pwa-baseline.test.mjs && node --check sw.js && node --check src/app.mjs`

Expected: PASS.

- [ ] **Step 6: Commit responsive/PWA release assets**

```bash
git add assets/app.css sw.js manifest.webmanifest tests/v1.7-ui.test.mjs tests/pwa-baseline.test.mjs
git commit -m "feat: ship responsive smart calendar shell"
```

---

### Task 9: Integration, Regression, and Three-Gate Production Acceptance

**Files:**
- Create: `tests/smart-calendar-integration.test.mjs`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/zos-ceo-os-v1.8.0-production-acceptance.md`

**Interfaces:**
- Consumes: all completed local, sync, view, Edge, and PWA changes.
- Produces: a tested v1.8.0 release, deployed Edge Function and GitHub Pages commit, plus evidence-backed acceptance documentation.

- [ ] **Step 1: Write the failing end-to-end contract test before final wiring**

```js
test('smart calendar keeps local CRUD synchronized while external events remain read only', async () => {
  const state = { schemaVersion: '1.7', deviceId: 'd1', tombstones: [], collections: { tasks: [], inbox: [], projects: [], commands: [], decisions: [], targets: [], intelligence: [], calendar: [], life: [], focus_sessions: [], countdowns: [] } };
  const store = {
    load: () => structuredClone(state), subscribe: () => () => {},
    saveEntity(type, fields) { const row = { revision: 1, createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z', deletedAt: null, deviceId: 'd1', ...fields, id: fields.id || `id-${state.collections[type].length + 1}` }; state.collections[type] = [...state.collections[type].filter((item) => item.id !== row.id), row]; return structuredClone(row); },
    deleteEntity(type, id) { const row = state.collections[type].find((item) => item.id === id); state.collections[type] = state.collections[type].filter((item) => item.id !== id); const tombstone = { ...row, revision: row.revision + 1, deletedAt: '2026-08-03T01:00:00.000Z', entity: type }; state.tombstones.push(tombstone); return structuredClone(tombstone); },
    restoreEntity(type, id) { const tombstone = state.tombstones.find((item) => item.entity === type && item.id === id); state.tombstones = state.tombstones.filter((item) => item !== tombstone); const restored = { ...tombstone, revision: tombstone.revision + 1, deletedAt: null }; delete restored.entity; state.collections[type].push(restored); return structuredClone(restored); },
  };
  const app = createCeoOsApplication({ document: { getElementById: () => null, addEventListener() {} }, storage: { getItem: () => 'd1', setItem() {} }, store, createOperatingRuntime: false, now: () => '2026-08-03T08:00:00.000Z' });
  app.runtime.externalCalendar = [{ id: 'feishu:1', source: 'feishu', title: '飞书会议', startAt: '2026-08-04T02:00:00.000Z', endAt: '2026-08-04T03:00:00.000Z' }];
  const local = app.saveCalendar({ title: '本地安排', startAt: '2026-08-03T10:00', endAt: '2026-08-05T11:00', recurrenceRule: { frequency: 'weekly', interval: 1 } });
  assert.equal(app.viewModel().calendarLayout.days.filter((day) => day.events.some((row) => row.seriesId === local.id || row.id === local.id)).length >= 3, true);
  app.deleteCalendar(local.id);
  assert.equal(app.store.load().tombstones.some((row) => row.id === local.id), true);
  app.restoreCalendar(local.id);
  assert.throws(() => app.deleteCalendar('feishu:1'), /calendar_local_event_required/);
});
```

- [ ] **Step 2: Run the integration test and observe RED if any final wiring is missing**

Run: `node --test tests/smart-calendar-integration.test.mjs`

Expected: FAIL only on incomplete composition; do not weaken assertions.

- [ ] **Step 3: Complete composition and run Gate 1: focused unit/contract suite**

Run:

```bash
node --test tests/calendar-range.test.mjs tests/calendar-event.test.mjs tests/calendar-recurrence.test.mjs tests/calendar-center.test.mjs tests/calendar-view.test.mjs tests/state-store.test.mjs tests/app-composition.test.mjs tests/browser-calendar-range.test.mjs tests/calendar-edge-function.test.mjs tests/smart-calendar-integration.test.mjs
```

Expected: all pass, zero skipped and zero failed.

- [ ] **Step 4: Run Gate 2: full regression, syntax, diff, and PWA checks**

Run:

```bash
node --test --test-reporter=dot tests/*.test.mjs
find src -name '*.mjs' -print0 | xargs -0 -n1 node --check
node --check sw.js
git diff --check
```

Expected: all tests pass; every syntax check exits 0; `git diff --check` prints nothing.

- [ ] **Step 5: Update release documentation with actual verified counts and commit the release candidate**

Document the v1.8.0 features, immutable Feishu/ERP boundary, test command outputs, rollback commit, Edge Function deployment scope, and remaining manual device evidence. Use actual command results only.

```bash
git add tests/smart-calendar-integration.test.mjs README.md CHANGELOG.md docs/zos-ceo-os-v1.8.0-production-acceptance.md
git commit -m "docs: prepare v1.8 smart calendar release"
```

- [ ] **Step 6: Deploy only the changed calendar Edge Function and read back its authenticated boundary**

Run:

```bash
npx --yes supabase@latest functions deploy zos-calendar-data --project-ref dtwvyramgbwtlyhmkhkd
curl -sS -o /tmp/zos-calendar-anon.json -w '%{http_code}\n' 'https://dtwvyramgbwtlyhmkhkd.supabase.co/functions/v1/zos-calendar-data?start=2026-08-03T00%3A00%3A00%2B08%3A00&end=2026-08-10T00%3A00%3A00%2B08%3A00'
```

Expected: deploy succeeds; anonymous probe returns `401`, confirming authentication remains enforced. Do not print tokens or authenticated response bodies containing personal event metadata.

- [ ] **Step 7: Push `main`, wait for GitHub Pages CI, and perform Gate 3 production readback**

Run non-interactive Git commands to push the reviewed commits. Verify GitHub Actions and Pages both succeed, then read back:

- `https://xz1220z-afk.github.io/zos-workbench/sw.js` contains `zos-workbench-v1.8.0`.
- `manifest.webmanifest` reports version `1.8.0`.
- The production calendar route renders toolbar controls before remote data settles.
- Creating, editing, deleting, restoring, crossing dates, and navigating periods work in a signed-in browser session.
- A Feishu event has “打开来源/复制” but no edit/delete/drag action.
- A second-device session is recorded as manual evidence if unavailable; it is never fabricated.

- [ ] **Step 8: Record three-gate evidence and final rollback scope**

Update `docs/zos-ceo-os-v1.8.0-production-acceptance.md` with the exact deployed commit SHA, Edge Function version/time, Pages workflow result, test count, production URL, manual browser result, and rollback target. Commit only the acceptance evidence.

```bash
git add docs/zos-ceo-os-v1.8.0-production-acceptance.md
git commit -m "docs: record v1.8 production acceptance"
git push origin main
```

Expected: clean tracked worktree except preserved user-owned untracked files; no claim of four-device UAT without actual device evidence.

---

## Self-Review Mapping

- Spec sections 1 and 8 (authority/privacy matrix): Tasks 2, 4, 6, and 9.
- Spec sections 2 and 5 (navigation, multi-day, drag, mobile): Tasks 1, 5, 6, and 8.
- Spec sections 3 and 4 (editor, details, delete, copy, recycle): Tasks 2, 4, 5, and 6.
- Spec section 6 (recurrence and mutation scope): Tasks 3 and 6.
- Spec section 7 (visible-range sync/cache-safe refresh): Tasks 1, 6, and 7.
- Spec section 9 (conflict/revision/recovery): Tasks 3, 4, and 9.
- Spec sections 10 and 11 (performance/failure states): Tasks 5, 6, 7, and 8.
- Spec sections 12–14 (release boundary/acceptance/success): Tasks 8 and 9.

No direct Feishu write/delete path, team sharing, attendee invitation, AI auto-scheduling, or automatic trash purge is introduced.
