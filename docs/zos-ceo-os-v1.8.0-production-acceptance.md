# ZOS CEO OS v1.8.1 生产验收记录

日期：2026-08-03
版本：v1.8.1
生产入口：https://xz1220z-afk.github.io/zos-workbench/?v=181-final2#calendar

## 发布边界

- 本次新增和修改范围：智能日历本地 CRUD、回收站、重复规则、跨多日渲染、日/周/月/列表导航、当前可见范围同步、四端响应式界面，以及 `zos-calendar-data` 的区间校验与最小只读返回。
- 飞书 ERP 与飞书日历仍是外部事实源，本版本不新增任何飞书写入、删除、邀请或静默批处理路径。
- 本地日程经既有本人私有同步集合跨设备同步；飞书与 ICS 日程只允许查看来源或复制为本地记录。
- 私人日程进入工作上下文时继续脱敏为忙碌占位，不上传备注正文。
- 本版本保存提醒配置，但不承诺应用关闭后的系统级推送；闭屏/关应用提醒属于后续独立能力。

## 验收闸门

### Gate 1：智能日历专项

- 命令：`node --test tests/calendar-range.test.mjs tests/calendar-event.test.mjs tests/calendar-recurrence.test.mjs tests/calendar-center.test.mjs tests/calendar-view.test.mjs tests/state-store.test.mjs tests/app-composition.test.mjs tests/browser-calendar-range.test.mjs tests/calendar-edge-function.test.mjs tests/smart-calendar-integration.test.mjs tests/router.test.mjs`
- 结果：50/50 通过，0 失败，0 跳过。
- 覆盖：跨多日、重复与例外、编辑/删除/恢复/复制/改期、外部日历只读、可见范围同步、Edge 鉴权与区间限制、空数据网格和 URL 深链接。

### Gate 2：全产品回归

- 命令：`node --test tests/*.test.mjs`
- 结果：357/357 通过，0 失败，0 跳过。
- 补充：启动脚本、路由与日历视图 `node --check`、`node tests/pwa-baseline.test.mjs` 与 `git diff --check` 均通过。

### Gate 3：生产部署与回读

- Edge Function 部署：`zos-calendar-data` 已部署为 ACTIVE v7；仅变更该函数及其共享日历适配器。
- 匿名鉴权回读：HTTP 401；未读取或输出任何个人事件正文。
- 生产代码提交：`96a3646d986112381d6ecd3f72c4d413a145e324`。
- GitHub CI：成功，https://github.com/xz1220z-afk/zos-workbench/actions/runs/30824958660 。
- GitHub Pages：成功，https://github.com/xz1220z-afk/zos-workbench/actions/runs/30824949558 。
- 线上回读：主页 HTTP 200；`sw.js` 为 `zos-workbench-v1.8.1`；manifest 为 `1.8.1`；两个入口脚本和启动关键依赖均带 `v=1.8.1`。
- 已登录浏览器 UAT：直接打开 `#calendar` 正确进入日历中心；周视图和 42 格月视图在零事件时仍完整显示；新建日程抽屉可打开并包含跨日、公司、隐私、重复、提醒与备注字段；测试中未保存或改动真实日程。
- 线上 UAT 曾发现并已修复两项启动回归：零事件时隐藏日历网格、旧 Service Worker 缓存未带版本的路由依赖导致深链接停留首页。
- 第二设备 / 四端 UAT：待人工真机证据；未执行前不得写成已通过。

## 回滚范围

- 代码回滚目标：发布前主分支提交 `950bf3f`。
- Edge 回滚：仅回退 `zos-calendar-data`，不触碰 `zos-business-data`、情报、企业大脑或其他函数。
- 数据回滚：本次没有生产数据迁移；本地日程删除使用 tombstone，可从回收站恢复。
- 任何回滚后都必须重新回读主页、manifest、Service Worker 和匿名 401 鉴权边界。
