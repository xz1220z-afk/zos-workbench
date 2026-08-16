# ZOS CEO OS v2.10.0 发布记录

候选日期：2026-08-16
状态：生产已上线并完成验收；正式 tag 在本记录提交并回读后创建。
生产代码提交：`041aef8`（`perf: scope startup reminder models`）。

## 本次范围

- 手机端五个主入口：首页、语音、Agent、日历、更多；既有桌面左侧导航和原有路由保持可用。
- 中央 AI 指令面板复用既有键盘/语音状态；浏览器拒绝或不支持语音时，已输入文字保留并可继续键盘提交。
- 移动 CEO 行动总览、Agent 组织→部门→Agent 目录，以及任务、日历、情报和更多中的高频移动交互。
- PWA 缓存名、入口 CSS、`index.html` 两个模块入口及全部浏览器模块导入查询参数统一为 `2.10.0`。

## 数据、权限和隐私边界

- 未迁移、覆盖、删除或写入任务、日历、决策、Agent 上下文、业务只读数据、Vault、飞书、Supabase 或生产用户数据。
- L0 只读导航可直达；L1 仅生成本机可撤销草稿；L2 飞书写入、消息、发布、外部日历、删除、付款等仍仅显示影响、测试和回滚预览，等待明确确认。
- 不持续监听、不后台录音、不保存原始音频；语音不可用时保留键盘回退。

## PWA 资产与回滚

- 已回读 Task 1–4 新增静态模块均在 `ASSETS_TO_CACHE`：`mobile-navigation.mjs`、`mobile-dashboard.mjs`、`mobile-agent-directory.mjs`、`views/mobile-command-sheet.mjs`。Task 5–6 未新增静态模块。
- 备份 tag：annotated `zos-workbench-v2.9.0-mobile-preflight`，peeled commit 为 `87c784ad2236162ff213f0108d857bb20f3b45b1`；已推送到 origin。
- 若生产验收失败：以该恢复点建立修复分支，提升新的 Service Worker 缓存世代后重新发布；不删除、不迁移、不回滚用户或经营数据。

## 自动化证据

- RED：升级 `tests/v2-release.test.mjs` 与 `tests/pwa-versioned-imports.test.mjs` 至 `2.10.0` 后，`node --test tests/v2-release.test.mjs tests/pwa-versioned-imports.test.mjs tests/release-governance.test.mjs` 为 2 通过、2 失败；失败原因是生产缓存和浏览器模块仍声明 `2.9.0`。
- GREEN：完成机械版本升级后，同一 release 命令为 4/4 通过。
- 版本断言回归：`tests/app-composition.test.mjs`、`tests/pwa-baseline.test.mjs`、`tests/startup-performance.test.mjs`、`tests/v1.3-ui.test.mjs`、`tests/v1.7-ui.test.mjs` 为 40/40 通过。
- 最终全量第 1 轮：`node --test tests/*.test.mjs`，701/701 通过、0 失败、0 跳过（1894.817958 ms）。
- 最终全量第 2 轮：`node --test tests/*.test.mjs`，701/701 通过、0 失败、0 跳过（1546.584166 ms）。
- 最终全量第 3 轮：`node --test tests/*.test.mjs`，701/701 通过、0 失败、0 跳过（10646.657083 ms）。
- 本地静态检查：`git diff --check`、`node --check src/app.mjs`、`node --check src/legacy-app.mjs`、`node --check sw.js` 均退出 0。
- 独立代码复核：当前 `041aef8` 无 Critical、Blocker 或 Important；PWA 原子缓存、Agent 移动优先级、语音松手提交/上滑取消、REL-001 私密边界和启动 scoped model 均通过。

## 生产验收结果

- 已将候选分支和 `041aef8` 推送至 `origin/main`；GitHub Pages 正式资源全部 HTTP 200。
- 正式 URL 的 `/zos-workbench/`、`manifest.json`、`sw.js`、`src/app.mjs` 与移动端模块均已回读；入口、manifest、Service Worker 和浏览器模块版本为 `2.10.0`。
- 390×844、412×915、834×1194、1440×900 均完成正式站真实验收：六个核心路由正文非空、无横向溢出、控制台 error=0；手机中央 AI 面板可打开，文字与语音入口存在；更多菜单 3 组、22 个动态入口可见。
- Agent 正式站验收：4 个组织、4 个部门、32 个详情入口、32 个派任务入口；详情抽屉含 Skill、知识入口与派任务按钮。
- 明确不在本版范围：原生 iOS、后台唤醒词、锁屏常驻和无需用户手势的监听。
