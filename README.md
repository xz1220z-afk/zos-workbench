# 朱帅工作台（ZOS Workbench）

ZOS 是朱帅个人使用的跨端工作台，当前以静态 PWA 形式发布，数据默认保存在当前设备；完成 Supabase 邮箱登录并点击同步后，才会同步到个人 Supabase 项目。

## 正式入口

- 工作台：[https://xz1220z-afk.github.io/zos-workbench/](https://xz1220z-afk.github.io/zos-workbench/)
- GitHub 仓库：[https://github.com/xz1220z-afk/zos-workbench](https://github.com/xz1220z-afk/zos-workbench)

注意：`https://xz1220z-afk.github.io/` 是用户主页根域名，目前没有配置 Pages，因此会显示 404。日常只使用上面的 `/zos-workbench/` 地址。

## 当前能力（v1.0.8）

- 仪表盘、今日视图、收集箱、任务、项目和 AI 指令队列
- localStorage 本地持久化
- JSON 数据导出、校验、覆盖导入和清除
- PWA 安装：Mac/Windows Edge 或 Chrome、iPhone Safari、Android Chrome
- Supabase 私有云同步：邮箱魔术链接登录，记录按用户隔离，手动同步
- GitHub Pages 自动发布；Service Worker 缓存版本随发布递增

## 日常使用规则

1. 打开正式入口，不要打开根域名。
2. 新设备先导入最近的 JSON 备份，或完成 Supabase 登录后点击“立即同步”。
3. 重要改动前先导出备份；导入会覆盖当前设备本地数据。
4. 只填写 Supabase Project URL 和 Publishable/anon key。绝不填写数据库密码、OTP、service_role key 或其他管理令牌。
5. 云端同步不是自动后台同步，只有点击“立即同步”才会上传或拉取。

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

数据库迁移文件位于 [`supabase/migrations/001_zos_sync.sql`](supabase/migrations/001_zos_sync.sql)，配置步骤见 [`docs/supabase-setup.md`](docs/supabase-setup.md)。

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
