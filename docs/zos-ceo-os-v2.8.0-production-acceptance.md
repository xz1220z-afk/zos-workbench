# ZOS CEO Operating System v2.8.0 生产验收

## 范围

- 既有万嘉网络页面 `#local-life` 的四层运营界面：今日总控、商家作战、增长复盘、数据分析。
- 不涉及飞书、Supabase、SQLite、商家数据、历史批次、任务、日历或导航的写入和迁移。

## 第一轮：功能与回归

- 全量自动化测试：`node --test tests/*.test.mjs`，**613/613 通过**（2026-08-08）。
- 语法与空白检查：`node --check src/app.mjs`、`node --check src/app/wanjia-ops-center.mjs`、`node --check src/app/wanjia-ops-navigation.mjs`、`node --check src/app/views/wanjia-ops-view.mjs` 与 `git diff --check` 通过。
- 面板切换测试：导航纯函数、视图隔离与应用运行时测试均通过；无效面板值安全回落至“今日总控”。

## 第二轮：PWA 与生产资源

- 发布提交：`66c07da`。
- 正式资源回读：`node scripts/verify-release-readback.mjs --version 2.8.0 --base https://xz1220z-afk.github.io/zos-workbench/` 通过。
- `index.html`、`manifest.json`、`sw.js`、`src/app.mjs` 均为 HTTP 200，版本均为 `2.8.0`。
- Service Worker 已纳入新增导航模块，避免旧缓存与新模块混用。

## 第三轮：真实界面验收

- 桌面 1440px、平板 1024px、手机 390px：正文非空，页面无横向溢出。
- 正式站四个区块均可实际点击切换，激活标签与可见面板一致。
- 正式站控制台 error：0。
- 未登录或未完成今日同步时，默认总控保持“待同步 / 暂不可作为今日事实”；历史快照没有被混入今日 KPI 或增长结论。

## 数据保护与回滚

- 本次仅前端展示层与 PWA 资源升级；未写入或删除飞书、Supabase、SQLite、Vault、商家数据或用户数据。
- 若需回退，基于 `zos-workbench-v2.7.4` 新建回滚提交，提升 PWA 缓存版本后重新发布、回归和资源回读；不清理用户数据。
