# ISSUE-001 数据接入诊断报告

- **版本**：v1.2.1（Commit `827d321` / 部署 `1653698`）
- **报告日期**：2026-07-31
- **诊断性质**：仅定位原因，**不修改代码、不修复、不新增功能**（遵循冻结态约束）
- **诊断方法**：静态代码链路追踪 + 已完成的部署态验证；**未执行线上真实取数**（真实取数需用户浏览器登录态 JWT，沙箱不持有）

---

## 现象

Dashboard 首页全部业务数据为空：

- 万嘉网络：待接入
- 花火影像：待接入
- 企业项目：0
- ZOS 企业大脑：待接入

---

## 任务 1 · Dashboard 当前数据请求状态

**结论（代码确认）：Dashboard 已正确接线到 Edge Function，但取数被「登录 + 手动刷新」双重门控，未触发则不发请求、不写缓存。**

调用链（均位于 `index.html`）：

| 环节 | 位置 | 行为 |
|------|------|------|
| 取数封装 | `fetchBusinessData` 2124–2134 | `fetch(syncEndpoint(url,'/functions/v1/zos-business-data'), { headers:{ apikey, Authorization:'Bearer '+accessToken } })`；要求响应 `meta.mode==='read_only'` |
| 业务刷新入口 | `refreshBusinessData('business')` 3126–3145 | 先校验 `session.userId && session.accessToken` |
| 登录门控 | 3128 | **无登录即 `toast('请先完成 Supabase 邮箱登录')` 并 return，不调用函数、不写缓存** |
| 写缓存 | 3137–3139 | 成功才 `cache.wanjia/huahuo = {...}` 写入 `zos_business_data_cache_v1` |
| 渲染 | `renderBusinessDataStates` 3013–3036 | 读 `cache.wanjia.summary`，无缓存则显示「待接入 / 等待首次同步…」 |

**已验证的部署态事实**：Edge Function 已部署 ACTIVE；此前探测（无 JWT）返回 `{"error":"authentication_required"}` HTTP 401，证明接口可达且按设计拒绝未认证调用。

**推断**：出现「待接入」只有两种可能——
1. 请求**从未发出**（未登录 Supabase，或未点击「刷新数据」）→ 缓存始终为空 → 显示默认「待接入」；
2. 请求**已发出但返回错误**（401/502/503）→ 进入 catch（3142–3144）→ 弹 toast 且缓存保持空 → 显示「待接入」。

---

## 任务 2 · zos-business-data 返回结构

**结论（代码确认）：函数确实返回 wanjia / huahuo / projects，且 records 形状与前端消费一致。`records` 为空 ⟺ 飞书侧返回 0 条记录。**

Edge Function（`supabase/functions/zos-business-data/index.ts`）成功分支返回（264–270）：

```text
wanjia : { summary: summarizeWanjia(merchants),   records: buildWanjiaRecords(merchants) }
huahuo : { summary: summarizeHuahuo(...),          records: buildHuahuoRecords(projects) }
projects: buildProjectsSource(projects, merchants) → { source:'projects', mode, projects:[...] }
brain  : { state:'not_configured' }
meta   : { mode:'read_only' }
```

- 前端消费形状匹配：`data.wanjia.summary/.records`（3137）、`data.projects.projects`（3099）→ **无结构错位**。
- `records` 构建于 `buildWanjiaRecords`(101–121) / `buildHuahuoRecords`(127–153)：**逐条映射飞书 items，缺字段回退默认值**（如 `商家名称→'未知商家'`、`风险等级→'低'`）。因此：
  - 若飞书 `searchRecords`(210–225) 返回 `items=[]` → `records=[]`、汇总全 0 → 前端 0/空；
  - 若飞书返回有数据但**字段名不一致** → `records` 仍有条数，只是值变成占位符（数据质量问题，**不是空**）。

**`records` 为空的具体条件**：`searchRecords` 的 `payload.data.items` 为空数组。这发生在——飞书 appToken/tableId 错误、无读取权限、或对应多维表本身为空。

---

## 任务 3 · 飞书字段映射（代码字段 → 假定真实字段）

函数通过 `searchRecords` 的 `field_names` 显式向飞书索取下列列名，并用 `pick()` 多候选回退：

**万嘉商家表**（`FEISHU.wanjia`，appToken `AWFUwAbItiI4TjkPMErcpv5Onab`）：
`商家名称 · 是否动销 · 支付GMV · 核销GMV · 视频投稿数 · 直播场次数 · 总预估佣金 · 合作类型 · 当前阶段 · 项目负责人 · 最近更新时间 · 下一步动作 · 风险等级 · 收入状态`

**花火项目表**（`FEISHU.huahuo`，appToken `EqzkwDOMEigNflkDoJdcw7FSn4d`）：
`项目名称 · 项目状态 · 拍摄日期 · 合同金额 · 已收金额 · 负责人 · 项目类型 · 回款状态 · 利润状态 · 最近更新时间 · 更新时间`

**花火交付表 / 收款表**：`项目 · 计划交付日期 · 交付状态 · 客户确认状态` / `项目 · 收款金额 · 收款日期 · 收款状态`

> ⚠️ **映射风险**：以上列名均为**硬编码中文假定名**。若用户真实飞书多维表的列名不同（如 `更新时间` vs `修改时间`、英文名、被重命名），`pick()` 返回回退默认值——记录仍返回，但字段值退化为占位符。此为生产验收报告中已标注的已知限制（"飞书字段名 '最近更新时间'/'更新时间' 为假定名，部署后需核对"）。字段漂移会导致**数据质量下降，但不会造成"全部为空/待接入"**这一症状。

---

## 根因假设（按概率排序）

| # | 假设 | 依据 | 是否造成"全部待接入" |
|---|------|------|----------------------|
| H1 | **未登录 Supabase / 未点击「刷新数据」** | 3128 登录门控直接 return，缓存永不为空；默认即「待接入 / 等待首次同步…」 | ✅ 完全吻合（四端同时空白） |
| H2 | **飞书返回 0 条记录**（appToken/tableId 错、无权限、表空） | `searchRecords` 返回 `items=[]` → `records=[]`、汇总 0 | ✅ 吻合（0/空白，但 企业大脑仍"待接入"因 brain 本就 not_configured） |
| H3 | **Edge Function 返回错误**（401/502/503） | 502=`source_read_failed`、503=`source_not_configured`/无 FEISHU 密钥 | ✅ 吻合（catch → 待接入） |
| H4 | **飞书字段名漂移** | `pick()` 回退默认值 | ❌ 造成占位值而非空白，**非本症状主因**（但属真实数据质量风险） |

> 注：「企业项目：0」来自 `projectIndexState.projects.length`（renderCockpit 3822），说明 projects 取数同样未填充（本地也无缓存）——与 H1/H2/H3 一致。

---

## 无法从沙箱确认 · 需用户浏览器验证

沙箱无用户 JWT，无法触发真实取数。请在 **已登录的 Dashboard** 中操作并回报：

1. 打开「万嘉 / 花火 / 企业项目」页，点「刷新数据」；
2. 打开浏览器 DevTools → Network，过滤 `/functions/v1/zos-business-data`，记录：
   - **HTTP 状态码**（200 / 401 / 502 / 503）；
   - **响应 JSON**：`wanjia.records.length`、`huahuo.records.length`、`projects.projects.length`；
   - 字段值是否真实（如 `商家名称` 非 "未知商家"、`项目状态` 非 "筹备中"）；
3. 若 401 → 登录态/令牌问题（H3 子集）；若 502 `source_read_failed` → 飞书读取失败（H2/H3）；若 503 `source_not_configured` → 环境变量缺失（FEISHU_APP_ID/SECRET 或 SUPABASE_URL/KEY）；若 200 但 `records` 为空 → 飞书表无数据或 appToken/tableId 错（H2）；若 200 且 `records` 有数据但值占位 → 字段漂移（H4）。

---

## 严重等级初判（待验证后定稿）

- 当前暂列 **P1（数据可用性/准确性）**；
- 若浏览器验证确认根因为 **H1（未登录/未刷新）** → 实为预期行为，降级为 **P2（体验/引导缺失）** 或直接关闭；
- 若确认为 **H2/H3**（真实取数失败）→ 维持 **P1**，并视阻断程度可升 **P0**。

---

## 结论

- Dashboard 接线正确、Edge Function 返回结构正确、前端消费形状匹配——**代码链路本身无导致"全部为空"的硬缺陷**。
- 空白最可能是**未触发取数（H1）** 或 **飞书侧 0 条/取数错误（H2/H3）**；字段漂移（H4）解释不了"空白"但解释"占位值"。
- **本诊断不改任何代码**。任何修复须待 **2026-08-07 Production Review** 闸门开启后，作为 V1.3 候选进入开发流程（遵循版本原则：开发→测试→Release→部署→观察→Review）。
