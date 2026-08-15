# ZOS Mobile AI Office Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 ZOS CEO Operating System 上增量实现“B 的 CEO 行动驾驶舱 + A 的中央语音按钮 + C 的组织/部门/Agent 分层入口”，让手机端成为可直接查询、派任务和受控执行的 AI 办公室。

**Architecture:** 保留原生 HTML/CSS/ES modules、现有路由、数据模型和 AI/Agent 执行链。新增三个纯函数模块分别负责移动导航、CEO 摘要和 Agent 分层，视图只渲染这些模型；中央语音面板复用既有 `voice-input.mjs`、`ai-command-center.mjs` 和 `controlled-execution.mjs`，不创建第二套任务或会话数据。

**Tech Stack:** 原生 HTML、CSS、JavaScript ES modules、Node.js `node:test`、浏览器 SpeechRecognition、GitHub Pages PWA、现有 Supabase/OpenAI 受控接口。

## Global Constraints

- 不新建第二个工作台，不删除、迁移或覆盖现有页面、路由、导航数据、用户数据、Agent 任务、日历、情报或公司数据。
- 手机底部固定为“今日、日历、语音、Agent、更多”；所有旧路由仍须可达。
- 语音只在本人点击或按住时工作，不持续监听、不后台录音、不保存原始音频；拒绝权限后键盘输入仍可用。
- Agent 必须从现有动态索引读取，不写死身份或数量；每个 Agent 继续使用独立规则、知识入口、上下文摘要和历史任务。
- L0 只读动作可直接执行；L1 本机草案可撤销；L2 外部写入、外发、删除、付款、合同、权限和自动化必须预览确认。
- 不引入 React 或第二套框架；不使用 `transition: all`；动效支持 `prefers-reduced-motion`。
- 页面内操作只更新当前区域，不重绘隐藏页面；失败保留输入、滚动位置和可重试动作。
- 发布版本为 `2.10.0`；`index.html`、`manifest.json`、`sw.js`、模块查询参数、版本断言、功能账本和发布记录必须一致。
- 上线前完成三轮验收：自动化功能轮、四尺寸体验轮、正式站线上轮。

---

## File Responsibility Map

- `src/app/mobile-navigation.mjs`：移动端五主入口、更多分组、最近使用与固定入口的纯函数契约。
- `src/app/mobile-dashboard.mjs`：从现有 view model 生成 CEO 手机摘要，不读取网络、不写数据。
- `src/app/mobile-agent-directory.mjs`：将动态 Agent 索引组织成“组织 → 部门 → Agent”树，并应用私密隔离。
- `src/app/views/mobile-view.mjs`：渲染手机 CEO 行动驾驶舱。
- `src/app/views/mobile-command-sheet.mjs`：渲染中央语音/键盘任务面板，复用现有 AI 状态。
- `src/app/views/agent-workbench-view.mjs`：在现有 Agent 页面增加移动分层目录，不替换桌面卡片与详情抽屉。
- `src/app.mjs`：事件编排、现有 AI/Agent/任务链复用和当前页局部刷新。
- `src/legacy-app.mjs`：移动导航壳、当前路由高亮和更多面板开关。
- `index.html`：底部导航与移动更多面板静态语义结构。
- `assets/app.css`：移动布局、材质、按压、抽屉、骨架、性能和 reduced-motion 契约。
- `tests/*.test.mjs`：纯函数、视图、集成、可访问性、PWA 和发布回归。

---

### Task 1: Mobile Navigation Contract and Central AI Entry

**Files:**
- Create: `src/app/mobile-navigation.mjs`
- Create: `tests/mobile-navigation.test.mjs`
- Modify: `index.html:852-906`
- Modify: `src/legacy-app.mjs:2150-2285`
- Modify: `assets/app.css:1015-1060,2039-2050`

**Interfaces:**
- Produces: `MOBILE_PRIMARY_ITEMS`, `MOBILE_MORE_GROUPS`, `mobilePrimaryPage(pageId)`, `buildMobileMoreGroups({ recentPages, pinnedPages })`.
- Consumes: existing page IDs and `window.navigateTo(pageId)`.

- [ ] **Step 1: Write the failing navigation contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOBILE_PRIMARY_ITEMS,
  buildMobileMoreGroups,
  mobilePrimaryPage,
} from '../src/app/mobile-navigation.mjs';

test('mobile navigation exposes Today, Calendar, Voice, Agent and More without dropping old routes', () => {
  assert.deepEqual(MOBILE_PRIMARY_ITEMS.map((item) => item.id), ['today', 'calendar', 'voice', 'agent-workbench', 'more']);
  assert.equal(mobilePrimaryPage('agent-workbench'), 'agent-workbench');
  assert.equal(mobilePrimaryPage('local-life'), 'more');
  const groups = buildMobileMoreGroups({ recentPages: ['local-life'], pinnedPages: ['intelligence'] });
  const routes = groups.flatMap((group) => group.items.map((item) => item.pageId));
  for (const pageId of ['dashboard', 'decisions', 'local-life', 'spark-media', 'lingli', 'intelligence', 'tasks', 'zos-brain', 'settings']) {
    assert.equal(routes.includes(pageId), true, pageId);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/mobile-navigation.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/app/mobile-navigation.mjs`.

- [ ] **Step 3: Implement the pure navigation model**

```js
export const MOBILE_PRIMARY_ITEMS = Object.freeze([
  { id: 'today', label: '今日', pageId: 'dashboard' },
  { id: 'calendar', label: '日历', pageId: 'calendar' },
  { id: 'voice', label: '语音', action: 'open-ai-command' },
  { id: 'agent-workbench', label: 'Agent', pageId: 'agent-workbench' },
  { id: 'more', label: '更多', action: 'open-more' },
]);

export const MOBILE_MORE_GROUPS = Object.freeze([
  { id: 'business', label: '公司经营', items: [['local-life', '万嘉网络'], ['spark-media', '花火影像'], ['lingli', '玲丽教育'], ['enterprise', '企业项目'], ['targets', '经营目标']] },
  { id: 'knowledge-ai', label: '知识与 AI', items: [['intelligence', '情报中心'], ['content-growth', '内容增长'], ['zos-brain', '知识库'], ['search', '全局搜索']] },
  { id: 'personal-system', label: '个人与系统', items: [['life', '生活首页'], ['relations', '关系与跟进'], ['reviews', '复盘中心'], ['inbox', '收集箱'], ['tasks', '任务'], ['risk', '风险中心'], ['privacy', '隐私与数据'], ['settings', '设置'], ['dashboard', '工作首页'], ['decisions', '待我决策'], ['health', '数据健康']] },
]);

export function mobilePrimaryPage(pageId) {
  return MOBILE_PRIMARY_ITEMS.some((item) => item.pageId === pageId) ? pageId : 'more';
}

export function buildMobileMoreGroups({ recentPages = [], pinnedPages = [] } = {}) {
  const preferred = [...new Set([...recentPages, ...pinnedPages])];
  return MOBILE_MORE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map(([pageId, label]) => ({ pageId, label, preferred: preferred.includes(pageId) })),
  }));
}
```

- [ ] **Step 4: Replace only the mobile bottom navigation markup**

Change the `index.html` mobile navigation so the center button uses `data-mobile-ai-command`, the fourth button routes to `agent-workbench`, and the more panel contains three labelled groups. Keep every old `data-page` route from the current more grid.

```html
<button class="bottom-nav-item bottom-nav-voice" type="button" data-mobile-ai-command aria-label="打开 AI 语音与文字输入">
  <span class="bn-icon" aria-hidden="true">●</span><span>语音</span>
</button>
<button class="bottom-nav-item" data-page="agent-workbench">
  <span class="bn-icon" aria-hidden="true">✦</span><span>Agent</span>
</button>
```

- [ ] **Step 5: Integrate highlighter and more-panel behavior**

Import `mobilePrimaryPage` in `legacy-app.mjs`; in `navigateTo`, map secondary pages to `more`, keep the mobile menu open only until a route is chosen, and never call `navigateTo` for the voice action.

```js
const mobileTarget = mobilePrimaryPage(pageId);
document.querySelectorAll('#bottomNav .bottom-nav-item').forEach((item) => {
  const itemId = item.dataset.page || (item.id === 'mobileMoreToggle' ? 'more' : 'voice');
  item.classList.toggle('active', itemId === mobileTarget);
});
```

- [ ] **Step 6: Run focused navigation regressions**

Run: `node --test tests/mobile-navigation.test.mjs tests/navigation-preferences.test.mjs tests/v1.7-ui.test.mjs tests/pwa-baseline.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit the navigation slice**

```bash
git add index.html assets/app.css src/legacy-app.mjs src/app/mobile-navigation.mjs tests/mobile-navigation.test.mjs
git commit -m "feat: add mobile AI office navigation"
```

---

### Task 2: Central Voice and Keyboard Command Sheet

**Files:**
- Create: `src/app/views/mobile-command-sheet.mjs`
- Create: `tests/mobile-command-sheet.test.mjs`
- Modify: `src/app.mjs:430-490,2550-2670,3060-3090,3210-3260`
- Modify: `assets/app.css:2608-2740`

**Interfaces:**
- Produces: `renderMobileCommandSheetHtml(model)` and `renderMobileCommandSheet(container, model)`.
- Consumes: existing `runtime.aiCommand`, `startAiVoice()`, `stopAiVoice()`, `setAiCommandInput()`, `submitAiCommand()` and `renderAiCommandHtml()` state contract.

- [ ] **Step 1: Write the failing command-sheet rendering test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMobileCommandSheetHtml } from '../src/app/views/mobile-command-sheet.mjs';

test('mobile command sheet keeps voice optional and typed input available', () => {
  const html = renderMobileCommandSheetHtml({
    open: true,
    input: '查一下万嘉今天的数据',
    scope: 'wanjia',
    state: 'idle',
    voice: { supported: false, state: 'unsupported' },
  });
  assert.match(html, /data-mobile-ai-command-sheet/);
  assert.match(html, /查一下万嘉今天的数据/);
  assert.match(html, /data-ai-command-input/);
  assert.match(html, /当前浏览器不支持语音/);
  assert.doesNotMatch(html, /disabled[^>]*data-ai-command-input/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/mobile-command-sheet.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement a view that reuses the existing AI contract**

```js
import { escapeHtml } from './view-utils.mjs?v=2.10.0';

export function renderMobileCommandSheetHtml(model = {}) {
  if (!model.open) return '';
  const voice = model.voice || { supported: false, state: 'unsupported' };
  const listening = voice.state === 'listening';
  return `<div class="mobile-ai-backdrop" data-mobile-ai-close></div>
    <aside class="mobile-ai-sheet" data-mobile-ai-command-sheet role="dialog" aria-modal="true" aria-labelledby="mobileAiTitle">
      <header><div><small>AI OFFICE</small><h2 id="mobileAiTitle">说出或输入任务</h2></div><button type="button" data-mobile-ai-close aria-label="关闭">×</button></header>
      <form data-ai-command-form>
        <textarea data-ai-command-input name="command" rows="4">${escapeHtml(model.input || '')}</textarea>
        <div class="mobile-ai-controls">
          <button type="button" data-ai-voice-toggle aria-pressed="${listening}">${listening ? '松开结束' : '按住说话'}</button>
          <button type="submit" class="v13-action v13-action-primary">交给 AI</button>
        </div>
      </form>
      <p>${voice.supported ? '只在你主动操作时收音，不保存原始音频。' : '当前浏览器不支持语音；键盘输入仍可使用。'}</p>
    </aside>`;
}

export function renderMobileCommandSheet(container, model = {}) {
  if (container) container.innerHTML = renderMobileCommandSheetHtml(model);
}
```

- [ ] **Step 4: Add runtime open/close state without new persisted data**

Add `runtime.mobileAiSheetOpen = false`; expose `openMobileAiSheet()` and `closeMobileAiSheet()` that only change runtime UI state and render the current page. Bind `[data-mobile-ai-command]` to open, `[data-mobile-ai-close]` to close, and reuse the existing input/voice/submit handlers inside the sheet.

```js
function openMobileAiSheet() {
  runtime.mobileAiSheetOpen = true;
  renderCurrentPage();
}

function closeMobileAiSheet() {
  runtime.mobileAiSheetOpen = false;
  renderCurrentPage();
}
```

- [ ] **Step 5: Add an integration test for shared state and permission fallback**

Append to `tests/ai-command-voice-integration.test.mjs`:

```js
test('mobile sheet uses the same AI command state and preserves text when voice is unavailable', () => {
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {}, defaultView: null },
    storage: memoryStorage(), createOperatingRuntime: false, SpeechRecognition: null,
  });
  app.openMobileAiSheet();
  app.setAiCommandInput('生成今天的 CEO 行动建议');
  assert.equal(app.viewModel().mobileAiSheetOpen, true);
  assert.equal(app.viewModel().aiCommand.input, '生成今天的 CEO 行动建议');
  assert.equal(app.startAiVoice(), false);
  assert.equal(app.viewModel().aiCommand.input, '生成今天的 CEO 行动建议');
});
```

- [ ] **Step 6: Run command and safety regressions**

Run: `node --test tests/mobile-command-sheet.test.mjs tests/ai-command-voice-integration.test.mjs tests/ai-command-integration.test.mjs tests/controlled-execution.test.mjs`

Expected: all tests PASS; L2 actions still require preview.

- [ ] **Step 7: Commit the command-sheet slice**

```bash
git add assets/app.css src/app.mjs src/app/views/mobile-command-sheet.mjs tests/mobile-command-sheet.test.mjs tests/ai-command-voice-integration.test.mjs
git commit -m "feat: add central mobile AI command sheet"
```

---

### Task 3: CEO Mobile Action Cockpit

**Files:**
- Create: `src/app/mobile-dashboard.mjs`
- Create: `tests/mobile-dashboard.test.mjs`
- Modify: `src/app/views/mobile-view.mjs`
- Modify: `src/app/views/dashboard-view.mjs`
- Modify: `src/app.mjs:3180-3260`
- Modify: `assets/app.css`

**Interfaces:**
- Produces: `buildMobileDashboard(viewModel)` returning `{ headline, agentMetrics, topActions, sections }`.
- Consumes: `viewModel.agentOsOverview`, `agentRuns`, `todayTop3`, `companyOperating`, `mustRead`, `calendar`, `health` and existing dynamic homepage presence.

- [ ] **Step 1: Write the failing pure-model test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMobileDashboard } from '../src/app/mobile-dashboard.mjs';

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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/mobile-dashboard.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the derived mobile model**

```js
function countStatus(runs, values) {
  return runs.filter((run) => values.includes(run.status)).length;
}

export function buildMobileDashboard(viewModel = {}) {
  const runs = Array.isArray(viewModel.agentRuns) ? viewModel.agentRuns : [];
  return {
    headline: viewModel.homePresence || { title: '等待当前事实', summary: '刷新来源后生成今日行动摘要。' },
    agentMetrics: {
      total: Number(viewModel.agentOsOverview?.summary?.total) || 0,
      running: countStatus(runs, ['running', 'executing']),
      completed: countStatus(runs, ['completed']),
      failed: countStatus(runs, ['failed', 'error']),
    },
    topActions: (viewModel.todayTop3 || []).slice(0, 3),
    sections: [
      { id: 'companies', pageId: 'local-life', count: Object.keys(viewModel.companyOperating || {}).length },
      { id: 'calendar', pageId: 'calendar', count: (viewModel.calendar || []).length },
      { id: 'intelligence', pageId: 'intelligence', count: (viewModel.mustRead || []).length },
      { id: 'health', pageId: 'health', count: (viewModel.health || []).filter((item) => item.state !== 'synced').length },
    ],
  };
}
```

- [ ] **Step 4: Replace the current count-only mobile view with action-first markup**

Render one headline, four Agent metrics, Top 3, and collapsible company/calendar/intelligence/health summaries. Every summary button must use its existing `data-page` route. Do not duplicate company detail tables.

```js
export function render(container, viewModel = {}) {
  if (!container) return;
  const mobile = buildMobileDashboard(viewModel);
  container.innerHTML = `<section class="mobile-ceo-head"><small>CEO ACTION COCKPIT</small><h2>${escapeHtml(mobile.headline.title)}</h2><p>${escapeHtml(mobile.headline.summary)}</p></section>
    <section class="mobile-agent-metrics" aria-label="Agent 运行状态">${Object.entries(mobile.agentMetrics).map(([key, value]) => `<article data-agent-metric="${key}"><strong>${value}</strong><span>${METRIC_LABELS[key]}</span></article>`).join('')}</section>
    ${renderTopActions(mobile.topActions)}${renderMobileSections(mobile.sections)}`;
}
```

- [ ] **Step 5: Ensure dashboard renders desktop and mobile roots from one view model**

Keep `dashboard-view.mjs` desktop markup unchanged. Pass the same complete view model into `mobile-view.mjs`; hide the mobile root above the existing mobile breakpoint and hide desktop secondary regions below it.

- [ ] **Step 6: Run dashboard regressions**

Run: `node --test tests/mobile-dashboard.test.mjs tests/dashboard-apple-hierarchy.test.mjs tests/dashboard-production-fixes.test.mjs tests/app-composition.test.mjs`

Expected: all tests PASS; desktop dashboard remains unchanged above the mobile breakpoint.

- [ ] **Step 7: Commit the dashboard slice**

```bash
git add assets/app.css src/app.mjs src/app/mobile-dashboard.mjs src/app/views/mobile-view.mjs src/app/views/dashboard-view.mjs tests/mobile-dashboard.test.mjs
git commit -m "feat: add mobile CEO action cockpit"
```

---

### Task 4: Organization, Department and Agent Mobile Directory

**Files:**
- Create: `src/app/mobile-agent-directory.mjs`
- Create: `tests/mobile-agent-directory.test.mjs`
- Modify: `src/app/views/agent-workbench-view.mjs`
- Modify: `src/app.mjs`
- Modify: `assets/app.css`

**Interfaces:**
- Produces: `buildMobileAgentDirectory(agents, { recentAgentIds, expandedOrganizationId, expandedDepartmentId })`.
- Consumes: existing dynamic Agent objects including `agentId`, `category`, `organization`, `department`, `status`, `runtimeAvailability`, `sections`, `skillIds`, `updatedAt`.

- [ ] **Step 1: Write failing grouping and privacy tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMobileAgentDirectory } from '../src/app/mobile-agent-directory.mjs';

test('dynamic agents are grouped by organization and department without exposing REL-001 to companies', () => {
  const directory = buildMobileAgentDirectory([
    { agentId: 'WANJIA-001', category: 'wanjia', organization: '万嘉网络', department: '运营', status: 'active' },
    { agentId: 'WANJIA-002', category: 'wanjia', organization: '万嘉网络', department: '销售', status: 'pilot' },
    { agentId: 'REL-001', category: 'life', organization: '个人中心', department: '私密关系', status: 'draft', confidentiality: 'private' },
  ]);
  assert.deepEqual(directory.map((item) => item.name), ['万嘉网络', '个人中心']);
  assert.deepEqual(directory[0].departments.map((item) => item.name), ['运营', '销售']);
  assert.equal(directory[0].departments.flatMap((item) => item.agents).some((item) => item.agentId === 'REL-001'), false);
  assert.equal(directory[1].departments[0].agents[0].agentId, 'REL-001');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/mobile-agent-directory.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement dynamic normalization and grouping**

```js
const CATEGORY_ORG = Object.freeze({ shared: '共享中台', wanjia: '万嘉网络', huahuo: '花火影像', lingli: '玲丽教育', life: '个人中心' });

export function buildMobileAgentDirectory(agents = [], options = {}) {
  const organizations = new Map();
  for (const agent of agents) {
    const name = agent.organization || CATEGORY_ORG[agent.category] || '未分类';
    const department = agent.department || agent.sections?.department || '综合';
    if (!organizations.has(name)) organizations.set(name, new Map());
    const departments = organizations.get(name);
    if (!departments.has(department)) departments.set(department, []);
    departments.get(department).push({ ...agent, recent: (options.recentAgentIds || []).includes(agent.agentId) });
  }
  return [...organizations].map(([name, departments]) => ({
    id: name,
    name,
    departments: [...departments].map(([departmentName, groupedAgents]) => ({ name: departmentName, agents: groupedAgents })),
  }));
}
```

- [ ] **Step 4: Add a mobile-only directory above the existing catalog**

Keep the current filter nav, desktop Agent cards, detail drawer, direct analysis and task history. Under the mobile breakpoint, show organization rows, department disclosures and compact Agent rows with existing `data-agent-details`, `data-agent-analyze` and `data-agent-invoke` actions.

```html
<details class="mobile-agent-organization" data-agent-organization="万嘉网络">
  <summary><span>万嘉网络</span><strong>2 Agents</strong></summary>
  <details class="mobile-agent-department"><summary>运营</summary><button data-agent-details="WANJIA-001">万嘉运营 Agent</button></details>
</details>
```

- [ ] **Step 5: Add view tests for dynamic hierarchy and task handoff**

Append to `tests/agent-os-view.test.mjs`:

```js
test('mobile Agent directory keeps dynamic identity actions and existing task handoff', () => {
  const node = container();
  render(node, {
    ...base,
    mobileAgentDirectory: [{ name: '万嘉网络', departments: [{ name: '运营', agents: base.agentOsAgents }] }],
  });
  assert.match(node.innerHTML, /mobile-agent-organization/);
  assert.match(node.innerHTML, /万嘉网络/);
  assert.match(node.innerHTML, /运营/);
  assert.match(node.innerHTML, /data-agent-invoke="WANJIA-001"/);
});
```

- [ ] **Step 6: Run Agent privacy and handoff regressions**

Run: `node --test tests/mobile-agent-directory.test.mjs tests/agent-os-center.test.mjs tests/agent-os-view.test.mjs tests/agent-task-context.test.mjs tests/agent-workbench.test.mjs`

Expected: all tests PASS; REL-001 remains in the private personal branch and private context remains local-only.

- [ ] **Step 7: Commit the Agent directory slice**

```bash
git add assets/app.css src/app.mjs src/app/mobile-agent-directory.mjs src/app/views/agent-workbench-view.mjs tests/mobile-agent-directory.test.mjs tests/agent-os-view.test.mjs
git commit -m "feat: add mobile Agent organization directory"
```

---

### Task 5: Progressive Disclosure for Tasks, Calendar, Intelligence and More

**Files:**
- Create: `tests/mobile-high-frequency-flows.test.mjs`
- Modify: `src/app/views/task-view.mjs`
- Modify: `src/app/views/calendar-view.mjs`
- Modify: `src/app/views/intelligence-view.mjs`
- Modify: `src/app.mjs`
- Modify: `index.html`
- Modify: `assets/app.css`

**Interfaces:**
- Consumes: existing task drawer actions, `calendarView = 'month'`, calendar event actions, intelligence filters/questions/read-state/task-draft actions, and `buildMobileMoreGroups()`.
- Produces: mobile disclosures and bottom sheets only; no new business collections.

- [ ] **Step 1: Write failing static and rendering tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCalendarHtml } from '../src/app/views/calendar-view.mjs';
import { render as renderIntelligence } from '../src/app/views/intelligence-view.mjs';

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
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/mobile-high-frequency-flows.test.mjs`

Expected: FAIL because grouped more-menu markup and mobile disclosure hooks are absent.

- [ ] **Step 3: Add task mobile summary and existing drawer handoff**

On narrow screens, render the task page header with only “今日、逾期、我创建的” quick filters; keep the existing full filter controls inside an accessible disclosure. Task row taps must open the existing task drawer and preserve Agent context.

```html
<nav class="mobile-task-quick-filters" aria-label="任务快捷筛选">
  <button data-task-quick-filter="today">今日</button>
  <button data-task-quick-filter="overdue">逾期</button>
  <button data-task-quick-filter="mine">我创建的</button>
</nav>
```

- [ ] **Step 4: Keep month as calendar default and add mobile day sheet**

Reuse `setCalendarView('month')`. A date tap opens the existing selected-day state in a bottom sheet; task long-press opens the existing edit/delete preview. Do not use desktop drag as the only mobile interaction.

```js
const dateButton = event.target?.closest?.('[data-calendar-date]');
if (dateButton) {
  runtime.calendarSelectedDate = dateButton.dataset.calendarDate;
  runtime.calendarDaySheetOpen = true;
  renderCurrentPage();
}
```

- [ ] **Step 5: Collapse intelligence filters and keep actions reachable**

Wrap the existing latest/unread/company/topic filters in a mobile disclosure. Preserve `data-intelligence-question`, `data-intelligence-read`, source links and task-draft actions; render action success/failure in the current card or bottom drawer rather than a full-page refresh.

```html
<details class="mobile-intelligence-filters">
  <summary>筛选与排序</summary>
  <div class="intelligence-workbench-toolbar"></div>
</details>
```

- [ ] **Step 6: Render three labelled More groups**

Use `buildMobileMoreGroups()` to render company, knowledge/AI and personal/system sections. Mark preferred pages with `data-preferred="true"`; preserve every existing page button.

- [ ] **Step 7: Run high-frequency regressions**

Run: `node --test tests/mobile-high-frequency-flows.test.mjs tests/task-center.test.mjs tests/calendar-default-month.test.mjs tests/calendar-view.test.mjs tests/intelligence-view.test.mjs tests/intelligence-question-actions.test.mjs tests/intelligence-responsive-layout.test.mjs`

Expected: all tests PASS.

- [ ] **Step 8: Commit the high-frequency flow slice**

```bash
git add index.html assets/app.css src/app.mjs src/app/views/task-view.mjs src/app/views/calendar-view.mjs src/app/views/intelligence-view.mjs tests/mobile-high-frequency-flows.test.mjs
git commit -m "feat: refine mobile daily workflows"
```

---

### Task 6: Apple-style Interaction, Performance and Accessibility Contract

**Files:**
- Create: `tests/mobile-interaction-performance.test.mjs`
- Modify: `assets/app.css`
- Modify: `src/app.mjs`
- Modify: `src/legacy-app.mjs`

**Interfaces:**
- Consumes: existing `.v13-action`, `.bottom-nav-item`, drawers, toasts and `renderCurrentPage()`.
- Produces: shared mobile motion tokens, stable content-shell transitions, local busy states and saved scroll positions.

- [ ] **Step 1: Write the failing CSS and runtime contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../assets/app.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');

test('mobile interaction uses targeted motion, safe-area spacing and current-region rendering', () => {
  assert.match(css, /--mobile-press-duration:\s*120ms/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(css, /transition:\s*all/);
  assert.match(app, /renderCurrentPage/);
  assert.doesNotMatch(app, /data-mobile-ai-command[\s\S]{0,300}renderAllPages/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/mobile-interaction-performance.test.mjs`

Expected: FAIL because the new token and mobile-specific local rendering assertions are not yet present.

- [ ] **Step 3: Add shared mobile interaction tokens and contained materials**

```css
:root {
  --mobile-press-duration: 120ms;
  --mobile-sheet-duration: 220ms;
  --mobile-surface: rgba(15, 27, 45, .88);
  --mobile-border: rgba(255, 255, 255, .09);
}

@media (max-width: 720px) {
  :where(.bottom-nav-item, .v13-action, .mobile-more-item) {
    min-height: 44px;
    transition: transform var(--mobile-press-duration) ease, opacity var(--mobile-press-duration) ease, background-color var(--mobile-press-duration) ease;
  }
  :where(.bottom-nav-item, .v13-action, .mobile-more-item):active { transform: scale(.97); }
  .mobile-ai-sheet { padding-bottom: calc(16px + env(safe-area-inset-bottom)); }
}

@media (prefers-reduced-motion: reduce) {
  :where(.bottom-nav-item, .v13-action, .mobile-more-item, .mobile-ai-sheet) { transition: none; transform: none; }
}
```

- [ ] **Step 4: Preserve local state through page and drawer interactions**

Before navigation, save the current content scroll position in runtime memory keyed by page ID. After `navigateTo`, restore it with `requestAnimationFrame`. Do not persist scroll positions to user storage.

```js
const pageScroll = new Map();
function rememberPageScroll(pageId) { pageScroll.set(pageId, document.scrollingElement?.scrollTop || 0); }
function restorePageScroll(pageId) {
  requestAnimationFrame(() => globalThis.scrollTo?.({ top: pageScroll.get(pageId) || 0, behavior: 'instant' }));
}
```

- [ ] **Step 5: Add local busy and error feedback**

Buttons that trigger AI, Agent, intelligence or refresh actions receive `aria-busy="true"` only while their promise is active. On failure, remove busy state, retain user input and show the existing safe toast or inline state. Never replace the entire page with a loading screen.

- [ ] **Step 6: Run interaction and composition regressions**

Run: `node --test tests/mobile-interaction-performance.test.mjs tests/apple-interaction-system.test.mjs tests/app-composition.test.mjs tests/dashboard-production-fixes.test.mjs tests/intelligence-responsive-layout.test.mjs`

Expected: all tests PASS; no `transition: all`; no hidden-page render regression.

- [ ] **Step 7: Commit the interaction slice**

```bash
git add assets/app.css src/app.mjs src/legacy-app.mjs tests/mobile-interaction-performance.test.mjs
git commit -m "perf: stabilize mobile interactions"
```

---

### Task 7: Version Backup, Three-pass Acceptance and Production Release

**Files:**
- Modify: `index.html`
- Modify: `manifest.json`
- Modify: `sw.js`
- Modify: browser imports under `src/**/*.mjs`
- Modify: `tests/v2-release.test.mjs`
- Modify: `tests/pwa-versioned-imports.test.mjs`
- Modify: `docs/feature-ledger.md`
- Create: `docs/releases/zos-ceo-os-v2.10.0.md`
- Create: `docs/zos-ceo-os-v2.10.0-production-acceptance.md`

**Interfaces:**
- Produces: one consistent `2.10.0` PWA cache generation, release record, backup tag and production acceptance evidence.
- Consumes: all prior task tests and existing GitHub Pages deployment workflow.

- [ ] **Step 1: Add failing release-version assertions**

Update `tests/v2-release.test.mjs` and `tests/pwa-versioned-imports.test.mjs` to require `2.10.0` in `index.html`, `manifest.json`, `sw.js`, CSS URL and all browser module query parameters.

```js
assert.equal(manifest.version, '2.10.0');
assert.match(serviceWorker, /zos-workbench-v2\.10\.0/);
assert.match(index, /assets\/app\.css\?v=2\.10\.0/);
for (const source of browserModules) assert.doesNotMatch(source.text, /\?v=2\.9\.0/);
```

- [ ] **Step 2: Run release tests and verify RED**

Run: `node --test tests/v2-release.test.mjs tests/pwa-versioned-imports.test.mjs tests/release-governance.test.mjs`

Expected: FAIL because production assets still declare `2.9.0`.

- [ ] **Step 3: Create a pre-upgrade backup tag and update versions mechanically**

```bash
git tag zos-workbench-v2.9.0-mobile-preflight
```

Change only version identifiers from `2.9.0` to `2.10.0` after all functional tests pass. Add the new modules to `ASSETS_TO_CACHE`. Append a v2.10.0 entry to `docs/feature-ledger.md` describing mobile navigation, central voice, Agent hierarchy, safety boundary and rollback tag.

- [ ] **Step 4: Run the complete automated suite three independent times**

Run three fresh invocations:

```bash
node --test tests/*.test.mjs
node --test tests/*.test.mjs
node --test tests/*.test.mjs
```

Expected: every invocation PASS; no skipped failing tests. Then run:

```bash
git diff --check
node --check src/app.mjs
node --check src/legacy-app.mjs
node --check sw.js
```

Expected: all commands exit 0.

- [ ] **Step 5: Perform four-size real interaction acceptance**

Use Browser for deterministic page state and console inspection, Chrome for the existing logged-in Supabase session, and Computer Use for touch-like press/hold behavior. Validate:

- iPhone 390×844: `#dashboard`, central voice sheet, `#agent-workbench`, `#calendar`, `#intelligence`, More;
- Android 412×915: the same routes and keyboard/voice fallback;
- iPad 834×1194: split layout, drawers and no desktop-table overflow;
- Desktop 1440×900: existing left navigation and dashboard remain intact.

For every viewport verify body `scrollWidth <= innerWidth`, main content is non-empty, one tap causes one transition, console error count is zero, and typed text survives a failed voice permission attempt.

- [ ] **Step 6: Write the release and acceptance records**

In `docs/releases/zos-ceo-os-v2.10.0.md`, record the feature scope, data boundaries, automated counts, four-size results and rollback tag. In `docs/zos-ceo-os-v2.10.0-production-acceptance.md`, record each acceptance route, observed result, HTTP status and any explicitly deferred native-iOS/background-wake work.

- [ ] **Step 7: Commit the release candidate**

```bash
git add index.html manifest.json sw.js src tests docs/feature-ledger.md docs/releases/zos-ceo-os-v2.10.0.md docs/zos-ceo-os-v2.10.0-production-acceptance.md
git commit -m "release: prepare ZOS CEO OS v2.10.0"
```

- [ ] **Step 8: Push and verify GitHub Pages before tagging release**

```bash
git push origin codex/ai-first-home-v2.9
git push origin main
```

Wait for the Pages deployment to complete. Verify the formal URL returns HTTP 200 for `/zos-workbench/`, `manifest.json`, `sw.js`, `src/app.mjs`, `src/app/mobile-navigation.mjs`, `src/app/mobile-dashboard.mjs` and `src/app/mobile-agent-directory.mjs`; verify all declare or import `2.10.0` as required. Repeat iPhone, Android, iPad and desktop checks on the formal URL.

- [ ] **Step 9: Tag only after production acceptance passes**

```bash
git tag zos-workbench-v2.10.0
git push origin zos-workbench-v2.10.0
```

If production acceptance fails, do not tag. Restore the previous accepted tag in code, increment the cache generation, redeploy, and preserve the failed v2.10.0 branch and evidence; do not delete or roll back user data.

---

## Plan Self-Review Result

- **Spec coverage:** mobile navigation, central voice/keyboard, CEO cockpit, Agent hierarchy, task/calendar/intelligence/more, interaction, performance, privacy, version backup, three-pass validation and rollback each map to a task above.
- **Placeholders:** no deferred implementation markers or unspecified error-handling steps remain; native iOS and background wake are explicitly outside this release rather than left undefined.
- **Type consistency:** `buildMobileMoreGroups`, `buildMobileDashboard`, `buildMobileAgentDirectory`, `renderMobileCommandSheetHtml` and their view-model fields use the same names in producing and consuming tasks.
