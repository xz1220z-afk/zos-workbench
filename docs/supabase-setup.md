# ZOS 云端同步：一次性初始化

目标：让同一位 ZOS 使用者在 Mac、Windows、iPhone 和 Android 之间同步工作台数据，并由服务端以只读方式聚合已授权的飞书经营事实与可选外部日历；不开放团队账号。

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

## v1.6 服务端来源配置

以下值只能放在 Supabase Edge Function Secrets，不能写入网页设置、localStorage 或提交到仓库：

- `FEISHU_APP_ID` / `FEISHU_APP_SECRET`：已发布且具备多维表格只读权限的飞书企业自建应用。
- `LINGLI_APP_TOKEN`：玲丽教育正式 Base 的 app token；函数会按正式表名动态解析 table ID。
- `EXTERNAL_CALENDAR_ICS_URL`：可选的只读 ICS 订阅地址；未配置时日历中心返回 `pending_configuration`。
- `ZOS_CRON_SECRET` / `ZOS_OWNER_USER_ID`：内部定时刷新鉴权与本人 Supabase user id。

设置后部署：

```bash
npx --yes supabase@latest functions deploy zos-business-data --project-ref <PROJECT_REF>
npx --yes supabase@latest functions deploy zos-business-refresh --project-ref <PROJECT_REF>
npx --yes supabase@latest functions deploy zos-calendar-data --project-ref <PROJECT_REF>
```

真实飞书读取权限需同时满足“开放平台 API 权限已发布”和“目标 Base 已把应用加入协作者”。个人浏览器能打开表格不等于服务端应用具备 API 权限。
