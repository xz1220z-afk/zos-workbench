# ZOS Calendar v1.10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 ZOS 自建任务补齐可确认、可恢复、可跨端同步的删除闭环，并把日历升级为可直接完成、编辑、复制、改期和筛选任务的执行中心。

**Architecture:** 复用 `state-store` 已有墓碑与 Supabase 通用记录同步，不新增数据库表。以 `calendarEventCapabilities` 作为来源权限边界，在应用层按 `local_task` 与 `user_calendar` 路由操作；视图层只渲染能力允许的按钮，并从 base revision 与冲突集合派生同步状态。

**Tech Stack:** 原生 ES Modules、浏览器 DOM、localStorage、Supabase 通用同步表、Node.js 内置测试运行器、GitHub Pages PWA。

## Global Constraints

- 版本号提升为 `1.10.0`，缓存名为 `zos-workbench-v1.10.0`。
- 飞书、ICS、业务项目和其他外部来源保持只读。
- 删除均为软删除；本批次不提供永久清空。
- 不使用真实用户任务做破坏性验收。
- 所有行为先写失败测试并确认按预期失败，再实现最小代码。

---

### Task 1: 来源能力与同步状态模型

**Files:**
- Modify: `src/app/calendar-event.mjs`
- Test: `tests/calendar-event.test.mjs`

**Interfaces:**
- Produces: `calendarEventCapabilities(event)` 返回 `kind/edit/remove/drag/copy/complete/openSource`。
- Produces: `calendarRecordSyncState(record, { baseRevisions, conflicts })` 返回 `pending|synced|conflict|readonly`。

- [ ] **Step 1: 写失败测试**

```js
assert.deepEqual(calendarEventCapabilities({ source: 'local_task' }), {
  kind: 'task', edit: true, remove: true, drag: true,
  copy: true, complete: true, openSource: false,
});
assert.equal(calendarRecordSyncState(task, { baseRevisions: { 'tasks:t1': 2 } }), 'synced');
```

- [ ] **Step 2: 运行 `node --test tests/calendar-event.test.mjs`，确认因能力和函数缺失失败**
- [ ] **Step 3: 实现来源能力与同步状态纯函数**
- [ ] **Step 4: 重跑测试并确认通过**

### Task 2: 任务删除、恢复、复制、完成与改期应用动作

**Files:**
- Modify: `src/app.mjs`
- Test: `tests/app-composition.test.mjs`
- Test: `tests/smart-calendar-integration.test.mjs`

**Interfaces:**
- Produces: `deleteTask(id)`, `restoreTask(id)`, `copyTask(id)`, `moveTask(id, patch)`, `toggleTask(id)`。
- Produces: `requestTaskDeletion(id)` 与 `confirmTaskDeletion()`，确认后调用 `deleteTask`。

- [ ] **Step 1: 写失败测试，验证删除生成 `tasks` 墓碑、恢复提高 revision、复制不继承同步元数据、改期保持时长**
- [ ] **Step 2: 运行两份目标测试并确认失败原因是动作缺失**
- [ ] **Step 3: 实现最小应用动作，每次保存/删除/恢复后派发 `zos:local-change`**
- [ ] **Step 4: 重跑目标测试并确认通过**

### Task 3: 日历统一详情、删除确认、撤销与回收站

**Files:**
- Modify: `src/app/views/calendar-view.mjs`
- Modify: `src/app.mjs`
- Modify: `src/app/views/task-view.mjs`
- Test: `tests/calendar-view.test.mjs`
- Test: `tests/app-composition.test.mjs`

**Interfaces:**
- Consumes: Task 1 的能力模型与 Task 2 的应用动作。
- Produces: `data-calendar-task-complete/edit/copy/reschedule/delete`、`data-task-delete`、`data-calendar-confirm-delete`、`data-calendar-undo-delete`、双实体恢复按钮。

- [ ] **Step 1: 写失败测试，验证本地任务按钮齐全、外部事件没有破坏性按钮、回收站区分任务/日程**
- [ ] **Step 2: 运行目标测试并确认失败**
- [ ] **Step 3: 实现详情、确认页、撤销条和统一回收站**
- [ ] **Step 4: 重跑目标测试并确认通过**

### Task 4: 快捷筛选与桌面拖动任务改期

**Files:**
- Modify: `src/app/views/calendar-view.mjs`
- Modify: `src/app.mjs`
- Modify: `assets/app.css`
- Test: `tests/calendar-view.test.mjs`
- Test: `tests/calendar-selection-integration.test.mjs`

**Interfaces:**
- Produces: `calendarFilter` 取值 `all|task|schedule|wanjia|huahuo|lingli|life`。
- Consumes: Task 2 的 `moveTask`；拖放按来源路由到 `moveTask` 或 `moveCalendar`。

- [ ] **Step 1: 写失败测试，验证过滤器标记与任务拖放路由**
- [ ] **Step 2: 运行目标测试并确认失败**
- [ ] **Step 3: 实现过滤器、同步标签和响应式样式**
- [ ] **Step 4: 重跑目标测试并确认通过**

### Task 5: 版本、缓存与发布验收

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/legacy-app.mjs`
- Modify: `index.html`
- Modify: `manifest.webmanifest`
- Modify: `sw.js`
- Modify: `tests/pwa-baseline.test.mjs`
- Modify: `tests/v1.7-ui.test.mjs`
- Create: `docs/zos-ceo-os-v1.10.0-production-acceptance.md`

**Interfaces:**
- Produces: 正式版本 `1.10.0` 和完整离线模块缓存。

- [ ] **Step 1: 更新版本断言，运行目标测试确认旧版本导致失败**
- [ ] **Step 2: 更新产品版本、缓存名、入口参数与发布说明**
- [ ] **Step 3: 连续三次运行 `node --test`，每轮必须零失败**
- [ ] **Step 4: 推送主分支并等待 GitHub Pages 成功**
- [ ] **Step 5: 正式 URL 分别以桌面、平板、手机完成三轮布局与关键交互验收**

