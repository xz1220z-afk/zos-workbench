# ZOS CEO OS v1.3.0 生产部署与回滚清单

> 项目：Supabase `zos-workbench`（ref `dtwvyramgbwtlyhmkhkd`）  
> 站点：<https://xz1220z-afk.github.io/zos-workbench/>  
> 原则：迁移与函数先上线，静态页面最后上线；任何真实飞书写入仍逐条确认。

## 1. 发布前

- [ ] `node --test tests/*.test.mjs` 全绿；所有 `.mjs` 语法通过；`git diff --check` 无错误。
- [ ] `npx supabase projects list` 回读项目名为 `zos-workbench`、ref 正确、状态健康。
- [ ] Supabase Secrets 已存在 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`，但任何输出和文档都不显示值。
- [ ] 飞书应用已发布，具备多维表格记录读取权限，并已作为协作者加入万嘉、花火 Base。

## 2. 数据库（加法迁移）

```bash
npx supabase link --project-ref dtwvyramgbwtlyhmkhkd
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase migration list --linked
```

预期新增 `004_ceo_os_v1_3.sql`。它只新增/扩展私有表与策略，不删除 v1.2.3 数据。

## 3. Edge Functions

```bash
npx supabase functions deploy zos-business-data zos-brain-index \
  zos-feishu-approval-preview zos-feishu-approval-execute zos-monitor \
  --project-ref dtwvyramgbwtlyhmkhkd --use-api
```

不要使用 `--no-verify-jwt`。匿名访问五个函数均应返回 `401`；登录后业务接口只能返回只读契约，监控接口只接受脱敏事件。

## 4. 静态站发布

```bash
git push -u origin codex/zos-ceo-os-v1.3
git switch main
git merge --ff-only codex/zos-ceo-os-v1.3
git push origin main
```

等待 GitHub Pages 后回读 `index.html`、`manifest.webmanifest`、`sw.js`、`assets/app.css`、`src/app.mjs`，确认版本和缓存均为 `1.3.0`。

## 5. 业务验收

- [ ] 登录后刷新万嘉、花火：显示当前时间、真实条数、事实字段，不出现模拟 KPI。
- [ ] 企业大脑只显示路径、标题、标签、时间，不出现笔记正文。
- [ ] 目标必须带“已确认”标记，缺少真实值时显示缺失而不是 0。
- [ ] 每日简报默认“待人工审核”；同一天相同数据不重复生成。
- [ ] Mac / Windows / iPhone / Android 前台同步可用；无法接触的实体设备明确记录为待人工验收。
- [ ] 选一条低风险飞书记录生成预览，把字段、原值、新值展示给朱帅；未获该条确认前停止。

## 6. 回滚

- 前端基线：v1.2.3 commit `41cdc32`。回滚用新提交恢复该内容并再次提升 Service Worker 缓存名，禁止复用旧缓存名。
- Edge Function：在 Supabase 控制台恢复上一已验证版本，或从 `41cdc32` 重新部署对应函数。
- 数据库：v1.3 表为加法结构，前端回滚时保留它们；不要为回滚删除表或用户数据。
- 飞书：已执行写入不能靠数据库回滚撤销；必须新建一条反向预览，展示当前值与恢复值，再由朱帅单独确认。

