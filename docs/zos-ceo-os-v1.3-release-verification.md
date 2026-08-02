# ZOS CEO OS v1.3.0 发布验收记录

**发布日期**：2026-08-02  
**发布分支**：`main`（功能分支 `codex/zos-ceo-os-v1.3` 已快进合并）
**回滚基线**：`41cdc32`（v1.2.3 CEO 指挥中心）

## 已验证（本地）

- 全量自动化：`201/201` 通过；全部 ES Modules、Service Worker、Web App Manifest 语法与 `git diff --check` 通过。
- 深色 CEO OS 模块化壳：桌面、平板、手机断点和 44px 触控区已纳入自动测试。
- 经营闭环：事实刷新 → 健康 → 风险决策 → 目标差距 → 每日简报 → 同步冲突 → 飞书预览/回读验证已通过集成测试。
- 隐私：用户数据按 Supabase Auth owner 隔离；浏览器不能插入审批或审计；Obsidian 不上传正文。
- PWA：缓存名 `zos-workbench-v1.3.0`，新 CSS/模块进入离线缓存，旧 `zos-workbench-*` 缓存激活后清理。

## 生产证据（部署时回填）

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 004 迁移 | 已执行并回读 | 2026-08-02 通过 Supabase 官方 Management API 执行；`zos_business_snapshots`、`zos_source_health`、`zos_feishu_approvals`、`zos_audit_events` 均存在且 RLS=true |
| 五个 Edge Functions | 已部署 | `zos-brain-index` v4、`zos-business-data` v12、审批 preview/execute v1、`zos-monitor` v1；全部 ACTIVE、`verify_jwt=true` |
| 匿名访问保护 | 已验证 | 五个端点匿名 POST 均返回 HTTP 401 |
| GitHub Pages v1.3.0 | 已发布 | 2026-08-02 回读 `index.html`、`src/app.mjs`、`src/app/browser-runtime.mjs`、`assets/app.css`、`sw.js`、`manifest.webmanifest` 全部 HTTP 200；线上模块声明 `APP_VERSION = '1.3.0'` |
| GitHub Pages CI | 已通过 | 主分支提交 `9963805` 的 `ZOS Workbench CI` 与 `pages build and deployment` 均为 success |
| 桌面浏览器冒烟 | 已通过 | 线上页面标题正确，CEO 指挥中心及五个 v1.3 经营模块可见，浏览器控制台 0 error / 0 warning |
| 手机布局冒烟 | 已通过 | 390×844 视口自动切换为“首页 / 决策 / 行动 / 业务 / 更多”五项底部导航 |
| 万嘉真实读取 | 待登录验收 | 条数、更新时间、安全状态 |
| 花火真实读取 | 待登录验收 | 条数、更新时间、安全状态 |
| 企业大脑只读元数据 | 待登录验收 | 条数、更新时间、正文泄漏=0 |
| Windows / Android | 待实体设备验收 | 浏览器/PWA/同步结果 |
| iPhone Safari/PWA | 待实体设备验收 | 登录、前台同步、离线重开 |
| 单条飞书预览 | 待选择低风险记录 | 字段、原值、新值、审批 ID |
| 单条飞书执行 | 未授权，禁止执行 | 需朱帅确认该条预览 |

## 发布判定

v1.3.0 前端、数据库迁移和 Edge Functions 已发布，匿名保护与未登录安全降级已通过。万嘉、花火、企业大脑的当前真实数据仍需在朱帅已登录会话中完成最终回读；Windows、Android、iPhone 实体设备验收仍保留为上线后验收项。单条飞书执行是独立授权项，不阻塞工作台只读发布。
