# ZOS AI OS V1.2 部署检查清单

> 适用版本：v1.2.0 · 配套提交：`feat: release ZOS AI OS v1.2.0 operating cockpit`
> 目标：将 V1.2（万嘉/花火明细 + 风险中心 + 项目经理 Agent V2 + 经营驾驶舱）上线到 `xz1220z-afk/zos-workbench`。
> 原则：**不修改业务逻辑、不回写事实源、AI 仅产出待审核草稿。**

---

## ✅ 1. Supabase Migration

- [ ] 本地确认迁移文件存在：`supabase/migrations/003_projects_cache.sql`（`zos_business_cache.source` 枚举已含 `wanjia/huahuo/brain/projects`）。
- [ ] 若 `003` 尚未在目标项目执行，运行：
  ```bash
  supabase db push            # 或 supabase migration up
  ```
- [ ] 在 Supabase SQL Editor 复核 `zos_business_cache.source` CHECK 约束包含 `'wanjia'` 与 `'huahuo'`。
- [ ] 确认受保护写路径（service role）仍仅由 Edge Function 调用，PWA 侧无写权限。

## ✅ 2. Edge Function Deploy

- [ ] 部署 `zos-business-data`：
  ```bash
  supabase functions deploy zos-business-data
  ```
- [ ] 核对函数已包含 V1.2 扩展：`buildWanjiaRecords` / `buildHuahuoRecords`，响应含 `wanjia.records` 与 `huahuo.records`。
- [ ] 确认响应 `meta.mode === 'read_only'`，且每个 record `source/mode` 均为只读标记。
- [ ] 验证多表拉取：`wanjia.merchantTable`、`huahuo.projectTable` + `deliveryTable` + `receiptTable` 均已接入 `searchRecords`。
- [ ] 在 Supabase 控制台为函数配置飞书 `tenant_access_token`（仅读），无写令牌。

## ✅ 3. 环境变量

- [ ] `VITE_SUPABASE_URL` / 发布配置中的 Supabase URL 指向正确项目（非本地）。
- [ ] `VITE_SUPABASE_ANON_KEY`（publishable key，非 service role）已就位；PWA 用它做登录与只读 `fetchBusinessData`。
- [ ] 飞书凭据仅存在于 Edge Function 服务端环境变量，**绝不**出现在前端打包产物中（可用 `grep -R "app_secret\|tenant" dist/ index.html` 复核）。
- [ ] 若使用本地 `.env`，确认其已被 `.gitignore` 屏蔽，未进入本次提交。

## ✅ 4. PWA 缓存更新

- [ ] `sw.js` 中 `CACHE_NAME` 已从 `zos-workbench-v1.1.0` 升级为 **`zos-workbench-v1.2.0`**（强制用户重新缓存新资源）。
- [ ] 重新构建并部署静态站点（GitHub Pages / 你选定的托管），确认 `index.html` 内 `APP_VERSION = '1.2.0'` 与设置页 `v1.2.0 · 2026-07-30` 一致。
- [ ] 清理旧 Service Worker 缓存：发布后访问站点，确认无 1.1.0 资源被复用（可手动 unregister SW 验证）。
- [ ] 核对 `index.html` 体积与内联脚本通过 `node --check`（已验证）。

## ✅ 5. 首次登录验证

- [ ] 打开已部署站点，用 Supabase 邮箱完成登录（或本地 magic link）。
- [ ] 进入「万嘉网络」页 → 点击 **↻ 刷新数据** → 确认明细列表出现商家/合作类型/阶段/负责人/风险/收入（只读）。
- [ ] 进入「花火影像」页 → 点击 **↻ 刷新数据** → 确认明细列表出现客户/项目/类型/拍摄/阶段/交付/回款/利润。
- [ ] 进入「风险中心 · 老板决策页」→ 确认横幅统计（需立即处理/需关注/正常）与决策卡片，红黄绿分级正确，排序按钮可用。
- [ ] 首页驾驶舱确认五卡：当前项目数 / 今日风险数 / 待跟进 / 待审核 AI / AI 建议。
- [ ] 点击「**生成今日经营日报**」→ 确认进入「收集箱」显示 `AI日报·待审核`，点「导出日报(.md)」可下载，**未发生任何自动发送或修改**。
- [ ] 检查浏览器控制台无报错，且数据请求均带 `mode: read_only` 标记。

## ✅ 6. 回滚预案

- [ ] 保留上一版 `sw.js` 的 `CACHE_NAME = v1.1.0` 快照，异常时可回退。
- [ ] 若 Edge Function 异常，PWA 会回退到本地缓存 / `zos_business_cache`，业务不中断（仅明细可能为空）。
- [ ] 提交记录可 `git revert` 本次发布提交快速回退。

---

> 全部勾选后，V1.2 即视为正式发布。任何需密钥/登录态的操作（迁移、部署、Supabase 登录）由你执行；AI 不代操作。
