# Agent OS 管理与调用中心实施计划

> 依据已确认的 Agent OS 规格执行；使用测试驱动，保持 Vault 和飞书只读。

## Task 1：锁定动态索引契约

**Files:**
- Create: `tests/agent-os-index.test.mjs`
- Create: `src/agent-os-index.mjs`
- Create: `scripts/agent-os-index-scan.mjs`

1. 先写失败测试：仅发现带主键的身份卡、输出无 Markdown 正文、包含路径/哈希/mtime/关联 ID。
2. 实现前置属性解析、允许章节摘要、关系识别和索引生成。
3. 用真实 Agent OS 目录生成临时索引并验证不改源文件。

## Task 2：Agent OS 分类、隐私和巡检

**Files:**
- Create: `tests/agent-os-center.test.mjs`
- Create: `src/app/agent-os-center.mjs`

1. 先写失败测试：五类动态归类、状态统计、增改缺停用、证据缺口。
2. 先写 REL-001 隔离和提醒草稿测试。
3. 实现纯函数模型；不读网络、不执行外部动作。

## Task 3：保存索引并接入现有应用

**Files:**
- Modify: `src/app/data-durability.mjs`
- Modify: `src/sync-engine.mjs`
- Modify: `src/app.mjs`
- Modify: `tests/v2-app-actions.test.mjs`
- Modify: `tests/v2-sync.test.mjs`

1. 先写失败测试：导入索引后生成动态视图，旧 `agent_runs` 不受影响。
2. 增加 `agent_os_indexes`、`local_agent_tasks` 私有集合和迁移兼容；云同步只接收普通 Agent 的最小引用。
3. 增加文件选择、只读导入、筛选、详情、刷新和调用到任务抽屉。

## Task 4：增量 UI 与可访问性

**Files:**
- Modify: `src/app/views/agent-workbench-view.mjs`
- Modify: `index.html`
- Modify: `assets/app.css`
- Modify: `tests/v2-ui.test.mjs`
- Create: `tests/agent-os-view.test.mjs`

1. 先写失败测试：巡检、五类筛选、卡片、详情、导入和调用按钮。
2. 保留现有视觉 token 和执行记录区域，新增响应式网格与抽屉。
3. 验证按钮语义、焦点、私密提示和移动端布局。

## Task 5：版本、PWA 与完整回归

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/app/views/*.mjs`（仅版本查询参数）
- Modify: `sw.js`
- Modify: `manifest.json`
- Modify: `tests/v2-release.test.mjs`
- Modify: `tests/pwa-versioned-imports.test.mjs`

1. 更新版本和缓存清单。
2. 执行专项、全量、语法、PWA 和扫描器实目录测试。
3. 桌面、平板、手机各验收一次；复验现有任务、知识、Agent 执行记录。
4. 输出变更、验证、未完成项和回滚说明；未经再次明确授权不部署生产。
