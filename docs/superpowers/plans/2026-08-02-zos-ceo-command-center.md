# ZOS CEO 指挥中心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 ZOS PWA 升级为基于真实数据的深色 CEO 指挥中心，并在桌面、平板和手机端保持可用。

**Architecture:** 保留现有 `index.html` 中的数据模型、Supabase 登录和飞书只读请求；新增一套由 CSS 变量、可复用页面壳和状态卡组成的呈现层。页面保留当前 DOM ID 与动作入口，避免影响业务刷新、Obsidian 索引上传、任务、收集箱和 AI 指令队列。

**Tech Stack:** 原生 HTML、CSS、JavaScript 模块、Supabase Edge Function、GitHub Pages、Node 内置测试器。

## Global Constraints

- 飞书 ERP 是业务事实源，Obsidian 仅提供笔记元数据索引。
- 不在前端保存凭证、令牌或笔记正文。
- 所有无数据状态必须显示空态或错误原因，不得以样例数字替代真实经营数据。
- AI 只进入建议或待执行队列，不自动写入业务系统或外发。
- 保留 PWA、现有路由、Supabase 登录、任务 / 收集箱 / 项目 / 知识索引行为。
- 四端断点：手机 `<768px`，平板 `768–1199px`，桌面 `>=1200px`。

---

### Task 1: 建立深色指挥中心设计令牌与应用壳

**Files:**
- Modify: `index.html: CSS variables, sidebar, topbar, bottom navigation`
- Modify: `tests/pwa-baseline.test.mjs`

**Interfaces:**
- Consumes: existing `navigateTo(page)` and `data-page` navigation elements.
- Produces: `zos-command` theme classes and responsive shell styles reused by all pages.

- [ ] **Step 1: Write the failing baseline assertions**

Add checks that `index.html` defines dark theme tokens, desktop / tablet / mobile breakpoint rules, and the existing bottom navigation remains present.

- [ ] **Step 2: Run the focused baseline test**

Run: `node --test tests/pwa-baseline.test.mjs`

Expected: fail because the command-center tokens are absent.

- [ ] **Step 3: Implement the shell**

Add named CSS variables for background, panel, border, text, muted text, accent gold, success, warning and risk; update sidebar, topbar, page surface and bottom navigation to consume those variables. Add responsive rules that hide desktop navigation on mobile, preserve safe-area bottom padding, and use one / two / three column layout at the declared breakpoints.

- [ ] **Step 4: Re-run the focused baseline test**

Run: `node --test tests/pwa-baseline.test.mjs`

Expected: pass.

- [ ] **Step 5: Commit**

Run: `git add index.html tests/pwa-baseline.test.mjs && git commit -m "feat: add CEO command center shell"`

### Task 2: 构建真实状态卡和首页指挥布局

**Files:**
- Modify: `index.html: dashboard markup, dashboard rendering helpers, dashboard styles`
- Modify: `tests/business-data-client.test.mjs`
- Create: `tests/command-center-ui.test.mjs`

**Interfaces:**
- Consumes: existing business refresh result, local `tasks`, `inbox`, `projects`, `commands`, and Obsidian index summary.
- Produces: `renderCommandCenter()` and `renderStatusCard(state)` that distinguish synced, pending, confirmation-needed and failed states.

- [ ] **Step 1: Write the failing UI contract tests**

Assert `index.html` contains `renderCommandCenter`, explicit `已同步`, `待同步`, `待确认`, `读取失败` labels, and does not define hard-coded sample business KPI values.

- [ ] **Step 2: Run the new test**

Run: `node --test tests/command-center-ui.test.mjs`

Expected: fail because the dashboard is still the old module list.

- [ ] **Step 3: Implement command center sections**

Replace dashboard-only content with greeting / refresh / quick-create, source-aware KPI cards, today actions, business panorama, schedule, recent knowledge, AI queue and health blocks. Derive counts only from existing state and business refresh payload. For unavailable data, render the matching status card and safe next action.

- [ ] **Step 4: Verify data contract compatibility**

Run: `node --test tests/business-data-client.test.mjs tests/command-center-ui.test.mjs`

Expected: pass; existing business request behavior remains unchanged.

- [ ] **Step 5: Commit**

Run: `git add index.html tests/business-data-client.test.mjs tests/command-center-ui.test.mjs && git commit -m "feat: build CEO command center dashboard"`

### Task 3: 统一行动、业务、知识与风险页面

**Files:**
- Modify: `index.html: today, inbox, tasks, local-life, spark-media, enterprise, zos-brain, risk, privacy and settings sections`
- Modify: `tests/wanjia-data.test.mjs`
- Modify: `tests/huahuo-data.test.mjs`
- Modify: `tests/obsidian-metadata-index.test.mjs`
- Modify: `tests/risk-detector.test.mjs`

**Interfaces:**
- Consumes: existing page IDs and render functions (`renderTasks`, `renderProjects`, `renderBrainIndex`, business refresh and risk detector results).
- Produces: shared section header, source rail, action list and empty/error state patterns.

- [ ] **Step 1: Write failing structural tests**

Extend the affected tests to check that each data page retains its data-source declaration and has an explicit source-aware empty/error state without adding writes to Feishu or Obsidian.

- [ ] **Step 2: Run affected tests**

Run: `node --test tests/wanjia-data.test.mjs tests/huahuo-data.test.mjs tests/obsidian-metadata-index.test.mjs tests/risk-detector.test.mjs`

Expected: fail where the common state UI hooks are missing.

- [ ] **Step 3: Implement page consistency**

Apply the shared hierarchy to all existing pages while preserving IDs, onclick handlers, filters and input names. Add source status, last update, safe refresh / import controls and responsive detail containers. Keep current local data behavior and all write boundaries intact.

- [ ] **Step 4: Run affected tests**

Run: `node --test tests/wanjia-data.test.mjs tests/huahuo-data.test.mjs tests/obsidian-metadata-index.test.mjs tests/risk-detector.test.mjs`

Expected: pass.

- [ ] **Step 5: Commit**

Run: `git add index.html tests/wanjia-data.test.mjs tests/huahuo-data.test.mjs tests/obsidian-metadata-index.test.mjs tests/risk-detector.test.mjs && git commit -m "feat: unify command center pages"`

### Task 4: 四端导航与交互回归

**Files:**
- Modify: `index.html: navigation accessibility, mobile interaction styles`
- Modify: `tests/pwa-baseline.test.mjs`
- Modify: `tests/command-center-ui.test.mjs`

**Interfaces:**
- Consumes: `navigateTo(page)` and all current page IDs.
- Produces: desktop side navigation and mobile five-destination navigation that reach the same page handlers.

- [ ] **Step 1: Write failing route and breakpoint tests**

Assert every navigation target maps to an existing page ID, mobile navigation contains five destinations, and the three required breakpoints are present.

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/pwa-baseline.test.mjs tests/command-center-ui.test.mjs`

Expected: fail until the new mobile mapping is added.

- [ ] **Step 3: Implement responsive navigation**

Keep all desktop destinations in the sidebar; map mobile navigation to 首页、行动、业务、项目、更多, with “更多” exposing knowledge, risks and settings without hiding them permanently. Maintain keyboard focus styles and touch targets of at least 44px.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/pwa-baseline.test.mjs tests/command-center-ui.test.mjs`

Expected: pass.

- [ ] **Step 5: Commit**

Run: `git add index.html tests/pwa-baseline.test.mjs tests/command-center-ui.test.mjs && git commit -m "feat: adapt command center for four devices"`

### Task 5: 三轮验收、发布和线上回读

**Files:**
- Modify: `CHANGELOG.md`
- Create: `docs/zos-ceo-command-center-release-verification.md`

**Interfaces:**
- Consumes: completed UI, existing tests, GitHub Pages deployment.
- Produces: three recorded verification rounds and the production commit URL.

- [ ] **Step 1: Run functional regression**

Run: `node --test tests/*.test.mjs`

Expected: all existing and new tests pass.

- [ ] **Step 2: Run static and responsive validation**

Run: `node --check index.html` is not applicable to HTML; instead extract inline script to a temporary file, run `node --check` on it, then verify all route/page targets and required breakpoints with the focused tests.

Expected: syntax check and focused UI tests pass.

- [ ] **Step 3: Run production-readiness validation**

Run: inspect `git diff --check`, PWA manifest / service worker references, then open the local static page at 375px, 768px and 1280px and verify navigation, status cards and no horizontal overflow.

Expected: three viewports render and all primary actions are reachable.

- [ ] **Step 4: Commit and publish**

Run: `git add CHANGELOG.md docs/zos-ceo-command-center-release-verification.md && git commit -m "docs: verify CEO command center release"`; merge the verified branch to `main`, push, wait for GitHub Pages, then fetch the published page.

- [ ] **Step 5: Record final evidence**

Write the three validation outcomes, deployed commit SHA, published URL and any remaining source-data caveats into the release verification document.
