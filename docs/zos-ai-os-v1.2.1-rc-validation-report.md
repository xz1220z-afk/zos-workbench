# ZOS AI OS V1.2.1 RC 验证报告

- **版本**：v1.2.1（Release Candidate）
- **基线**：v1.2.0（commit `bfb5230`）
- **验证时间**：2026-07-31
- **验证范围**：仅针对 V1.2.1 Hotfix（花火 `huahuo.records` 缺失 `updatedAt` 数据契约修复），**未改动任何业务逻辑、UI 结构、风险规则或新增功能**，符合冻结约束。
- **运行时**：Node v22.22.2（managed），`node --test` TAP 14

---

## 1. 测试结果

| 验证项 | 命令 | 结果 | 数量 |
|---|---|---|---|
| 全量回归 + 新增 | `node --test tests/*.test.mjs` | ✅ PASS | 118 / 118 |
| PWA 基线 | `node --test tests/pwa-baseline.test.mjs` | ✅ PASS | 1 / 1 |
| 首页内联脚本语法 | `node --check`（提取 `<script type="module">`） | ✅ SYNTAX_OK | 1 / 1 |

**全量测试明细**：

```
# tests 118
# suites 0
# pass 118
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 205.10
```

- 回归测试（v1.2.0 既有）：**114 项全部保持通过**，无新增失败、无跳过。
- 新增测试 `tests/huahuo-risk.test.mjs`：**4 项全部通过**，专门覆盖 P1 根因路径。
- PWA 基线：版本断言 `1.2.0 → 1.2.1`、`CACHE_NAME='zos-workbench-v1.2.1'` 全部命中，隐私/只读约束断言保持通过。
- 内联脚本：提取 `index.html` 第 2052–4195 行（106,563 字节 / 2,146 行）独立执行 `node --check`，无语法错误、无顶层解析异常。

---

## 2. 修复确认

P1 根因：风险引擎 `daysSince(r.updatedAt)` 在花火记录缺失 `updatedAt` 时返回 `Infinity`，使 `Infinity > 7` 恒真，导致**所有花火项目被误判为停滞高风险**。

修复点（已逐文件确认落盘）：

### 2.1 Edge Function — `supabase/functions/zos-business-data/index.ts`
- `buildHuahuoRecords` 现产出 `updatedAt`：
  - 行 114：`updatedAt: String(pick(f, '最近更新时间', '更新时间', '修改时间') || new Date().toISOString())`
  - 行 138–145：带注释标注的 P1 hotfix 分支，`updatedAt = String(pick(f, '最近更新时间', '更新时间') || shootingDate)`，并随记录返回。
- huahuo `projectTable` 拉取字段增补 `'最近更新时间', '更新时间'`（行 257），确保源数据可取到更新时间。
- **约束合规**：保持 `mode: 'read_only'`，不回写、不修改权限、不新增 Agent。

### 2.2 本地契约同步 — `src/huahuo-data.mjs`
- 行 128：`extractHuahuoRecord` 增加 `updatedAt: normalizeDate(raw.updatedAt ?? raw.最近更新时间 ?? raw.更新Time ?? raw.shootingDate ?? raw.拍摄日期)`，与万嘉（wanjia）契约对齐；保持可选，不破坏 `validateHuahuoIndex`。

### 2.3 版本与缓存
- `index.html`：`APP_VERSION='1.2.1'`、`APP_RELEASE_DATE='2026-07-31'`、设置页标签 `v1.2.1 · 2026-07-31`。
- `sw.js`：`CACHE_NAME='zos-workbench-v1.2.1'`。

### 2.4 文档与测试
- `CHANGELOG.md`：新增 `## v1.2.1 — Hotfix：修复花火记录缺失 updatedAt 导致风险假阳性`。
- `tests/huahuo-risk.test.mjs`：4 项用例（见下）。

### 2.5 新增测试覆盖（4 项）
1. 有 `updatedAt` 时 `daysSince` 返回**有限、精确**值（非 `Infinity`）。
2. 无 `updatedAt` 时**回退到 `shootingDate`**，不产生 `Infinity`。
3. 即便记录完全缺失更新时间字段，也**不产生 `Infinity`**。
4. **不误判全部项目**：近期且已交付/已回款的健康花火项目不报警，断言返回 2 条而非 3 条。

---

## 3. 回归情况

- **业务逻辑零改动**：风险引擎阈值、`daysSince` 算法、排序/横幅规则、经营日报生成逻辑均未修改，仅补充 `updatedAt` 字段契约。
- **UI 零改动**：未调整任何 DOM 结构、样式或交互；`index.html` 仅版本号字符串变更（6 行）。
- **既有 114 项测试全部通过**：证明数据真实性（25 项）、PWA 基线、万嘉/花火契约、风险检测、项目 Agent 等既有行为未被破坏。
- **契约对齐**：花火 `updatedAt` 取值链与万嘉一致（`normalizeDate` 统一处理），消除两类数据源在风险计算上的不一致。

---

## 4. 已知限制

1. **Edge Function 尚未线上部署**：本次仅完成本地代码修复与单元测试验证。线上生效需执行 `supabase functions deploy zos-business-data --project-ref dtwvyramgbwtlyhmkhkd`，部署后风险引擎方能读取到带 `updatedAt` 的真实花火记录。
2. **飞书字段名依赖**：`'最近更新时间' / '更新时间' / '修改时间'` 为假定字段名；若真实飞书多维表格列名不同，仍可能取不到而回退到 `shootingDate`（已兜底，但精度下降）。建议部署后核对线上字段映射。
3. **离线验证边界**：本验证基于单元测试与契约仿真，未覆盖真实网络请求、Supabase 权限、飞书 API 鉴权等端到端路径。
4. **风险规则冻结**：按约束，风险阈值与判定规则未做任何调整；若后续发现个别健康项目仍被误报，需另立变更评估，不属本次 Hotfix 范围。
5. **未提交**：按指令，Git 提交 `fix: release ZOS AI OS v1.2.1 huahuo updatedAt contract` 将在**全部验证通过后**执行（本报告即"全部通过"的凭证）。

---

## 5. 验证结论

✅ **V1.2.1 RC 全部验证通过**（全量 118/118、PWA 1/1、内联脚本语法 OK）。
✅ **P1 根因已修复并落到代码与测试**。
✅ **无回归、无越界改动**。

→ 可执行 Git 提交固化（见第 4 节第 5 条与提交清单）。

## 附：待提交变更清单（git status）

```
 M CHANGELOG.md
 M index.html
 M src/huahuo-data.mjs
 M supabase/functions/zos-business-data/index.ts
 M sw.js
 M tests/pwa-baseline.test.mjs
?? docs/zos-ai-os-v1.2.1-hotfix-report.md
?? docs/zos-ai-os-v1.2-deploy-verification-report.md
?? tests/huahuo-risk.test.mjs
```

提交信息建议：
```
fix: release ZOS AI OS v1.2.1 huahuo updatedAt contract

- Edge Function buildHuahuoRecords 产出 updatedAt（飞书更新时间 > shootingDate 兜底）
- 本地 huahuo-data 契约对齐，normalizeDate 统一处理
- 新增 huahuo-risk 测试 4 项，修复风险假阳性 P1
- 版本号/缓存升至 v1.2.1
```
