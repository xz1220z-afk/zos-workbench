import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildMobileDashboard } from '../src/app/mobile-dashboard.mjs';
import { render as renderMobile } from '../src/app/views/mobile-view.mjs';
import { render as renderDashboard } from '../src/app/views/dashboard-view.mjs';

test('mobile CEO cockpit derives agent metrics and limits today actions to three', () => {
  const model = buildMobileDashboard({
    agentOsOverview: { summary: { total: 12 } },
    agentRuns: [{ status: 'running' }, { status: 'completed' }, { status: 'failed' }],
    todayTop3: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
    mustRead: [{ id: 'intel-1' }], calendar: [{ id: 'cal-1' }], health: [{ state: 'synced' }],
  });

  assert.deepEqual(model.agentMetrics, { total: 12, running: 1, completed: 1, failed: 1 });
  assert.equal(model.topActions.length, 3);
  assert.deepEqual(model.sections.map((item) => item.id), ['companies', 'calendar', 'intelligence', 'health']);
});

test('mobile CEO cockpit renders routed summaries without company detail tables', () => {
  const container = { innerHTML: '' };
  renderMobile(container, {
    homePresence: { title: '今天先处理回款', summary: '两项行动需要确认。' },
    agentOsOverview: { summary: { total: 5 } },
    agentRuns: [{ status: 'executing' }, { status: 'error' }],
    todayTop3: [{ id: 'today-1', title: '核对回款' }],
    companyOperating: { wanjia: {}, huahuo: {} },
    calendar: [{ id: 'calendar-1' }], mustRead: [{ id: 'intel-1' }], health: [{ state: 'stale' }],
  });

  assert.match(container.innerHTML, /CEO ACTION COCKPIT/);
  assert.match(container.innerHTML, /今天先处理回款/);
  assert.match(container.innerHTML, /核对回款/);
  ['local-life', 'calendar', 'intelligence', 'health'].forEach((pageId) => {
    assert.match(container.innerHTML, new RegExp(`data-page="${pageId}"`));
  });
  assert.doesNotMatch(container.innerHTML, /万嘉网络|花火影像|玲丽教育/);
});

test('dashboard page mounts exactly one mobile cockpit root rendered by the application', async () => {
  const [indexHtml, appSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
  ]);
  const roots = indexHtml.match(/id="mobileDashboardRoot"/g) || [];
  const dashboardStart = indexHtml.indexOf('<section class="page active" id="page-dashboard">');
  const dashboardEnd = indexHtml.indexOf('<!-- ===== 生活首页 ===== -->');
  const mobileRoot = indexHtml.indexOf('id="mobileDashboardRoot"');

  assert.equal(roots.length, 1);
  assert.ok(mobileRoot > dashboardStart && mobileRoot < dashboardEnd);
  assert.match(appSource, /renderMobile\(document\?\.getElementById\('mobileDashboardRoot'\), model\)/);
});

test('desktop dashboard rendering does not create a duplicate mobile cockpit root', () => {
  const container = { innerHTML: '' };
  renderDashboard(container, { state: 'ready', decisions: [], importantDates: { work: [] }, todayTop3: [], health: [], mustRead: [], calendar: [], weather: {} });

  assert.equal((container.innerHTML.match(/id="mobileDashboardRoot"/g) || []).length, 0);
});
