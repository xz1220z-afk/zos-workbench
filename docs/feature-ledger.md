# ZOS 功能账本

本账本是发布前的固定回读入口。新增功能只能追加记录，不删除旧记录；事实、设计意图和未完成边界必须分开写。

## v2.7.1（候选）

### 可信数据刷新、定位天气与情报交互修复

- **入口**：万嘉网络、待我决策、情报中心、工作和生活首页天气卡。
- **目标**：区分成功读取与本机离线缓存容量；避免不完整来源误归档；使情报卡的阅读状态与追问入口实际可操作；只在本人点击时读取当前位置天气。
- **实现文件**：`src/app/business-data-cache.mjs`、`src/app/decision-center.mjs`、`src/app/operating-loop.mjs`、`src/app/weather-center.mjs`、`src/app.mjs`、决策与情报视图、`sw.js` 与入口版本文件。
- **数据边界**：万嘉仍保持只读；缓存是离线便利副本而非事实源。定位不保存经纬度、地址或轨迹；情报状态仅更新本人本地/私有记录，不外发。来源数据未声明完整覆盖时，既有待决策保持原状。
- **测试**：业务缓存、决策防误归档、天气按需定位、情报状态即时刷新、PWA 版本契约、全量回归与生产资源回读。
- **回滚**：回到 `zos-workbench-v2.7.0` 代码标签后提高缓存版本；不清理或回滚用户任务、日历、决策、情报状态和私有数据。

## v2.6.0（候选）

### 首页动态摘要、单次渲染与万嘉历史范围

- **入口**：工作首页、生活首页、万嘉网络（`#local-life`）。
- **目标**：避免导航和筛选的双重渲染；让首页呈现基于当前事实的简明状态；让万嘉历史查询不混入旧快照。
- **实现文件**：`src/app.mjs`、`src/legacy-app.mjs`、`src/app/homepage-presence.mjs`、`src/app/wanjia-history.mjs`、`src/app/wanjia-ops-center.mjs`、相关视图、`assets/app.css` 与 `sw.js`。
- **数据边界**：历史只接受受保护只读适配器给出的 SQLite 索引。飞书不替代完整历史仓；无历史或口径未知时不显示 0 或趋势。
- **测试**：`homepage-presence`、`wanjia-history`、`wanjia-ops-view`、完整回归和生产资源回读。
- **回滚**：回到 `zos-workbench-v2.5.0` 代码标签并提高缓存版本；用户记录、云端记录和 Vault 内容保持不动。

## v2.4.0（候选）

### Apple 交互层

- **入口**：全局导航、工作首页、按钮与卡片交互。
- **目标**：减少层级噪音，统一 44px 触控目标、按压反馈、页面切换与减少动态效果。
- **实现文件**：`assets/app.css`、`src/legacy-app.mjs`、`src/app/navigation-preferences.mjs`、`src/app/views/dashboard-view.mjs`。
- **保留的数据**：不改变路由 ID、状态集合、飞书接口、Supabase 数据或本机记录。
- **测试**：`apple-interaction-system`、`navigation-preferences`、`dashboard-apple-hierarchy` 及全量回归。
- **回滚**：回到 `zos-workbench-v2.3.1` 的视觉与导航代码；不恢复或删除用户数据。

### 情报卡上下文问答

- **入口**：情报中心每张信息卡的“问这条情报”。
- **目标**：用户可直接追问陌生概念；答案限定为当前卡片与已载入相关情报的事实证据。
- **实现文件**：`src/app/intelligence-explainer.mjs`、`src/app/views/intelligence-view.mjs`、`src/app.mjs`。
- **安全边界**：问题和答案只存在于当前页面运行时，不上传、不写飞书、不冒充外部 AI；证据不足时明确提示需要补充来源或转调研。
- **保留的数据**：不修改原情报卡、人工状态、排序、筛选和已保存记录。
- **测试**：`intelligence-explainer`、`intelligence-question-view`、`intelligence-question-actions`、响应式测试及全量回归。
- **回滚**：移除问答入口和运行时状态即可；情报数据无需迁移。

### 版本备份与回读治理

- **入口**：`docs/release-governance.md` 与 `scripts/verify-release-readback.mjs`。
- **目标**：每版有标签、功能账本、验收记录、变更日志；发布前回读旧功能，发布后回读真实资源。
- **保留的数据**：沿用现有 v2.0.2 本机检查点和安全合并恢复，不把代码标签误当成用户数据备份。
- **回滚**：治理文档为加法变更，不影响运行时。
