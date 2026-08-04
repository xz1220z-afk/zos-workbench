import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, app] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/app.css', root), 'utf8'),
  readFile(new URL('src/app.mjs', root), 'utf8'),
]);
const [serviceWorker, manifest] = await Promise.all([
  readFile(new URL('sw.js', root), 'utf8'),
  readFile(new URL('manifest.webmanifest', root), 'utf8').then(JSON.parse),
]);

test('v1.7 exposes execution, focus, merchant and availability surfaces', () => {
  for (const marker of [
    'id="todayExecutionRoot"', 'id="taskCenterRoot"', 'id="focusCenterRoot"',
    'id="merchantCenterRoot"', 'id="availabilityCenterRoot"', 'id="page-focus"',
  ]) assert.match(html, new RegExp(marker), `${marker} must be mounted`);
  assert.match(html, /class="nav-item" data-page="focus"/);
  for (const renderer of ['renderTodayExecution', 'renderTaskCenter', 'renderFocus', 'renderMerchant', 'renderAvailability']) {
    assert.match(app, new RegExp(renderer), `${renderer} must be composed by the production application`);
  }
});

test('mobile navigation uses the approved five destinations and retains secondary routes in More', () => {
  const nav = html.match(/<nav class="bottom-nav" id="bottomNav">([\s\S]*?)<\/nav>/)?.[1] || '';
  const labels = [...nav.matchAll(/<button[^>]*class="bottom-nav-item[^>]*>[\s\S]*?<span[^>]*>[\s\S]*?<\/span>\s*([^<]+?)\s*<\/button>/g)]
    .map((match) => match[1].trim());
  assert.deepEqual(labels, ['今日', '日历', '添加', '专注', '更多']);
  assert.match(nav, /data-mobile-add/);
  const more = html.match(/<section class="mobile-more-menu"[\s\S]*?<\/section>/)?.[0] || '';
  for (const page of ['dashboard', 'decisions', 'inbox', 'tasks', 'local-life', 'spark-media', 'intelligence', 'zos-brain']) {
    assert.match(more, new RegExp(`data-page="${page}"`), `${page} must remain available from More`);
  }
  assert.match(app, /taskCapture\)\s*\{\s*showTaskCenter\(\);\s*openTaskEditor\(\);/,
    'mobile Add must reveal the task page before mounting its editor drawer');
});

test('rich task editor covers planning, business linkage and focus metadata on all screen sizes', () => {
  const taskViewUrl = new URL('src/app/views/task-view.mjs', root);
  return readFile(taskViewUrl, 'utf8').then((taskView) => {
    for (const field of [
      'task-title', 'task-description', 'task-start-at', 'task-due-at', 'task-priority',
      'task-tags', 'task-company', 'task-project', 'task-business-entity',
      'task-estimate', 'task-reminder', 'task-recurrence', 'task-subtasks',
    ]) assert.match(taskView, new RegExp(field), `${field} must exist`);
    assert.match(css, /\.task-drawer/);
    assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*\.task-drawer/);
    assert.match(css, /overflow-x:\s*(?:auto|hidden|clip)/);
    assert.match(css, /#page-tasks\s*>\s*\.page-header[^{]*\{[^}]*display:\s*none\s*!important/,
      'the legacy task header must not duplicate the v1.7 task-center header');
    assert.match(css, /#page-tasks\s*>\s*#taskEmpty[^{]*\{[^}]*display:\s*none\s*!important/,
      'the legacy script must not revive its duplicate empty state with an inline display style');
    assert.match(css, /\.task-inline[^{]*\{[^}]*display:\s*flex/,
      'the all-day control must align as a compact touch row');
    assert.match(css, /\.task-field\s+input\[type="checkbox"\][^{]*\{[^}]*width:\s*20px/,
      'the all-day checkbox must not inherit the full-width text-input style');
  });
});

test('v1.8 PWA cache and manifest include every execution and smart-calendar module', () => {
  assert.match(serviceWorker, /zos-workbench-v1\.8\.1/);
  for (const asset of [
    'src/app/task-center.mjs', 'src/app/focus-center.mjs', 'src/app/countdown-center.mjs',
    'src/app/availability-center.mjs', 'src/app/merchant-center.mjs',
    'src/app/views/task-view.mjs', 'src/app/views/focus-view.mjs',
    'src/app/views/today-execution-view.mjs', 'src/app/views/availability-view.mjs',
    'src/app/views/merchant-view.mjs',
    'src/app/calendar-range.mjs', 'src/app/calendar-event.mjs',
    'src/app/calendar-selection.mjs', 'src/app/calendar-recurrence.mjs',
    'src/app/important-dates.mjs', 'src/app/views/calendar-view.mjs',
  ]) assert.match(serviceWorker, new RegExp(asset.replaceAll('.', '\\.')), `${asset} must be cached`);
  assert.equal(manifest.version, '1.8.1');
  assert.ok(manifest.shortcuts.some((item) => item.url === './#focus'));
});

test('smart calendar has responsive touch controls, source-safe drawers and drag feedback', async () => {
  const calendarView = await readFile(new URL('src/app/views/calendar-view.mjs', root), 'utf8');
  for (const marker of [
    'calendar-commandbar', 'calendar-editor-drawer', 'calendar-detail-drawer',
    'calendar-trash-drawer', 'calendar-form-row', 'calendar-scope-dialog',
  ]) assert.match(calendarView, new RegExp(marker), `${marker} must be rendered`);
  assert.match(css, /\.calendar-commandbar[^{]*\{[^}]*display:\s*(?:flex|grid)/);
  assert.match(css, /\.calendar-drawer[^{]*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.calendar-event\[draggable="true"\]/);
  assert.match(css, /\.calendar-drop-target/);
  assert.match(css, /\.calendar-day\.is-selected/);
  assert.match(css, /\.calendar-day\.is-selecting/);
  assert.match(css, /\.calendar-month-grid[^{]*\{[^}]*touch-action:\s*pan-y/,
    'touch users must be able to scroll vertically until a deliberate long press begins selection');
  assert.match(css, /\.calendar-kind-switch/);
  assert.match(css, /\.important-dates-drawer/);
  assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*\.calendar-drawer[^{]*\{[^}]*width:\s*100%/);
  assert.match(css, /\.calendar-commandbar button[^{]*\{[^}]*min-height:\s*44px/,
    'calendar actions must meet the mobile touch target baseline');
});
