# ZOS CEO Operating System v2.7.0 生产验收

## 范围

- 受控 Agent 派任务、每 Agent 本机规则快照与确认式上下文。
- 生活首页的聚焦层级与原入口保留。
- PWA 资源图升级到 `v2.7.0`。

## 上线前验收

以下结果仅在对应命令实际通过后填写：

- 自动化测试：`node --test tests/*.test.mjs`，598/598 通过（2026-08-08）。
- 版本与界面契约复验：PWA 基线与响应式界面测试 7/7 通过（2026-08-08）。
- 语法检查：全部 `src/**/*.mjs`、`sw.js` 与 Agent 索引扫描器均通过 `node --check`（2026-08-08）。
- 静态资源验收：本地 HTTP 回读 `index.html`、`manifest.json`、`sw.js`、`app.mjs` 与 `agent-task-context.mjs` 均为 200，且缓存版本为 `v2.7.0`（2026-08-08）。
- 桌面、平板、手机视觉验收：保留为上线后的浏览器验收项；本次未以模拟器替代真实触控验收。
- 生产 HTTP 回读：`https://xz1220z-afk.github.io/zos-workbench/` 已回读为 `app.mjs?v=2.7.0`；`manifest.json` 为 `2.7.0`；`sw.js` 缓存名为 `zos-workbench-v2.7.0`；`agent-task-context.mjs` 返回 200 且含确认式上下文函数（2026-08-08）。

## 生产边界

- Agent 索引、任务档案和上下文候选保持本机；不向 Supabase 或飞书写入。
- REL-001 不可调用远程 AI，且不出现在公司共享区域。
- 任何外发、日历创建、飞书写入、Vault 修改或自动化启用继续等待单独确认。

## 回滚

上线提交：`47e1a29`；发布标签：`zos-workbench-v2.7.0`。若回退，恢复该版本前一发布标签，并保留本机安全备份与当前数据记录。
