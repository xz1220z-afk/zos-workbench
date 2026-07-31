# ISSUE-001 飞书资源状态确认报告

- **版本**：v1.2.1（Commit `827d321` / 部署 `1653698`）
- **报告日期**：2026-07-31（续查 3：飞书资源层）
- **诊断性质**：仅定位原因，**不修改代码、不修改配置、不修复**（遵循冻结态约束）
- **重要说明**：飞书 Base/Table 存在性与读取权限的**真实状态，必须由人工（你或持有飞书应用凭证的授权环境）在飞书开放平台 / 多维表格后台核对**。沙箱**无** `FEISHU_APP_ID`/`FEISHU_APP_SECRET` 的值，按安全约束我**不提取、也不调用飞书 API**；因此本报告为**核对工作表 + 判定方法**，结果字段留作「待人工确认」，不臆造。
- **关联**：硬编码值来源 `supabase/functions/zos-business-data/index.ts:11-22`；502 链路见 `docs/issue-001-data-access-diagnosis.md`；配置核对见 `docs/issue-001-config-diagnosis.md`

---

## 一、万嘉（wanjia）

硬编码值（源码 `index.ts:13-14`）：
- APP_TOKEN：`AWFUwAbItiI4TjkPMErcpv5Onab`
- TABLE_ID（merchantTable）：`tblrI2MjVtlOgpe7`

| 核对项 | 确认方法 | 结果 |
|--------|----------|------|
| 1. Base 是否存在 | 飞书多维表格 → 打开 app_token=`AWFUwAbItiI4TjkPMErcpv5Onab` 对应 Base；或 API `GET /open-apis/bitable/v1/apps/AWFUwAbItiI4TjkPMErcpv5Onab`（需 tenant_access_token） | 待人工确认 |
| 2. Table 是否存在 | 在该 Base 内查找 table_id=`tblrI2MjVtlOgpe7` | 待人工确认 |
| 3. 当前应用是否有读取权限 | 确认创建本函数的飞书应用（`FEISHU_APP_ID` 对应应用）在 Base 的协作成员中具备「可阅读」权限 | 待人工确认 |

**万嘉综合判定**：☐ 资源不存在　☐ 存在但无权限　☐ 正常　— **待人工确认**

---

## 二、花火（huahuo）

硬编码值（源码 `index.ts:17-20`）：
- APP_TOKEN：`EqzkwDOMEigNflkDoJdcw7FSn4d`
- TABLE_ID：
  - projectTable：`tblZ2QIcA2ESJx4W`
  - deliveryTable：`tbl3FeKyg3Tvrm0j`
  - receiptTable：`tblllwWwvrEFgfJM`

| 核对项 | 确认方法 | 结果 |
|--------|----------|------|
| 1. Base 是否存在 | 飞书多维表格 → 打开 app_token=`EqzkwDOMEigNflkDoJdcw7FSn4d` 对应 Base | 待人工确认 |
| 2. Table 是否存在（三表） | 在 Base 内查找 `tblZ2QIcA2ESJx4W` / `tbl3FeKyg3Tvrm0j` / `tblllwWwvrEFgfJM` | 待人工确认 |
| 3. 当前应用是否有读取权限 | 确认 `FEISHU_APP_ID` 对应应用在 Base 协作成员中具备「可阅读」权限 | 待人工确认 |

**花火综合判定**：☐ 资源不存在　☐ 存在但无权限　☐ 正常　— **待人工确认**

---

## 三、自助 API 核对（可选，需凭证）

若你持有 `FEISHU_APP_ID`/`FEISHU_APP_SECRET`，可换取 tenant token 后核对（**请勿在沙箱外泄露凭证**）：

```bash
# 1) 换取 tenant_access_token（用你自己的 app_id/app_secret）
curl -X POST 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' \
  -H 'Content-Type: application/json' \
  -d '{"app_id":"<FEISHU_APP_ID>","app_secret":"<FEISHU_APP_SECRET>"}'
# 取返回中的 tenant_access_token

# 2) 核对 Base 是否存在（万嘉示例）
curl 'https://open.feishu.cn/open-apis/bitable/v1/apps/AWFUwAbItiI4TjkPMErcpv5Onab' \
  -H "Authorization: Bearer <TENANT_TOKEN>"
#   code=0 且返回 app 信息 → Base 存在；code=404/1254011 → Base 不存在/无权限

# 3) 核对 Table 是否存在（万嘉 merchantTable 示例）
curl 'https://open.feishu.cn/open-apis/bitable/v1/apps/AWFUwAbItiI4TjkPMErcpv5Onab/tables/tblrI2MjVtlOgpe7' \
  -H "Authorization: Bearer <TENANT_TOKEN>"
#   code=0 → Table 存在；code=404 → Table 不存在
```

判读：
- `code=0` → 资源正常、有权限
- `code=404`（app/table not found）→ **资源不存在**
- `code=1254011 / 无权限类** → **存在但无权限**

---

## 四、判读与 502 的对应关系

| 飞书资源核对结果 | 对应函数行为 | 与 502 关系 |
|------------------|--------------|-------------|
| 任一 Base/Table 不存在 | `searchRecords` 返 404 → 抛 `feishu_read_failed` | 直接致 502 `source_read_failed` |
| Base/Table 存在但应用无读权限 | `searchRecords` 返 403 → 抛 `feishu_read_failed` | 直接致 502 |
| 万嘉/花火资源均正常且有读权限 | 排除 read 层 → 转向 `feishu_auth_failed`（FEISHU_APP_ID/SECRET 失效） | 仍 502，但根因在凭证 |

---

## 五、结论

- 本项（飞书 Base/Table 存在性 + 读取权限）**须经人工核对回填**，沙箱因无凭证且受安全约束无法代执行；报告不臆造结果。
- 无论最终判定为「资源不存在」「存在但无权限」或「正常」，修复都**必须改码**（调整硬编码 appToken/tableId，或改用环境变量驱动）或放开 `catch` 错误透出——均属冻结态外动作，须待 **2026-08-07 Production Review** 后作为 V1.3 候选开发。
- 本核对工作表**未修改任何代码/配置**。
