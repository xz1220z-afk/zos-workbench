# ZOS AI OS V1.2 发布报告 · 经营驾驶舱闭环

> 版本：v1.2.0 · 日期：2026-07-30 · 分支：Codex 完整版（`xz1220z-afk/zos-workbench`）
> 定位：ZOS 自建工作台作为唯一总控制台；飞书=企业执行层，Supabase=数据层，ZOS=AI 驾驶舱，Agent=智能员工。
> 状态：**114/114 测试通过，仅发布固化，业务逻辑未改动。**

---

## 一、版本目标

在 V1.1（企业数据驾驶舱 + 项目经理 Agent V1）基础上，**打通经营驾驶舱闭环**：

1. **万嘉 / 花火业务明细接入**：将原本只有汇总（summary）的只读链路扩展为「汇总 + 明细记录（records）」，让老板能看到具体商家/项目的关键字段与风险。
2. **风险探测器**：统一规则引擎，自动发现「>7 天无更新 / 阶段停滞 / 有未完成项 / 高风险的 / 回款挂起」等风险，按 kind（project / wanjia / huahuo）区分完成态。
3. **风险中心 · 老板决策页**：把普通风险列表升级为决策卡片——红/黄/绿分级、按等级/来源排序、明确「风险原因 + 建议动作」。
4. **项目经理 Agent V2**：在 V1 简报能力之上新增《朱帅经营日报》（今日重点 / 项目风险 / 需要决策 / 建议动作），产出经收集箱人工审核的只读草稿。
5. **首页驾驶舱聚焦 5 件事**：当前项目数 / 今日风险数 / 待跟进 / 待审核 AI 内容 / AI 建议。
6. **严守只读边界**：所有数据 `mode: 'read_only'`，AI 产出只进收集箱待人工审核，**绝不自动发送、绝不自动修改事实源/知识库**。

---

## 二、系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ZOS AI OS v1.2（PWA 工作台）                        │
│  首页驾驶舱(5卡)  万嘉页(明细)  花火页(明细)  风险中心(决策页)  收集箱(审核)  │
└───────────┬───────────────────────────────┬────────────────────────────┘
            │  refreshBusinessData('wanjia'|'huahuo'|'projects')          │
            │  fetchBusinessData()（携带 accessToken，仅 SELECT）         │
            ▼                                                              ▼
┌──────────────────────────┐                              ┌─────────────────────────┐
│  Edge Function            │                              │  Supabase (数据层)        │
│  zos-business-data        │                              │  zos_business_cache       │
│  - Feishu tenant token    │  安全代理（不回写）           │  (source 枚举已扩展)       │
│  - pick() 安全取字段       │ ───────────────────────────▶ │  回退缓存(SELECT-only)    │
│  - buildWanjiaRecords     │                              └─────────────────────────┘
│  - buildHuahuoRecords     │
│  返回 {summary, records,  │
│        meta.mode=read_only}│
└───────────┬──────────────┘
            │ 响应：{ wanjia:{summary,records}, huahuo:{summary,records}, meta }
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  只读契约 + 风险引擎（前端内联，与 src 规则一致）                             │
│  buildWanjiaIndex / buildHuahuoIndex / detectRisksInline → 风险分级        │
└───────────┬───────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  项目经理 Agent V2（纯函数·确定性·无网络·无密钥）                            │
│  generateDailyReport(ctx) → {reviewRequired:true, disclaimer, sections}    │
│        │ 仅生成草稿                                                          │
│        ▼                                                                  │
│  收集箱(kind:'report') → 朱帅人工审核 → 导出 .md → 人工决定是否执行          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 三、数据流说明

### 3.1 万嘉 / 花火明细链路（V1.2 新增 records 位）

```
飞书多维表格（万嘉商家表 / 花火 项目表+交付表+回款表）
        │  read-only（tenant_access_token，绝不回写）
        ▼
Edge Function: zos-business-data
        │  searchRecords() 多表拉取 → pick() 安全取字段
        │  buildWanjiaRecords() / buildHuahuoRecords()
        │  返回 { summary, records:[{source,mode:'read_only',字段…}] }
        │  meta.mode === 'read_only'（强制）
        ▼
ZOS PWA  refreshBusinessData('wanjia'|'huahuo')
        │  cache.wanjia/huahuo = { summary, records, fetchedAt }
        │  localStorage(BUSINESS_DATA_CACHE_KEY)
        ▼
renderBusinessDataStates()
        │  renderRecordList('wanjiaRecordList'|'huahuoRecordList', records, kind)
        ▼
只读明细展示（商家/合作类型/阶段/负责人/更新/风险/收入 或
            客户/项目/类型/拍摄/阶段/交付/回款/利润）+ 风险标签
```

### 3.2 风险聚合链路

```
万嘉 records ∪ 花火 records ∪ 项目索引
        │  detectRisksInline(records, kind, asOf)
        │  规则：isStale(>7天) / isStuck(>14天) / hasUnfinished / isHighRisk / isRevenuePending
        ▼
每条风险 {recordId,name,kind,stage,owner,level(高/中/低),reasons[]}
        │  levelBadgeInline + suggestActionInline
        ▼
风险中心决策页（按等级/来源排序，红黄绿）+ 首页今日风险计数
```

### 3.3 AI 员工工作流（V2，严格审批闸门）

```
项目经理 Agent V2 (generateDailyReport)
   │  纯函数·确定性·无网络·无密钥
   │  输入：万嘉/花火/项目只读缓存 + 风险检测 + 本地任务/收集箱计数
   ▼
生成《朱帅经营日报》(Markdown)
   │  reviewRequired:true，写入收集箱（kind:'report'）
   ▼
朱帅在「收集箱」人工审核
   │  点击「导出日报(.md)」→ 仅下载草稿文件
   ▼
人工决定是否进入工作流（转任务/转项目/执行）
```

**禁止项（硬约束）**：AI 不直接修改数据库、不直接写入知识库、不自动发送任何外部消息。

### 3.4 只读契约（安全闸）

- 所有事实源数据经 `mode: 'read_only'` 校验后才被信任。
- 万嘉 forbidden 字段（泄露即抛错）：`content/正文/描述/脚本/body/description/text/markdown/detail/memo/note/remark`。
- 花火 forbidden 字段：`content/拍摄方案/脚本/body/description/text/markdown` 等正文体。
- 写入 `zos_business_cache` 仅可由带 service role 的受保护 Edge Function 执行；PWA 侧 `createWanjiaCacheClient`/`createHuahuoCacheClient` 均为 SELECT-only。

---

## 四、Agent 流程

**项目经理 Agent V2**（`src/project-manager-agent.mjs` + 内联 `generateDailyReport`）：

1. **输入**：`{ wanjia, huahuo, projects, tasks }` 只读数据 + ctx（owner/date/inboxDrafts/asOf）。
2. **风险检测**：对三类数据源分别 `detectRisksInline`，合并为 `allRisks`。
3. **今日重点（keyFocus）**：遍历进行中项目、未完成的万嘉/花火项、未完成任务，生成一句话清单。
4. **项目风险（projectRisks）**：按等级列出风险项与原因。
5. **需要决策（decisions）**：高风险项 + 收集箱草稿数量提示。
6. **建议动作（suggestions）**：风险≥2 建议同步会、停滞项推动刷新、强制追加「须经 Inbox 审核、AI 不直写」声明。
7. **产出**：`{ title, date, owner, reviewRequired:true, disclaimer, risksCount, sections }` + `reportToMarkdown`。
8. **闸门**：`generateDailyReport()`（前端入口）仅把 `report` 推入收集箱（`kind:'report'`），**不落库、不发送**；导出 `.md` 由人工触发。

> 保留 V1 简报能力（`generateBrief`/`briefToMarkdown`）不变，收集箱 `kind:'brief'` 路径照常工作。

---

## 五、权限设计

| 层级 | 能力 | 限制 |
| --- | --- | --- |
| 飞书（事实源） | Edge Function 用 `tenant_access_token` 只读拉取 | 绝不回写，绝不持有写令牌 |
| Edge Function | `searchRecords` 多表 SELECT；`pick()` 安全取字段；强制 `mode:'read_only'` | 仅代理读取，不暴露写接口 |
| Supabase 数据层 | 受保护写仅由 service-role Edge Function 执行；PWA 侧缓存客户端 SELECT-only | 无 service role key 落前端 |
| PWA（客户端） | `fetchBusinessData` 携带用户 `accessToken` 仅读；本地 `localStorage` 缓存 | 不写事实源、不写知识库 |
| Agent（AI） | 纯函数、确定性、无网络、无密钥 | 产出仅入收集箱；自动发送/修改被禁止 |
| 用户（朱帅） | 唯一可审核、可导出、可决策执行的人 | 所有 AI 动作需其确认 |

---

## 六、测试结果

| 测试文件 | 覆盖 | 结果 |
| --- | --- | --- |
| `tests/wanjia-data.test.mjs` | 万嘉契约、read_only 拒绝、归一化、汇总、缓存客户端 | ✅ |
| `tests/huahuo-data.test.mjs` | 花火契约、交付/回款/利润状态、归一化、汇总 | ✅ |
| `tests/risk-detector.test.mjs` | daysSince/isStale/isStuck/hasUnfinished/detectRisks/bucketRisks | ✅ |
| `tests/project-manager-agent-v2.test.mjs` | V2 日报结构、reviewRequired、disclaimer、无副作用 | ✅ |
| `tests/project-data.test.mjs` | 项目契约（V1.1 保留） | ✅ |
| `tests/project-manager-agent.test.mjs` | V1 简报（保留） | ✅ |
| `tests/obsidian-metadata-index.test.mjs` | 大脑索引（保留） | ✅ |
| `tests/data-authenticity.test.mjs` | 空数据 / 异常状态 / 权限只读 / 风险规则 / Agent 输出 | ✅ |
| `tests/pwa-baseline.test.mjs` | 版本号 v1.2.0、驾驶舱 ID、风险决策页、日报入口、只读徽章 | ✅ |
| **全量 `node --test tests/*.test.mjs`** | 17 个测试文件 | **114 pass / 0 fail** |
| 内联脚本 `node --check` | `index.html` `<script type="module">` | ✅ 通过 |

---

## 七、当前限制

- **真实业务数据待接入**：示例/缓存为空时明细区与驾驶舱显示空态或本地缓存；真实数据需你部署扩展了 `records` 返回的 Edge Function 并配置飞书表映射。
- **飞书表字段映射未核实**：`buildWanjiaRecords`/`buildHuahuoRecords` 字段名基于既有表结构，部署后需按实际表微调（如负责人、风险等级、利润状态）。
- **AI 不直接行动**：日报/简报仅为待审核草稿，任何执行动作均须朱帅确认。
- **行动边界**：需密钥/登录态的操作（迁移执行、Edge Function 部署、Supabase 登录）由你完成；AI 仅准备代码、步骤与测试。
- **未 git commit（截至本报告）**：本次仅完成发布文档与固化准备，提交动作由后续固化流程执行。

---

## 八、V1.3 规划

1. **真实数据落地**：执行 `003` 迁移 + 部署 V1.2 Edge Function；补齐飞书字段映射后跑通真实万嘉/花火明细。
2. **缓存写入器**：新增受保护 Edge Function 将 `wanjia`/`huahuo` 快照写入 `zos_business_cache`，实现跨端只读缓存（目前主路径走 Edge Function 直连，缓存为回退）。
3. **Agent 常态化**：定时（每日上午）自动生成《经营日报》草稿进入收集箱，朱帅一键审核。
4. **风险中心深化**：风险趋势（近 7 日新增/解除）、负责人维度的待办聚合、逾期自动升级。
5. **多 Agent 编排**：在项目经理 Agent 之后按需新增「商家运营 Agent」「内容 Agent」，统一走 Inbox 审核闸门。
6. **可解释性增强**：每条风险可展开原始记录字段与判定依据，便于老板快速决策。

---

> 本报告与代码同源生成，未改动任何业务逻辑。部署前请先执行《V1.2 部署检查清单》。
