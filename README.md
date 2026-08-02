# 朱帅工作台（ZOS Workbench）

ZOS 是朱帅个人使用的 CEO OS，当前以深色 PWA 形式发布。它把工作与生活双首页、今日行动、待我决策、经营目标、万嘉网络、花火影像、玲丽教育、日历、情报、关系、复盘和企业大脑放在同一个四端工作台中。

## 正式入口

- 工作台：[https://xz1220z-afk.github.io/zos-workbench/](https://xz1220z-afk.github.io/zos-workbench/)
- GitHub 仓库：[https://github.com/xz1220z-afk/zos-workbench](https://github.com/xz1220z-afk/zos-workbench)

注意：`https://xz1220z-afk.github.io/` 是用户主页根域名，目前没有配置 Pages，因此会显示 404。日常只使用上面的 `/zos-workbench/` 地址。

## 当前能力（v1.5.0）

- CEO 指挥中心与独立 Life OS；工作端只显示私人日程的忙碌占位
- 今日行动、待我决策、经营目标、数据健康和每日 CEO 简报
- 日/周/月日历、冲突检测、私有生活事项、关系聚合、周/月复盘草稿和跨域全局搜索
- 独立情报中心：飞书候选池只读拉取到 Supabase 私有摘要缓存，人工标记已读或转为行动
- 万嘉 / 花火真实飞书事实只读聚合；玲丽教育保留真实空态，未接入前不显示虚构指标
- 企业大脑仅同步 Obsidian 元数据，不上传正文
- localStorage 本地持久化与自动四端同步；关键决策和目标并发修改必须人工解冲突
- JSON 数据导出、校验、覆盖导入和清除
- PWA 安装：Mac/Windows Edge 或 Chrome、iPhone Safari、Android Chrome
- Supabase 私有云同步：邮箱或密码登录，记录按用户隔离；联网、回到前台和本地改动后自动同步
- 自动更新：登录后一次刷新万嘉、花火、企业项目和情报；工作台在前台且联网时每 15 分钟检查，回到前台或恢复网络会自动补刷新
- 云端企业缓存：Supabase 每 15 分钟以只读方式刷新已配置的飞书来源，即使不逐页打开公司页面也能获得新缓存
- 飞书受控写入：先生成精确预览，逐条人工确认，再执行一次并回读验证；不允许批量静默写入
- 脱敏运行监控：只记录安全错误码、耗时、条数和版本，不保存业务正文、客户信息或凭证
- GitHub Pages 自动发布；Service Worker 缓存版本随发布递增

## 日常使用规则

1. 打开正式入口，不要打开根域名。
2. 新设备完成 Supabase 登录后等待前台同步；首次使用仍建议先保留最近的 JSON 备份。
3. 重要改动前先导出备份；导入会覆盖当前设备本地数据。
4. 只填写 Supabase Project URL 和 Publishable/anon key。绝不填写数据库密码、OTP、service_role key 或其他管理令牌。
5. 私人任务、日历与生活数据的设备同步只在工作台打开且网络可用时运行；万嘉、花火与企业项目的只读缓存由云端每 15 分钟更新。
6. 情报中心已连接飞书 `08.07｜ZOS 情报候选池`，由云端每 15 分钟只读同步到本人 Supabase 私有摘要缓存；若配置失效会明确显示异常，不会用公司业务表冒充行业情报。

## 发布与回归验证

每次推送到 `main` 或提交 Pull Request 时，GitHub Actions 会自动运行完整回归测试、内嵌 JavaScript 语法检查和空白字符检查。状态见仓库的 **Actions** 页面。

另外，每天北京时间 09:17 会运行一次线上健康检查；也可以在 **Actions → ZOS Workbench Healthcheck → Run workflow** 手动执行。健康检查会验证主页、manifest、Service Worker 和线上版本标记。

在仓库目录执行：

```bash
node --test tests/data-model.test.mjs tests/pwa-baseline.test.mjs \
  tests/supabase-migration.test.mjs tests/sync-engine.test.mjs \
  tests/supabase-transport.test.mjs tests/supabase-auth.test.mjs
git diff --check
```

发布前还要确认：

```bash
curl -fsSI https://xz1220z-afk.github.io/zos-workbench/
curl -fsSI https://xz1220z-afk.github.io/zos-workbench/manifest.webmanifest
curl -fsSI https://xz1220z-afk.github.io/zos-workbench/sw.js
```

三项都应返回 `HTTP/2 200`。更新版本时同时修改 `APP_VERSION`、`sw.js` 的 `CACHE_NAME`、CHANGELOG 和 PWA 基线测试。

## Supabase 配置

数据库迁移文件位于 `supabase/migrations/`；v1.5 在 v1.4 双首页与情报系统上增加前台统一刷新和云端只读定时缓存。配置步骤见 [`docs/supabase-setup.md`](docs/supabase-setup.md)，实现与回滚步骤见 [`docs/superpowers/plans/2026-08-02-automatic-sync-implementation.md`](docs/superpowers/plans/2026-08-02-automatic-sync-implementation.md)。

邮箱登录链接必须回调到：

```text
https://xz1220z-afk.github.io/zos-workbench/
```

如果邮件跳转到根域名并出现 404，不要使用旧链接；重新打开正式入口并重新发送登录邮件。

## 安全与故障处理

- 截图、聊天或日志中出现访问令牌时，视为已暴露；不要转发或继续使用该链接，必要时在 Supabase 撤销会话后重新登录。
- 不在仓库、前端、日志或 Vault 中保存密码、OTP、service_role key 或数据库密钥。
- 同步异常时先导出本地 JSON，再检查 Supabase 配置和登录状态；不要直接清除本地数据。
- 需要回退时使用 Git 回退到上一个已验证提交，并重新核验 Pages、manifest 和 Service Worker。

## 版本记录

详细变更见 [`CHANGELOG.md`](CHANGELOG.md)。
