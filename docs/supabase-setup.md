# ZOS 云端同步：一次性初始化

目标：让同一位 ZOS 使用者在 Mac、Windows、iPhone 和 Android 之间同步工作台数据；不接入飞书、不接入 Obsidian，也不开放团队账号。

## 安全边界

- `zos_records` 的每一条记录都绑定 Supabase 登录用户。
- 行级安全（RLS）已开启：登录用户只能读取、写入、更新或删除自己的记录。
- 删除采用 tombstone（`deleted_at`），因此旧设备不会把已删除的数据重新同步回来。
- 前端永远不使用 `service_role` 密钥、数据库密码或管理令牌。

## 在 Supabase 中执行

1. 打开项目 **zos-workbench**，进入 **SQL Editor**。
2. 新建查询，将 [`001_zos_sync.sql`](../supabase/migrations/001_zos_sync.sql) 的全部内容粘贴进去。
3. 点击 **Run**。
4. 在 **Table Editor** 中确认已出现 `zos_records`；此时表应为空。
5. 进入 **Authentication → Email Templates**，确认邮箱验证码模板包含 `{{ .Token }}`。不要把数据库密码或 `service_role` 密钥填到网页里。

## 执行后如何核验

在 SQL Editor 执行下面这段只读查询：

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'zos_records';

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'zos_records'
order by policyname;
```

应看到：

- `zos_records` 的 `rowsecurity` 为 `true`；
- 4 条 owner policy：`SELECT`、`INSERT`、`UPDATE`、`DELETE`。

完成这一步后，下一次本地版本会接入邮箱验证码登录、首次上传与跨设备拉取；在真实数据上传前先用一条测试收集箱记录验收。
