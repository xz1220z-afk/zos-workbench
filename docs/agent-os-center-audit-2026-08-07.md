# Agent OS 管理与调用中心｜增量审计记录

日期：2026-08-07  
范围：ZOS CEO OS 现有 `#agent-workbench` 与 Enterprise Brain 的 Agent OS 目录  
模式：只读审计 + 最小增量开发

## 已确认的现有能力

- 现有页面与导航：保留 `#agent-workbench`、Agent 执行记录、审批链和任务中心。
- 现有数据：`agent_runs` 继续保留；Agent 调用不会直接创建执行记录，而是带入现有任务抽屉。
- 现有权限：分析与草稿可直接进行；发布、消息、ERP 写入和删除仍需确认。
- 现有定时机制：只有业务数据自动刷新，没有本地 Vault 文件系统定时器或监听器。
- 浏览器限制：GitHub Pages 无权直接扫描 Mac 目录，因此不新增外部定时服务，采用本机只读扫描器 + 手动导入。

## 本次只读发现

- Agent 身份卡：21
- Skill：12
- Workflow：6
- Evaluation：12
- Log：5
- Runbook：7
- 状态：18 draft、3 pilot、0 active、0 deprecated
- REL-001：`confidentiality: private`，只允许在“我的生活 > 私密关系”子筛选显示；普通“我的生活”列表不显示。

以上数量来自扫描结果，不写死在页面代码中。工作台只保存相对路径、哈希、更新时间、受控身份摘要和关联 ID；不保存 Markdown 正文。

## 安全决策

- Agent OS 索引和 REL-001 任务仅保存在本机工作台状态与用户主动导出的安全备份中，不上传 Supabase。
- 其他 Agent 任务若由用户保存，只保留 Agent ID、名称、状态、分类和调用模式，不保存身份卡路径、哈希、Skill、知识入口或证据清单。
- 不把索引打包进公开 GitHub Pages 静态资源，避免暴露商业角色名称或 REL-001 私密身份。
- 本次不修改 Vault、不写飞书、不发送消息、不创建日历、不启用自动化。
- 每次打开工作台只校验已导入的本机索引；需要读取 Vault 最新变化时，由朱帅手动导入新索引。

## 权威来源边界

- Agent 身份、Skill、Workflow、评估、日志与 Runbook：Agent OS Markdown 身份卡。
- 订单、任务、金额、结算与实时状态：飞书 ERP、合同、平台后台与项目原始资料。
- 工作台只负责索引、展示、筛选、草拟与变更预览，不以 Agent 索引替代实时业务事实。
