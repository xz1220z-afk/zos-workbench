# ZOS CEO OS v2.11.0 生产验收

验收日期：2026-08-16
状态：核心版本已上线；登录后 AI/语音生产验收因 OpenAI 服务端配置缺失而暂缓

## 必须通过的生产闸门

- 正式 `index.html`、`manifest.json`、`sw.js` 与代表性浏览器模块均为 `2.11.0` 且 HTTP 200。
- 四端均先显示独立登录页；未授权不能通过 hash 路由看到业务正文。
- 老板账号可恢复会话，非老板被拒绝；工作台未保存明文密码。
- 所有离线启动均停留在登录页，必须联网重新核验；不提供可能产生本机写入的“离线只读”解锁模式。
- 实时变化只触发既有同步拉取与合并；跨标签、本机离线与重新联网不丢数据。
- 快捷语音和 ChatGPT 实时语音均可由本人手势启动，停止/退出/切后台后麦克风轨道释放。
- 高影响动作继续停留在预览与明确确认，不自动写飞书、外发、发布、删除或付款。
- 桌面、平板、iPhone 和 Android 宽度正文非空、无横向溢出、控制台 error 为 0。

## 证据

- 修复后三轮全量测试：`771/771`、`771/771`、`771/771`。
- 最终安全扫描：72 个变更文件完成复核，0 个未解决报告项。
- Supabase 数据库：`zos_records` 的 RLS、完整 replica identity 与 Realtime publication 已回读验证。
- Supabase Functions：`zos-auth-session` v1、`zos-business-data` v41、审批 preview/execute v13、`zos-ai-assistant` v2、`zos-ai-realtime-session` v1 均为 `ACTIVE` 且 `verify_jwt=true`；匿名探测全部为 HTTP 401。
- 阻塞项：生产 Secrets 中存在 `ZOS_OWNER_USER_ID`，但不存在 `OPENAI_API_KEY`。因此不得把 ChatGPT 回答和实时语音宣称为已验收可用。
- GitHub Pages：[`pages build and deployment #31945927432`](https://github.com/xz1220z-afk/zos-workbench/actions/runs/31945927432) 成功，对应提交 `ef9445d`；[`ZOS Workbench CI #31945927840`](https://github.com/xz1220z-afk/zos-workbench/actions/runs/31945927840) 同步通过。
- 正式站 HTTP：`index.html`、`manifest.json`、`sw.js`、`src/legacy-app.mjs`、认证、Realtime 与语音代表模块均返回 200；入口、manifest 与 Service Worker 缓存版本均回读为 `2.11.0`。
- 四尺寸未登录首屏：桌面 `1440×900`、iPad `834×1194`、iPhone `390×844`、Android `412×915` 均显示独立登录页，业务工作区保持 `inert`，正文非空，页面宽度与 viewport 一致，控制台 error 为 `0`。
- 待验收：真实老板登录/会话恢复、快捷语音、ChatGPT 回答与实时语音。原因仅为生产 Secrets 缺少 `OPENAI_API_KEY`；不使用模拟密钥或浏览器端密钥绕过。

## 回滚

以 `zos-workbench-v2.10.0-pre-owner-auth` 为代码恢复点，使用新的 PWA 缓存世代重发；函数与实时订阅按发布记录中的分层回滚方式处理，不删除用户或业务数据。
