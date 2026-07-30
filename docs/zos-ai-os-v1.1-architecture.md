# ZOS AI OS V1.1 架构升级报告

> 版本：v1.1.0 · 日期：2026-07-30 · 分支：Codex 完整版（`xz1220z-afk/zos-workbench`）
> 定位：ZOS 自建工作台作为唯一总控制台；飞书=企业执行层，Supabase=数据层，ZOS=AI 驾驶舱，Agent=智能员工。

---

## 一、新增功能

| 模块 | 能力 | 关键文件 |
| --- | --- | --- |
| 数据层契约 | 项目只读元数据契约，强制 `read_only`、禁止正文字段 | `src/project-data.mjs` |
| 数据迁移 | `zos_business_cache.source` 枚举扩展为 `('wanjia','huahuo','brain','projects')` | `supabase/migrations/003_projects_cache.sql` |
| 项目中心 | 进行中/风险/总数统计，按类型筛选，列表含名称/类型/状态/负责人/更新时间/风险等级/来源 | `index.html` → `page-zos-brain` + `renderProjectCenter` |
| 今日驾驶舱 | 五卡：进行中项目、待处理事项、今日风险、AI 建议、待审核内容 | `index.html` → `page-dashboard` + `renderCockpit` |
| 项目经理 Agent V1 | 确定性生成《朱帅每日经营简报》（5 段式），进入收集箱待审核 | `src/project-manager-agent.mjs` + 内联 `generateProjectBrief` |
| 项目扫描器 | 本地、只读、无密钥，将结构化导出转成缓存兼容 payload | `scripts/project-metadata-scan.mjs` + `samples/projects-source.example.json` |
| Edge Function 增强 | `zos-business-data` 新增只读 `projects` 源（飞书→只读索引） | `supabase/functions/zos-business-data/index.ts` |

---

## 二、数据流

### 2.1 项目元数链路（V1.1 主路径，与 wanjia/huahuo 一致）

```
飞书多维表格（万嘉/花火 ERP）
        │  read-only（tenant_access_token，不回写）
        ▼
Edge Function: zos-business-data
        │  返回 { wanjia, huahuo, projects: {source,mode:'read_only',projects[]}, meta }
        │  校验 meta.mode === 'read_only'
        ▼
ZOS PWA  refreshBusinessData('projects')
        │  主路径：fetchBusinessData → bdata.projects
        │  回退①：Supabase zos_business_cache (source='projects')  ← createProjectCacheClient
        │  回退②：本地导入索引 (localStorage)  ← importProjectIndexFile
        ▼
renderProjectCenter() + renderCockpit()
        │  仅渲染元数据（名称/类型/状态/负责人/更新时间/风险等级/来源）
        ▼
跨端只读展示（绝不取正文、绝不回写事实源）
```

### 2.2 AI 员工工作流（严格审批闸门）

```
项目经理 Agent V1 (generateBrief)
   │  纯函数·确定性·无网络·无密钥
   │  输入：项目只读索引 + 本地任务/收集箱计数
   ▼
生成《朱帅每日经营简报》(Markdown)
   │  标记 reviewRequired: true，写入收集箱（kind:'brief'）
   ▼
朱帅在「收集箱」人工审核
   │  点击「导出简报(.md)」→ 仅下载草稿文件
   ▼
人工决定是否进入工作流（转任务/转项目/执行）
```

**禁止项（硬约束）**：AI 不直接修改数据库、不直接写入知识库、不自动发送任何外部消息。

### 2.3 只读契约（安全闸）

- 所有事实源数据经 `mode: 'read_only'` 校验后才被信任。
- 项目索引 forbidden 字段：`content/body/text/markdown/description/detail/memo/note/remark`，泄露即抛错。
- 大脑索引 forbidden 字段：`content/body/text/markdown`。
- 写入 `zos_business_cache` 仅可由带 service role 的受保护 Edge Function 执行；PWA 侧 `createProjectCacheClient`/`createBrainCacheClient` 均为 SELECT-only。

---

## 三、测试与验证

| 测试 | 结果 |
| --- | --- |
| `tests/project-data.test.mjs` | 12/12 通过（契约、read_only 拒绝、空数据、禁止字段、缓存客户端、汇总） |
| `tests/project-manager-agent.test.mjs` | 9/9 通过（5 段结构、风险路由、确定性、Markdown 渲染） |
| `tests/obsidian-metadata-index.test.mjs` | 10/10 通过 |
| `tests/pwa-baseline.test.mjs` | 含 V1.1 功能断言（项目中心/驾驶舱/Agent/只读），通过 |
| **全量** | **57/57 通过** |
| 内联脚本 `node --check` | 通过 |
| 扫描器实跑 | `samples/projects-source.example.json` → 4 条 read_only 合法 payload（已验证） |

---

## 四、后续规划

1. **真实数据接入**：执行 `003` 迁移；部署更新后的 Edge Function；在飞书表中补齐「负责人」「风险等级」字段映射。
2. **缓存写入器**：新增受保护 Edge Function 将 `projects` 快照写入 `zos_business_cache`（source='projects'），实现跨端缓存（目前主路径已走 Edge Function 直连，缓存为回退）。
3. **Agent 常态化**：定时（每日上午）自动生成简报草稿进入收集箱，朱帅一键审核。
4. **项目中心深化**：里程碑/资源/交付看板，仍严格只读。
5. **多 Agent 编排**：在项目经理 Agent 之后按需新增「商家运营 Agent」「内容 Agent」，统一走 Inbox 审核闸门。

---

## 五、当前限制

- **未接真实业务数据**：示例 `samples/projects-source.example.json` 为占位模板（非真实业务数据）。真实接入需你执行迁移 + 部署 Edge Function（AI 不代操作密钥/登录态）。
- **驾驶舱/简报在同步前为空态或本地缓存**：登录并刷新项目后即显示真实只读数据。
- **飞书表字段映射未核实**：Edge Function 的 `projects` 映射基于现有 `projectTable` 字段名，部署后需按实际表结构微调（负责人、风险等级）。
- **AI 不直接行动**：简报仅为待审核草稿，任何执行动作均须朱帅确认。
- **行动边界**：需密钥/登录态的操作（迁移执行、Edge Function 部署、Supabase 登录）由你完成；AI 仅准备代码、步骤与测试。
