# ZOS Apple Interaction Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不重建工作台、不改变既有数据结构和业务事实边界的前提下，为 ZOS 增加一致、克制、可恢复的 Apple 风格交互层，收拢首页与导航层级，修复情报中心桌面溢出，并允许用户在情报卡片内基于现有证据追问陌生概念。

**Architecture:** 保留现有静态壳、模块化视图和 Legacy 路由。新增一个纯函数导航偏好模块负责“常用/全部”显示决策；视觉与动效集中在 `assets/app.css`，首页与情报区只做结构性增量；Legacy 路由只负责应用导航状态与页面入场类。

**Tech Stack:** 原生 HTML/CSS/JavaScript ES modules、Node.js `node:test`、GitHub Pages PWA。

## Global Constraints

- 保留现有所有页面、路由、用户数据和 Supabase/飞书/Obsidian 安全边界。
- 不引入新框架，不伪造业务数据，不把草稿说成已执行。
- 移动端保留既有五个主入口及 44px 触控契约。
- 动效必须支持 `prefers-reduced-motion`，只使用 `transform`、`opacity` 和必要颜色属性。
- 删除与外发能力不得扩大；本次仅改善已有可恢复反馈。

---

### Task 1: Unified Interaction Contract

**Files:**
- Create: `tests/apple-interaction-system.test.mjs`
- Modify: `assets/app.css`
- Modify: `src/legacy-app.mjs`

**Interfaces:**
- Consumes: existing `.v13-action`, `.nav-item`, `.page`, drawer and toast markup.
- Produces: `.is-entering`, `.is-busy`, consistent pressed/focus states and reduced-motion fallback.

- [ ] **Step 1: Write the failing interaction test**

Assert that controls have at least 44px targets, pressed feedback is consistent, page-entry motion exists, generic `transition: all` is absent from interactive controls, and reduced motion disables transforms.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/apple-interaction-system.test.mjs`
Expected: FAIL because the unified contract and page-entry behavior are missing.

- [ ] **Step 3: Implement the minimal interaction layer**

Add shared motion tokens and targeted transitions; add page entry state during `navigateTo`; keep focus and accessibility behavior unchanged.

- [ ] **Step 4: Run focused and existing interaction tests**

Run: `node --test tests/apple-interaction-system.test.mjs tests/decision-interaction-ui.test.mjs tests/v1.3-ui.test.mjs`
Expected: PASS.

### Task 2: Focused Desktop Navigation

**Files:**
- Create: `src/app/navigation-preferences.mjs`
- Create: `tests/navigation-preferences.test.mjs`
- Modify: `index.html`
- Modify: `src/legacy-app.mjs`
- Modify: `assets/app.css`

**Interfaces:**
- Produces: `normalizeNavigationMode(value)` and `shouldExpandNavigation({ mode, pageId, primaryPages })`.
- Consumes: all existing `data-page` routes; no route is removed.

- [ ] **Step 1: Write failing navigation behavior tests**

Cover compact default, persistent expanded mode, and automatic expansion when a secondary deep link is active.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/navigation-preferences.test.mjs`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement and integrate navigation focus**

Mark daily primary destinations, add a desktop “全部功能” toggle, persist only the display preference, and auto-reveal a secondary active route. Keep mobile More unchanged.

- [ ] **Step 4: Run navigation tests**

Run: `node --test tests/navigation-preferences.test.mjs tests/v1.3-ui.test.mjs tests/v1.4-ui.test.mjs tests/v1.7-ui.test.mjs`
Expected: PASS.

### Task 3: Action-first Dashboard and Quiet Source Status

**Files:**
- Create: `tests/dashboard-apple-hierarchy.test.mjs`
- Modify: `src/app/views/dashboard-view.mjs`
- Modify: `assets/app.css`

**Interfaces:**
- Consumes: current `viewModel.autoRefresh`, decisions, Top 3, company summaries and secondary dashboard sections.
- Produces: a compact expandable source-status capsule and explicit primary/secondary dashboard regions.

- [ ] **Step 1: Write failing dashboard hierarchy tests**

Verify a single status summary, expandable details, one dominant primary action, and secondary content grouped below the decision surface.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/dashboard-apple-hierarchy.test.mjs`
Expected: FAIL because the current status rail and hero expose too many equal-weight controls.

- [ ] **Step 3: Implement the minimal hierarchy changes**

Turn source details into an accessible disclosure; reduce hero controls to a primary action plus compact shortcuts; group secondary intelligence/calendar/digest/health content in a lower region that fills the desktop rhythm.

- [ ] **Step 4: Run dashboard tests**

Run: `node --test tests/dashboard-apple-hierarchy.test.mjs tests/automatic-refresh-integration.test.mjs tests/dashboard-production-fixes.test.mjs tests/important-dates-view.test.mjs`
Expected: PASS.

### Task 4: Intelligence Overflow and Actionable Empty States

**Files:**
- Create: `tests/intelligence-responsive-layout.test.mjs`
- Modify: `src/app/views/intelligence-view.mjs`
- Modify: `src/app/views/view-utils.mjs`
- Modify: `assets/app.css`

**Interfaces:**
- Consumes: existing intelligence filters/actions and shared view states.
- Produces: contained responsive action rows, collapsible filters on narrow desktop/mobile, and one explicit next action in relevant empty states.

- [ ] **Step 1: Write failing responsive and empty-state tests**

Test that toolbar controls and card actions can shrink/wrap without page overflow, and signed-out/empty intelligence state exposes exactly one next-step action.

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/intelligence-responsive-layout.test.mjs`
Expected: FAIL because current desktop toolbar/action rows can exceed the content column.

- [ ] **Step 3: Implement containment and progressive disclosure**

Use minmax grid tracks, wrap/shrink rules, `min-width: 0`, and a filter disclosure at constrained widths. Keep all filters and actions reachable.

- [ ] **Step 4: Run intelligence tests**

Run: `node --test tests/intelligence-responsive-layout.test.mjs tests/intelligence-view.test.mjs tests/intelligence-center.test.mjs`
Expected: PASS.

### Task 5: Intelligence Contextual Question Drawer

**Files:**
- Create: `src/app/intelligence-explainer.mjs`
- Create: `tests/intelligence-explainer.test.mjs`
- Create: `tests/intelligence-question-view.test.mjs`
- Modify: `src/app.mjs`
- Modify: `src/app/views/intelligence-view.mjs`
- Modify: `assets/app.css`

**Interfaces:**
- Produces: `buildIntelligenceAnswer({ item, allItems, question })` and an in-page “问这条情报” drawer.
- Consumes: the selected card facts, impact, suggested action, source URL, and related intelligence already loaded in memory.

- [ ] **Step 1: Write failing evidence-boundary and view tests**

Verify direct card context, related evidence, explicit insufficient-evidence wording, source links, and no unsupported model/provider claim.

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/intelligence-explainer.test.mjs tests/intelligence-question-view.test.mjs`
Expected: FAIL because the explainer and contextual drawer do not exist.

- [ ] **Step 3: Implement contextual question flow**

Add “问这条情报” to every card, open a focused drawer, answer only from card and related loaded intelligence, and state clearly when the evidence does not define the queried concept. Keep the source link visible; do not upload questions or pretend an external AI model ran.

- [ ] **Step 4: Run intelligence and interaction regression tests**

Run: `node --test tests/intelligence-explainer.test.mjs tests/intelligence-question-view.test.mjs tests/intelligence-view.test.mjs tests/intelligence-center.test.mjs tests/apple-interaction-system.test.mjs`
Expected: PASS.

### Task 6: Release, Three-pass Acceptance, and Rollback Evidence

**Files:**
- Modify: `index.html`
- Modify: `manifest.json`
- Modify: `sw.js`
- Modify: versioned browser-module imports under `src/`
- Create: `docs/zos-ceo-os-v2.4.0-production-acceptance.md`

**Interfaces:**
- Produces: consistent `2.4.0` cache/version contract and an auditable acceptance report.

- [ ] **Step 1: Update all browser cache-busting references to 2.4.0**

Use a mechanical replacement only after functional tests pass.

- [ ] **Step 2: Run the full automated suite three times**

Run three fresh invocations of: `node --test tests/*.test.mjs`
Expected: all tests pass in every run.

- [ ] **Step 3: Run real browser acceptance**

Validate desktop 1440×900, tablet 834×1194, and mobile 390×844 across `#dashboard`, `#intelligence`, `#life`, `#local-life`, and a secondary deep link. Check non-empty shell, no horizontal page overflow, focus/press states, reduced-motion behavior, and console errors = 0.

- [ ] **Step 4: Commit, push, and verify production**

Push the current branch, fast-forward `origin/main` only after fresh verification, then confirm GitHub Pages serves `2.4.0` assets and repeat the three viewport checks against the formal URL.

- [ ] **Step 5: Record rollback**

Document the previous production tag `zos-workbench-v2.3.1` and the exact revert command without executing it.
