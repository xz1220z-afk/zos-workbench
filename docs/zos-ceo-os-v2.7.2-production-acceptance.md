# ZOS CEO Operating System v2.7.2 生产验收

## 范围

- 万嘉历史范围查询的可见反馈。
- 历史数据缺失时的真实空状态与口径边界。
- PWA 资源图升级到 `v2.7.2`。

## 上线前验收

- 自动化测试：`node --test tests/*.test.mjs`，604/604 通过（2026-08-08）。
- 语法与空白检查：`node --check src/app.mjs`、`node --check src/legacy-app.mjs` 与 `git diff --check` 通过（2026-08-08）。
- 生产资源回读：`node scripts/verify-release-readback.mjs --version 2.7.2 --base https://xz1220z-afk.github.io/zos-workbench/`，`index.html`、`manifest.json`、`sw.js` 和 `src/app.mjs` 均为 HTTP 200 且版本为 `2.7.2`（2026-08-08）。
- 页面交互回读：组件和应用层验证“查询历史”在无历史数据时显示“已应用查询…暂无已校验历史数据”，且不伪造图表或排行（2026-08-08）。浏览器登录态由本人控制，生产页的最终视觉点击回读保留为打开链接后的手动确认项。

## 数据保护

- 不修改 Vault、飞书、Supabase 数据库结构、现有路由或用户数据集合。
- 不把历史缺失解释为业绩为 0，也不使用旧林客快照填充今日指标。

## 回滚

上线代码提交：`6db35f7`；发布标签指向包含本验收记录的提交。若需回退，以 `zos-workbench-v2.7.1` 为代码基线，新建回滚提交、提高缓存版本、重新回归和生产资源回读；用户数据保持原位。
