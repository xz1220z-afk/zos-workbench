# ISSUE-001 配置诊断报告

- **版本**：v1.2.1（Commit `827d321` / 部署 `1653698`）
- **报告日期**：2026-07-31（续查 2：配置层）
- **诊断性质**：仅定位原因，**不修改代码、不修改配置、不修复**（遵循冻结态约束）
- **诊断方法**：`supabase secrets list`（只读，仅列 NAME + digest，不暴露值）核对部署变量；与 `supabase/functions/zos-business-data/index.ts` 实际读取的变量名逐项比对

---

## 1. 部署 Secrets 实际清单（supabase secrets list 输出，NAME 与 digest）

| 部署变量 | 存在 |
|----------|------|
| FEISHU_APP_ID | ✅ |
| FEISHU_APP_SECRET | ✅ |
| SUPABASE_URL | ✅ |
| SUPABASE_ANON_KEY | ✅ |
| SUPABASE_PUBLISHABLE_KEYS | ✅ |
| SUPABASE_DB_URL | ✅（本函数未读取） |
| SUPABASE_JWKS | ✅（本函数未读取） |
| SUPABASE_SECRET_KEYS | ✅（本函数未读取） |
| SUPABASE_SERVICE_ROLE_KEY | ✅（本函数未读取） |
| FEISHU_WANJIA_APP_TOKEN | ❌ 不存在 |
| FEISHU_WANJIA_TABLE_ID | ❌ 不存在 |
| FEISHU_HUAHUO_APP_TOKEN | ❌ 不存在 |
| FEISHU_HUAHUO_TABLE_ID | ❌ 不存在 |

---

## 2. 逐项配置诊断

### 变量：FEISHU_APP_ID
- 状态：已部署（存在）
- 证据：secrets list 有 `FEISHU_APP_ID`（digest `e85f…`）；代码 `index.ts:245` `Deno.env.get('FEISHU_APP_ID')` 读取
- 结论：变量名一致、已配置。但列表**仅证明存在、不证明值有效**；若值为无效/过期飞书应用凭证 → `getTenantAccessToken` 抛 `feishu_auth_failed` → 502。

### 变量：FEISHU_APP_SECRET
- 状态：已部署（存在）
- 证据：secrets list 有 `FEISHU_APP_SECRET`（digest `165e…`）；代码 `index.ts:246` 读取
- 结论：已配置、名一致。与 APP_ID 配对决定能否换到 `tenant_access_token`；值有效性须人工确认。

### 变量：FEISHU_WANJIA_APP_TOKEN
- 状态：未部署（不存在）且**代码未读取**
- 证据：secrets list 无此 NAME；代码 `index.ts:13` 使用硬编码 `appToken: 'AWFUwAbItiI4TjkPMErcpv5Onab'`，非 env 读取
- 结论：该变量对当前代码**无关**——万嘉飞书 appToken 硬编码在源码中，部署环境变量无论是否存在都不影响取数。若硬编码值失效，**仅靠配置无法修复（须改码）**。

### 变量：FEISHU_WANJIA_TABLE_ID
- 状态：未部署且代码未读取
- 证据：secrets list 无此 NAME；代码 `index.ts:14` 硬编码 `merchantTable: 'tblrI2MjVtlOgpe7'`
- 结论：同上，无关变量；真实表 ID 硬编码。

### 变量：FEISHU_HUAHUO_APP_TOKEN
- 状态：未部署且代码未读取
- 证据：secrets list 无此 NAME；代码 `index.ts:17` 硬编码 `appToken: 'EqzkwDOMEigNflkDoJdcw7FSn4d'`
- 结论：同上，无关变量；花火 appToken 硬编码。

### 变量：FEISHU_HUAHUO_TABLE_ID
- 状态：未部署且代码未读取
- 证据：secrets list 无此 NAME；代码 `index.ts:18-20` 硬编码 `projectTable`/`deliveryTable`/`receiptTable`
- 结论：同上，无关变量；花火三表 ID 硬编码。

### 支撑变量（代码依赖且已部署，佐证 502 非配置缺失）
- `SUPABASE_URL`：代码 `index.ts:235` 读取，已部署 → 排除 `service_not_configured`(503)
- `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEYS`：代码 `configuredPublishableKey()`(28-42) 读取，均已部署 → 排除 `service_not_configured`(503)
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET`：均已部署 → 排除 `source_not_configured`(503)
- 以上与已观测到的 **HTTP 502（非 503）** 完全一致：门控全过，函数在飞书层抛错。

---

## 3. 权限 / 人工确认项（须由你或授权环境执行）

1. **飞书应用凭证有效性**：在 Supabase 控制台核对 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 是否为当前**有效**飞书应用凭证（能否成功换取 `tenant_access_token`）。沙箱不提取/不使用其值。
2. **硬编码 appToken 有效性**：登录飞书开放平台，确认源码硬编码的万嘉 `AWFUwAbItiI4TjkPMErcpv5Onab`、花火 `EqzkwDOMEigNflkDoJdcw7FSn4d` 对应的多维表格应用**未撤销、仍有效**。
3. **表存在性与读权限**：确认四个 tableId —— 万嘉 `tblrI2MjVtlOgpe7`；花火 `tblZ2QIcA2ESJx4W` / `tbl3FeKyg3Tvrm0j` / `tblllwWwvrEFgfJM` —— 存在且对应飞书应用拥有 **bitable 读权限**（无读权限 → `searchRecords` 403 → `feishu_read_failed` → 502）。
4. **一次性根因定位（须代码改动，待 Review）**：在 `index.ts:271-272` 的 catch 中返回 `error.message`，即可区分 `feishu_auth_failed` 与 `feishu_read_failed`，并定位具体失败的是哪个 appToken/tableId。

---

## 4. 配置结论

- 代码**实际依赖**的 4 个环境变量（`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`SUPABASE_URL`、publishable key）**全部已部署且名称一致** → 排除 503 类"未配置"错误，与已观测的 502（非 503）一致。
- 用户设想的 4 个 per-table 变量（`FEISHU_WANJIA_APP_TOKEN` 等）**既不存在于部署、也不被代码读取**——它们是**硬编码在源码**中的。这意味着：若 502 源于 appToken/tableId 失效，**仅通过配置无法修复，必须改码**（与冻结态冲突，须待 2026-08-07 Review 后作为 V1.3 候选）。
- 502 根因已锁定在**飞书层**：细分（auth 失败 vs read 失败、哪个 token/table）受限于 catch-all 吞错，需上述人工确认项或放开错误透出方可定论。
- 本诊断**未修改任何代码/配置**。
