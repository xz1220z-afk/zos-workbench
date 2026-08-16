# ZOS CEO OS v2.10.0 发布候选记录

候选日期：2026-08-16
状态：本地 release candidate；未 push，未创建正式 `zos-workbench-v2.10.0` tag。

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
- 备份 tag：annotated `zos-workbench-v2.9.0-mobile-preflight`，peeled commit 为 `87c784ad2236162ff213f0108d857bb20f3b45b1`；仅本地，未推送。
- 若生产验收失败：以该恢复点建立修复分支，提升新的 Service Worker 缓存世代后重新发布；不删除、不迁移、不回滚用户或经营数据。

## 自动化证据

- RED：升级 `tests/v2-release.test.mjs` 与 `tests/pwa-versioned-imports.test.mjs` 至 `2.10.0` 后，`node --test tests/v2-release.test.mjs tests/pwa-versioned-imports.test.mjs tests/release-governance.test.mjs` 为 2 通过、2 失败；失败原因是生产缓存和浏览器模块仍声明 `2.9.0`。
- GREEN：完成机械版本升级后，同一 release 命令为 4/4 通过。
- 版本断言回归：`tests/app-composition.test.mjs`、`tests/pwa-baseline.test.mjs`、`tests/startup-performance.test.mjs`、`tests/v1.3-ui.test.mjs`、`tests/v1.7-ui.test.mjs` 为 40/40 通过。
- 全量第 1 轮：`node --test tests/*.test.mjs`，686/686 通过、0 失败、0 跳过（1886.711375 ms）。
- 全量第 2 轮：`node --test tests/*.test.mjs`，686/686 通过、0 失败、0 跳过（1620.796875 ms）。
- 全量第 3 轮：`node --test tests/*.test.mjs`，686/686 通过、0 失败、0 跳过（10678.09425 ms）。
- 本地静态检查：`git diff --check`、`node --check src/app.mjs`、`node --check src/legacy-app.mjs`、`node --check sw.js` 均退出 0。

## 尚待生产验收

- PENDING：push 候选分支及 `HEAD:main`，等待 GitHub Pages 部署。
- PENDING：正式 URL 的 `/zos-workbench/`、`manifest.json`、`sw.js`、`src/app.mjs`、`src/app/mobile-navigation.mjs`、`src/app/mobile-dashboard.mjs`、`src/app/mobile-agent-directory.mjs` 的 HTTP 状态和 `2.10.0` 回读。
- PENDING：390×844、412×915、834×1194、1440×900 的真实交互、横向溢出、单击单次转场、控制台错误及失败语音权限后的文字保留验收。
- 明确不在本版范围：原生 iOS、后台唤醒词、锁屏常驻和无需用户手势的监听。
