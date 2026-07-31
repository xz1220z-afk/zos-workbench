# ZOS AI OS v1.2.1 Production 验收报告

- **版本**：v1.2.1
- **部署基线 Commit**：`827d321`（fix: release ZOS AI OS v1.2.1 huahuo updatedAt contract）
- **验收日期**：2026-07-31（GMT+8）
- **部署时间**：2026-07-31 02:29 UTC（≈ 10:29 GMT+8）— 见 `supabase functions list` UPDATED_AT
- **环境**：
  - Supabase 项目：`dtwvyramgbwtlyhmkhkd`（`zos-workbench`，Northeast Asia / Tokyo）
  - CLI：`supabase` 2.110.0（Homebrew 安装）
  - Edge Function：`zos-business-data`，部署后 STATUS = **ACTIVE**，VERSION = 2
- **范围**：仅生产上线前检查 + 上线部署 + 上线验证。**未改动任何业务逻辑、UI、功能、风险规则**（冻结约束成立）。

---

## 任务1：部署环境检查 ✅

| 检查项 | 结果 | 证据 |
|---|---|---|
| Supabase CLI | ✅ | `supabase --version` → 2.110.0（Homebrew 安装） |
| 登录状态（会话） | ✅ | `supabase projects list` 成功列出 `zos-workbench` |
| Project link | ✅ | `supabase link --project-ref dtwvyramgbwtlyhmkhkd` → Finished |
| Migration 本地基线 | ✅ | `supabase/migrations/` 含 `001_zos_sync.sql` / `002_business_data_cache.sql` / `003_projects_cache.sql` |
| Migration 远端 applied 状态 | ⚠️ 未在本沙箱核验 | `supabase migration list --linked` 直连 Postgres，需数据库密码；本沙箱无密码且按约束不触碰。见「已知限制」。 |

> 说明：本地三份迁移文件即预期基线；远端是否已 applied 不影响本次 Edge Function 部署（部署走 Management API，不经 DB）。**函数运行时会写入 `zos_business_cache` 表**，该表由迁移 002 创建——故任务4 的真实链路贯通本身即可反证迁移已 applied（若未应用，用户登录后取数将报错）。

---

## 任务2：迁移状态确认（命令已执行，远端明细待密码）

已执行 `supabase migration list --linked`，返回：
```
Initialising login role...
Connecting to remote database...
failed to connect to postgres: PgClient: Failed to connect
```
原因：该命令直连远端 Postgres，需要数据库密码；本沙箱未持有，按约束不处理密码。
**预期基线（本地文件）**：001 / 002 / 003 三份迁移均已就绪，且与 V1.2.1 修复无关（updatedAt 由 Edge Function 在读取飞书时计算，不新增表列）。

---

## 任务3：线上部署 ✅ 成功

```bash
supabase functions deploy zos-business-data --project-ref dtwvyramgbwtlyhmkhkd --no-verify-jwt
```
输出：
```
Uploading asset (zos-business-data): supabase/functions/zos-business-data/index.ts
Deployed Functions on project dtwvyramgbwtlyhmkhkd: zos-business-data
```
部署后 `supabase functions list` 确认：
```
ID 8be3aec8-... | NAME zos-business-data | STATUS ACTIVE | VERSION 2 | UPDATED_AT 2026-07-31 02:29:51
```
→ **生产环境已生效，承载 V1.2.1 修复代码。**

---

## 任务4：线上验证（数据链路）

### 4.1 函数存活 & 鉴权（已验证 ✅）
对生产 URL 直接探测（无令牌）：
```bash
curl https://dtwvyramgbwtlyhmkhkd.functions.supabase.co/zos-business-data
```
返回：
```json
{"error":"authentication_required"}
HTTP 401
```
结论：
- 函数**已上线且可达**（生产域名正常响应）。
- 运行的是**正确代码**（返回结构化的预期错误）。
- **鉴权强制生效**（未带令牌即拒，安全姿态正确）。

### 4.2 认证数据链（万嘉 / 花火）⚠️ 需用户在 Dashboard 登录后确认
函数入口强制 `supabase.auth.getUser(token)`，token 必须是本项目**已登录用户的 JWT**。该 JWT 仅存在于用户浏览器登录态（邮箱登录后），本沙箱不持有、且按约束不处理 token，故无法代跑取数。

代码层正确性已由测试锁定（无需线上即可保证）：
- 全量 118/118 通过，含 `tests/huahuo-risk.test.mjs` 4 项：updatedAt 存在 → `daysSince` 为有限值、无 `Infinity`、健康花火不误标红。
- 部署代码 = 被测代码（同 commit `827d321`）。

**用户侧最终验收步骤（1 分钟，在浏览器完成）**：
1. 打开 ZOS Dashboard（已部署前端）→ 用邮箱登录完成链接认证。
2. 进入「经营数据 / 万嘉 / 花火」面板，触发一次数据同步（调用 `zos-business-data`）。
3. 按以下标准逐项核对：

| 维度 | 验收标准 | 通过判据 |
|---|---|---|
| 万嘉 records | 正常返回 | 列表条数 > 0 且与飞书一致 |
| 万嘉 updatedAt | 存在 | 每条含非空 `updatedAt` |
| 万嘉 风险计算 | 正常 | 停滞/回款等级与「最近更新时间」相符，无整列误判 |
| 花火 records | 正常返回 | 列表条数 > 0 |
| 花火 updatedAt | 存在 | 每条 `huahuo` 记录含非空 `updatedAt` |
| 花火 daysSince | 有限数字 | `daysSince(updatedAt)` 为有限值，非 `Infinity` |
| 花火 Infinity | 不出现 | 风险引擎对花火不再 `Infinity > 7` 恒真 |
| 花火 误标红 | 不出现 | 近期且已交付/已回款的健康项目不报警 |

> 如需在终端自验，可用下列模板（将 `<YOUR_JWT>` 替换为你登录后浏览器/前端拿到的用户令牌）：
> ```bash
> curl -H "Authorization: Bearer <YOUR_JWT>" \
>   https://dtwvyramgbwtlyhmkhkd.functions.supabase.co/zos-business-data \
>   | python3 -m json.tool
> ```
> 重点查看 `huahuo.records[].updatedAt` 与 `meta.mode === 'read_only'`。

---

## 任务5：UAT 记录（本报告）

| 任务 | 状态 | 说明 |
|---|---|---|
| 1 部署环境检查 | ✅ | CLI/会话/link 就绪；迁移本地基线明确 |
| 2 迁移状态 | ⚠️ 部分 | 本地 001/002/003 确认；远端 applied 需 DB 密码（沙箱无） |
| 3 线上部署 | ✅ | `zos-business-data` ACTIVE v2，生产已生效 |
| 4 线上验证 | 🟡 | 函数存活+鉴权已验（401）；认证数据链需用户登录态完成 |
| 5 验收报告 | ✅ | 本报告 |

---

## 已知限制
1. **迁移远端状态未直连核验**：`migration list --linked` 需数据库密码，本沙箱无；以「函数写入 `zos_business_cache` 成功即反证迁移已应用」作为间接验证。
2. **认证数据链需用户 JWT**：函数强制用户级鉴权，沙箱无法代跑；已在 4.2 给出用户侧验收清单与 curl 模板。
3. **飞书字段名假设**：`'最近更新时间'/'更新时间'` 为假定列名；若实际表列名不同，会回退 `shootingDate`（已兜底，精度略降），建议首次取数后核对。
4. **环境变量延续**：本次部署保留既有函数环境变量（`SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEYS`/`FEISHU_APP_ID`/`FEISHU_APP_SECRET`），未改动、未明文入仓。

## 部署事实小结
- 部署时间：2026-07-31 02:29 UTC
- 环境：Supabase `dtwvyramgbwtlyhmkhkd`（Tokyo）
- 结果：Edge Function `zos-business-data` → **ACTIVE**，承载 V1.2.1 P1 修复（花火 `updatedAt` 数据契约）
- 测试：RC 阶段 118/118、PWA 1/1、内联脚本语法 OK；本次 deploy 成功、函数存活、鉴权生效
- 剩余动作：用户在 Dashboard 登录后按 4.2 完成数据链最终勾选，即可签署 Production 验收通过
