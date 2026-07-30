# ZOS AI OS V1.2.1 Hotfix Report

**版本**：v1.2.1（由 v1.2.0 升级）
**日期**：2026-07-31
**类型**：P1 数据契约 Hotfix（仅修复数据契约，无业务功能新增 / 无 UI 结构改动 / 无风险规则修改 / 无架构重构）
**commit**：待固化（见第 6 节）

---

## 1. Hotfix 目标与范围边界

修复 V1.2 部署验证（见 `docs/zos-ai-os-v1.2-deploy-verification-report.md`）发现的 **P1 数据契约问题**：

- 花火 `huahuo.records` 缺少 `updatedAt` 字段；
- 风险探测器 `detectRisks` 使用 `updatedAt` 计算停滞天数（`daysSince`），字段缺失时 `new Date(undefined)` 为非法日期 → 返回 `Infinity`；
- 结果：所有花火项目被误判为「超 7 天未更新 / 状态停滞」高风险假阳性，污染风险中心与经营驾驶舱。

**边界（严格遵守）**：
- ✅ 仅修改数据契约（Edge Function 输出 + 本地只读契约）；
- ❌ 不修改 UI 结构、不新增 Agent、不修改风险规则、不重构架构；
- ❌ 不触碰任何密钥 / token / service role key；
- ❌ 不改变 `read_only` 模式与权限模型。

---

## 2. P1 根因

`supabase/functions/zos-business-data/index.ts` 的 `buildHuahuoRecords` 仅产出 `shootingDate`，未产出 `updatedAt`；而 `src/risk-detector.mjs` 第 79 行 `const since = daysSince(r.updatedAt, asOf);` 依赖该字段。对照：同文件的 `buildProjectsSource` 与 `src/wanjia-data.mjs` 的 `extractWanjiaRecord` 均已携带 `updatedAt`，唯独花火明细记录缺失，形成契约不对称。

> 该缺口未被既有单测覆盖：旧单测仅给万嘉记录喂 `updatedAt`，未构造「花火记录无 updatedAt」场景，故 CI 绿但通过。

---

## 3. 修复方案

### 3.1 Edge Function `buildHuahuoRecords`（主修复点，线上链路数据源）

`supabase/functions/zos-business-data/index.ts`：

```ts
records: records.map((record, idx) => {
  const f = fieldsOf(record);
  const shootingDate = String(pick(f, '拍摄日期', '外拍日期') || new Date().toISOString());
  // P1 hotfix (v1.2.1): huahuo records must carry updatedAt so the risk
  // detector can compute stale/stuck days without producing Infinity.
  // Prefer the Feishu project update-time field; fall back to shootingDate.
  const updatedAt = String(pick(f, '最近更新时间', '更新时间') || shootingDate);
  return {
    id: String(pick(f, '项目ID', 'RecordId') || `huahuo-${idx}`),
    clientName: String(pick(f, '客户名称', '客户') || '未指定'),
    projectName: String(f['项目名称'] || '花火项目'),
    projectType: String(pick(f, '项目类型') || '其他'),
    shootingDate,
    updatedAt,
    stage: String(pick(f, '项目状态', '当前阶段', '阶段') || '筹备中'),
    deliveryStatus: String(pick(f, '交付状态', '交付进度') || '待交付'),
    revenueStatus: String(pick(f, '回款状态', '收款状态') || '待回款'),
    profitStatus: String(pick(f, '利润状态', '利润') || '待核算'),
  };
}),
```

取值规则（符合要求）：
- **优先**：飞书项目更新时间字段 `最近更新时间`（次选 `更新时间`）；
- **fallback**：若上述字段均不存在，使用 `shootingDate`；
- `pick()` 仅返回首个非空值，字段缺失时优雅回退，不抛错。

同时在 huahuo `projectTable` 拉取字段中增补 `'最近更新时间', '更新时间'`，确保字段真实从飞书读取：

```ts
searchRecords(accessToken, FEISHU.huahuo.appToken, FEISHU.huahuo.projectTable,
  ['项目名称', '项目状态', '拍摄日期', '合同金额', '已收金额', '负责人',
   '项目类型', '回款状态', '利润状态', '最近更新时间', '更新时间']),
```

### 3.2 本地只读契约 `src/huahuo-data.mjs`（契约对称性修复）

`extractHuahuoRecord` 同步补齐 `updatedAt`，与万嘉对齐：

```js
shootingDate: normalizeDate(raw.shootingDate ?? raw.拍摄日期),
updatedAt: normalizeDate(raw.updatedAt ?? raw.最近更新时间 ?? raw.更新时间 ?? raw.shootingDate ?? raw.拍摄日期),
stage: normalizeStage(raw.stage ?? raw.当前阶段 ?? raw.项目状态 ?? raw.阶段),
```

- `updatedAt` 保持 **可选**，不进入 `REQUIRED_HUAHUO_KEYS`，不破坏既有 `validateHuahuoIndex` 校验；
- 同样 fallback 到 `shootingDate`，保证本地缓存路径与线上路径行为一致。

---

## 4. 测试（任务 2）

新增 `tests/huahuo-risk.test.mjs`，4 项覆盖用户要求的四个检查点：

| 用例 | 覆盖点 | 断言 |
|---|---|---|
| 有 updatedAt 时正常计算 daysSince | ① 有 updatedAt 正常计算 | 12 天前更新 → `已停滞 12 天`，非 `Infinity` |
| 无 updatedAt 时回退到 shootingDate | ② 无 updatedAt 使用 fallback | `extractHuahuoRecord` 将 `updatedAt` 补为 `shootingDate`；原因文本无 `Infinity` |
| 不产生 Infinity | ③ 不产生 Infinity | 即使原始记录完全缺失日期字段，所有原因文本均不含 `Infinity` |
| 不误判全部花火项目 | ④ 不误判全部风险 | 近期且已交付/已回款的健康项目不被标记；`detectRisks` 返回 2 条而非 3 条 |

测试使用真实 `src` 模块（`detectRisks` + `extractHuahuoRecord`），`asOf` 注入保证确定性，无网络、无密钥。

---

## 5. 版本与发布（任务 3）

- `index.html`：`APP_VERSION = '1.2.1'`、设置页标签 `v1.2.1 · 2026-07-31`；
- `sw.js`：`CACHE_NAME = 'zos-workbench-v1.2.1'`（PWA 缓存更新，强制重新缓存）；
- `tests/pwa-baseline.test.mjs`：版本断言同步至 `1.2.1`；
- `CHANGELOG.md`：新增 `## v1.2.1` 段落（即本 Hotfix 的 release note）；
- `docs/zos-ai-os-v1.2-deploy-verification-report.md`：P1 已在 v1.2.1 修复（见第 7 节）。

---

## 6. 验证结果（任务 4）

> ⚠️ **执行说明**：本环境的命令执行通道（Bash/Node）在本次会话中不可用（工具返回 "command 参数未定义" 异常），故以下命令**代码与测试均已就绪但未能在本会话内实际运行**。请在本地或下一可执行环境中运行确认。

```bash
# 1. 全量测试（应 ≥ 118 通过：原 114 + 新增 4）
node --test tests/*.test.mjs

# 2. PWA 测试
node --test tests/pwa-baseline.test.mjs

# 3. 内联脚本语法检查
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const a=h.indexOf('<script type=\"module\">');const b=h.indexOf('</script>',a);fs.writeFileSync('/tmp/check.mjs',h.slice(a+21,b));" && node --check /tmp/check.mjs
```

**预期**：全量测试 118/118 通过（114 回归 + 4 新增）、PWA 0 fail、内联 JS 语法 OK、Edge Function TS 编译通过。

---

## 7. 部署动作（需你执行）

Hotfix 仅改 Edge Function 与本地契约，**Edge Function 必须重新部署**才能生效于线上：

```bash
supabase functions deploy zos-business-data --project-ref dtwvyramgbwtlyhmkhkd
```

部署后建议按 `docs/zos-ai-os-v1.2-deploy-verification-report.md` 的「线上验证脚本」复核花火风险中心不再出现全量假阳性。

---

## 8. 限制与回归风险

- **限制（与 v1.2.0 一致）**：万嘉/花火真实数据仍需部署本更新后的 Edge Function 并配置对应 ERP 只读视图；未登录前明细区与驾驶舱仍显示空态或本地缓存。
- **回归风险**：低。改动仅新增一个字段（且为可选），`pick()` 与 `normalizeDate` 均对缺失值优雅回退；未触及风险规则、UI、权限。
- **未做**：未顺带修复万嘉契约在「无任何更新时间字段」时 `normalizeDate(undefined)` 回退到 epoch（1970）导致的「极大但有限」天数问题——该路径万嘉线上始终携带 `最近更新时间`，不触发假阳性，留待 V1.3 评估。
