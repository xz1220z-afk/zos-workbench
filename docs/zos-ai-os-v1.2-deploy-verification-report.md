# ZOS AI OS V1.2 部署验证报告

> 版本：v1.2.0 · commit：`bfb5230` · 日期：2026-07-31 · 分支：`xz1220z-afk/zos-workbench`
> 验证范围：飞书 ERP → Edge Function → Supabase → ZOS Dashboard 真实数据链路
> 约束：未修改任何业务逻辑；未新增功能；未触碰密码 / token / service role key。

---

## 〇、验证边界声明（重要）

真实线上链路（飞书只读拉取、Supabase 登录、Edge Function 部署态）**需要你的个人登录令牌 / 飞书密钥**，按硬约束我**不持有、不读取、不代操作**任何密钥。

因此本报告验证分三层，边界明确：

| 层级 | 由谁执行 | 本报告是否覆盖 |
| --- | --- | --- |
| ① 代码层静态核对 | AI（读源码） | ✅ 已完成 |
| ② 离线链路仿真 | AI（真实 `src` 模块 + 仿真 payload） | ✅ 已完成（9/9） |
| ③ 线上真实数据验证 | **你**（用个人 token 跑脚本） | ⏳ 已提供脚本，待你执行 |

---

## 一、任务1 · Edge Function 部署状态核对

### 1.1 代码层（已核实，结论来自 `supabase/functions/zos-business-data/index.ts`）

| 检查项 | 代码位置 | 状态 |
| --- | --- | --- |
| `zos-business-data` 已部署形态（Deno.serve） | 第 221 行 | ✅ 代码结构就绪 |
| `projects` 数据源 | 第 261 行 `projects: buildProjectsSource(...)` | ✅ 已接入 |
| `wanjia.records` 正常 | 第 259 行 `records: buildWanjiaRecords(merchants)` | ✅ 已接入 |
| `huahuo.records` 正常 | 第 260 行 `records: buildHuahuoRecords(projects)` | ✅ 已接入 |
| `meta.mode = 'read_only'` | 第 263 行 `meta: { fetchedAt, mode: 'read_only' }` | ✅ 强制只读 |
| 飞书仅读（tenant_access_token） | 第 191–202 行，无写接口 | ✅ 不回写 |
| 多表拉取（万嘉 1 + 花火 3） | 第 245–256 行 searchRecords × 4 | ✅ 已接入 |

### 1.2 线上部署态（需你确认）

以下命令需你的 Supabase 登录态，请在本地执行：

```bash
# 1) 确认函数已部署
supabase functions list | grep zos-business-data

# 2) 用你的访问令牌直连验证返回体（替换 SUPABASE_URL / ANON_KEY / TOKEN）
curl -s -X GET "https://<SUPABASE_URL>/functions/v1/zos-business-data" \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -H "apikey: <SUPABASE_ANON_KEY>" | python3 -m json.tool | head -40
# 期望：含 wanjia.records / huahuo.records / projects / meta.mode="read_only"
```

> 若返回 `error: source_not_configured` → 在 Supabase 控制台为该函数配置 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 环境变量；若 `authentication_invalid` → 重新登录获取 token。

---

## 二、任务2 · 《V1.2 数据字段映射表》

### 2.1 万嘉（表：`tblrI2MjVtlOgpe7`，appToken `AWFUwAbItiI4TjkPMErcpv5Onab`）

代码字段取自 `buildWanjiaRecords`（第 101–121 行）；飞书字段为 `pick()` 候选列名。

| 代码字段 | 飞书字段（候选名） | 状态 | 备注 |
| --- | --- | --- | --- |
| `id` | 商家ID / 记录ID / RecordId | ✅ 映射 | 缺失时取 `wanjia-{idx}` |
| `merchantName` | 商家名称 | ✅ 映射 | 缺失取「未知商家」 |
| `cooperationType` | 合作类型 / 业务类型 | ✅ 映射 | 缺失取「其他」 |
| `stage` | 当前阶段 / 阶段 / 合作阶段 | ✅ 映射 | 缺失取「执行中」 |
| `owner` | 项目负责人 / 负责人 / 对接人 | ✅ 映射 | 缺失取「未指定」 |
| `updatedAt` | 最近更新时间 / 更新时间 / 修改时间 | ✅ 映射 | **风险引擎依赖此字段** |
| `nextAction` | 下一步动作 / 待办事项 / 后续动作 | ✅ 映射 | 缺失取空 |
| `riskLevel` | 风险等级 / 风险 | ✅ 映射 | 缺失取「低」 |
| `revenueStatus` | 收入状态 / 收款状态 / 回款状态 | ✅ 映射 | 缺失取「待收款」 |

### 2.2 花火（项目表：`tblZ2QIcA2ESJx4W`，appToken `EqzkwDOMEigNflkDoJdcw7FSn4d`）

代码字段取自 `buildHuahuoRecords`（第 127–147 行）。交付表 `tbl3FeKyg3Tvrm0j`、回款表 `tblllwWwvrEFgfJM` 仅喂 `summarizeHuahuo`（汇总），不进逐条明细。

| 代码字段 | 飞书字段（候选名） | 状态 | 备注 |
| --- | --- | --- | --- |
| `id` | 项目ID / RecordId | ✅ 映射 | 缺失时取 `huahuo-{idx}` |
| `clientName` | 客户名称 / 客户 | ✅ 映射 | 缺失取「未指定」 |
| `projectName` | 项目名称 | ✅ 映射 | 缺失取「花火项目」 |
| `projectType` | 项目类型 | ✅ 映射 | 缺失取「其他」 |
| `shootingDate` | 拍摄日期 / 外拍日期 | ✅ 映射 | 仅展示用 |
| `stage` | 项目状态 / 当前阶段 / 阶段 | ✅ 映射 | 缺失取「筹备中」 |
| `deliveryStatus` | 交付状态 / 交付进度 | ✅ 映射 | 缺失取「待交付」 |
| `revenueStatus` | 回款状态 / 收款状态 | ✅ 映射 | 缺失取「待回款」 |
| `profitStatus` | 利润状态 / 利润 | ✅ 映射 | 缺失取「待核算」 |
| ⚠️ `updatedAt` | （无对应字段） | ❌ **缺失** | 见「已知问题」 |

> 万嘉字段全部具备 `updatedAt`，停滞判定正常；花火明细缺 `updatedAt`，详见已知问题。

---

## 三、任务3 · 真实数据验证

### 3.1 离线链路仿真（已完成，9/9 通过）

用真实 `src/risk-detector.mjs` + `src/project-manager-agent.mjs` 跑通全链路（仿真 payload 形状等同 Edge Function 返回）。关键输出：

```
=== 风险检测（asOf=2026-07-31）===
万嘉风险: 1 | 花火风险: 2 | 项目风险: 2
风险中心排序首位: [高] 晨光便利（wanjia）→ 原因含「超过7天未更新/状态停留/未完成/高风险/回款待处理」

=== 首页驾驶舱 5 指标 ===
当前项目数量: 2 | 今日风险数量: 4 | 待跟进事项: 3 | 待审核AI内容: 0 | AI建议: 4 项需关注

=== 项目经理 Agent V2 日报 ===
日报标题: 朱帅经营日报 | 风险项计数: 5
reviewRequired: true | disclaimer 存在: true
Inbox 草稿 kind: report | 是否进入收集箱待审核: true
导出首行: # 朱帅经营日报

=== 断言汇总 ===
9/9 项通过（wanjia/huahuo records 非空 · detectRisks 生效 · 风险按等级排序 · 驾驶舱指标 · 日报 reviewRequired · disclaimer · Inbox(report)）
```

### 3.2 首页驾驶舱 / 风险中心 / 日报 — 代码层接线确认

| 验证点 | 代码位置 | 状态 |
| --- | --- | --- |
| 首页项目数 | `renderCockpit` → `cockpitProjects` | ✅ 接线 |
| 首页风险数 | `renderCockpit` → `cockpitRisk`（项目+万嘉+花火） | ✅ 接线 |
| 首页 AI 建议 | `renderCockpit` → `cockpitAdvice` | ✅ 接线 |
| 风险排序 | `renderRiskCenter` + `riskLevelOrder`（高>中>低 / 按来源） | ✅ 接线 |
| 风险原因 | `levelBadgeInline` + `suggestActionInline` | ✅ 接线 |
| 日报生成 | `generateDailyReport()`（按钮：首页 1429 / 风险页 1617） | ✅ 接线 |
| 日报进 Inbox | `inbox.push({kind:'report'})` + `saveReportDraft` | ✅ 接线 |
| 日报导出草稿 | `exportReportDraft` → `.md` 下载 | ✅ 接线 |

### 3.3 线上真实数据验证脚本（需你用个人 token 执行）

将以下脚本存为 `scripts/verify-live-v1.2.mjs`，填入你的 Supabase URL / anon key / 访问令牌后运行（**不入库此脚本亦可，纯本地诊断**）：

```js
// scripts/verify-live-v1.2.mjs —— 本地诊断，使用你的个人令牌
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { detectRisks } from '../src/risk-detector.mjs';
import { generateDailyReport, reportToMarkdown } from '../src/project-manager-agent.mjs';

const SUPABASE_URL = process.env.SB_URL;
const ANON_KEY = process.env.SB_ANON;
const TOKEN = process.env.SB_TOKEN; // 你的访问令牌
const asOf = new Date();

const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${TOKEN}` } } });
const { data, error } = await sb.functions.invoke('zos-business-data');
if (error) { console.error('Edge Function 调用失败:', error); process.exit(1); }

const wanjia = (data.wanjia?.records) || [];
const huahuo = (data.huahuo?.records) || [];
console.log('meta.mode =', data.meta?.mode, '(应为 read_only)');
console.log('wanjia.records =', wanjia.length, '| huahuo.records =', huahuo.length);
console.log('projects =', (data.projects?.projects || []).length);

const wR = detectRisks(wanjia, 'wanjia', { asOf });
const hR = detectRisks(huahuo, 'huahuo', { asOf });
console.log('风险：万嘉', wR.length, '| 花火', hR.length);
console.log('花火记录是否有 updatedAt 字段：', huahuo.every(r => !!r.updatedAt) ? '全部有' : '存在缺失→可能导致 stale 误判');

const report = generateDailyReport({ wanjia, huahuo, projects: data.projects?.projects || [], tasks: [] }, { owner: '朱帅', date: new Date().toISOString().slice(0,10), inboxDrafts: 0, asOf });
console.log('日报 reviewRequired =', report.reviewRequired, '| 风险项 =', report.risksCount);
console.log('OK：线上链路可达，详见 reportToMarkdown(report)');
```

```bash
SB_URL=https://<project>.supabase.co SB_ANON=<anon> SB_TOKEN=<your_token> \
  node scripts/verify-live-v1.2.mjs
```

---

## 四、已知问题（部署期发现，未修改逻辑）

### ✅ P1（已修复 · v1.2.1）· 花火明细缺 `updatedAt` → 风险引擎误判「停滞」

> 已于 V1.2.1 Hotfix 修复，见 `docs/zos-ai-os-v1.2.1-hotfix-report.md`。

- **根因**：风险引擎（`src/risk-detector.mjs` 第 79 行 `daysSince(r.updatedAt)`、前端内联 `detectRisksInline` 第 3674 行）以 `updatedAt` 计算停滞天数；但 Edge Function `buildHuahuoRecords` 只产出 `shootingDate`，**不产出 `updatedAt`**。
- **表现**：花火记录 `updatedAt` 为 `undefined` → `daysSince` 返回 `Infinity` → `Infinity > 7` 与 `Infinity > 14` 恒为真 → **所有花火项目被判定为「超过7天未更新 / 状态停留超过14天」→ 假阳性「高风险」**。
- **影响**：风险中心花火项普遍被标红、风险计数被夸大、排序被干扰。
- **掩盖因素**：`tests/risk-detector.test.mjs` 仅对 `wanjia` 喂 `updatedAt`，花火停滞路径无单测覆盖（已核实）。
- **已采纳方案 A（数据侧，v1.2.1）**：
  - Edge Function `buildHuahuoRecords` 增加 `updatedAt: pick(f, '最近更新时间', '更新时间') || shootingDate`（优先飞书更新时间字段，fallback `shootingDate`）；huahuo `projectTable` 拉取字段增补 `最近更新时间` / `更新时间`。
  - 本地契约 `src/huahuo-data.mjs` 的 `extractHuahuoRecord` 同步补齐 `updatedAt`（fallback `shootingDate`）。
  - 新增 `tests/huahuo-risk.test.mjs`（4 项）覆盖「有 updatedAt 正常计算 / 无 updatedAt 回退 / 不产生 Infinity / 不误判全部风险」。
  - 未采用方案 B（引擎侧），以保持风险规则不变、仅修数据契约。

### 🟡 P2 · 花火交付/回款表仅进汇总、不进明细

- `deliveryTable` / `receiptTable` 只喂 `summarizeHuahuo`（pendingDeliveries / receivedAmount），逐条明细仅来自 `projectTable`。若需单条交付/回款进度展示，需扩展 `buildHuahuoRecords` 关联三表（V1.3 规划）。

---

## 五、结论与建议

1. **代码层与离线链路**：V1.2 全链路逻辑（records → 风险检测 → 驾驶舱 → 风险中心排序 → 日报 → Inbox 草稿）已验证可用，**9/9 通过**，未改动任何业务逻辑。
2. **字段映射**：万嘉 9 字段全部映射正常；花火 9 字段映射正常，**P1（`updatedAt` 缺失）已于 v1.2.1 修复**（新增 `updatedAt`，fallback `shootingDate`）。
3. **线上真实数据**：需你用个人令牌执行第三节脚本确认（AI 不持密钥）。
4. **发布建议（P1 已落实）**：
   - V1.2.1 已修复花火 `updatedAt` 缺失，重新部署 Edge Function 后风险中心花火项不再批量假阳性标红；
   - 「首次登录验证」清单仍建议核对花火风险合理性作为二次确认；
   - `tests/huahuo-risk.test.mjs` 已补花火停滞单测，防回归。
5. **严禁项保持**：AI 仅产出待审核草稿，绝不自动发送 / 直写事实源；本验证全程未触碰任何密钥。

---

> 本报告为验证交付物；P1 已于 V1.2.1 Hotfix 修复（见 `docs/zos-ai-os-v1.2.1-hotfix-report.md`），P2 仍属 V1.3 规划。
