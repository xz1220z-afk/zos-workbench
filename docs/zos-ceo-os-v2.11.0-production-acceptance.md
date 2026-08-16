# ZOS CEO OS v2.11.0 生产验收

验收日期：待生产发布后回填  
状态：生产发布中；OpenAI 服务端配置待补齐

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
- 正式站 HTTP、四尺寸排版、真实老板登录、快捷语音与实时语音证据仍待发布后回填。

## 回滚

以 `zos-workbench-v2.10.0-pre-owner-auth` 为代码恢复点，使用新的 PWA 缓存世代重发；函数与实时订阅按发布记录中的分层回滚方式处理，不删除用户或业务数据。
