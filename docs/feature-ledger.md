# ZOS 功能账本

本账本是发布前的固定回读入口。新增功能只能追加记录，不删除旧记录；事实、设计意图和未完成边界必须分开写。

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

