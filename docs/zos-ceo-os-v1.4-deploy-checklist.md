# ZOS CEO OS v1.4 生产发布清单

## 发布前

- [x] 完整回归 220/220。
- [x] 1280 / 768 / 390 三档验收。
- [x] 版本、manifest、Service Worker 与文档一致。
- [x] 未提交凭证、OTP、service-role 或飞书 Secret。

## Supabase

- [ ] 关联生产项目 `dtwvyramgbwtlyhmkhkd`。
- [ ] 推送迁移 `005_ceo_os_v1_4.sql`。
- [ ] 部署 `zos-intelligence-data`，保持 `verify_jwt = true`。
- [ ] 核对情报目标 Secret 名是否齐全；只核对名称，不输出值。
- [ ] 回读迁移版本、函数 ACTIVE 状态和未登录 401。

## GitHub Pages

- [ ] 将已验收提交合并到 `main` 并推送。
- [ ] 等待 GitHub Pages 发布完成。
- [ ] 回读主页、manifest、Service Worker、v1.4 版本与新模块文件。

## 回滚

- 前端：回退到发布前 `main` 提交并重新推送。
- Edge Function：重新部署发布前版本。
- 数据库：005 仅扩展实体类型并新增私有表；紧急回滚时先停止新函数，再保留表数据，不执行破坏性删除。
