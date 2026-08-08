# ZOS CEO OS v2.6.1 生产验收

日期：2026-08-08
发布前回滚标签：`zos-workbench-v2.6.0`

## 范围

- 浏览器本机只读业务缓存的配额安全降级。
- 万嘉、花火和企业大脑刷新时，缓存失败与真实数据读取失败的状态隔离。
- 全量 PWA 资源版本更新与缓存失效控制。

## 三轮验收结果

### 1. 配额故障模拟

- 新增 `tests/business-data-cache.test.mjs`：`3/3` 通过。
- 完整缓存超过受限存储配额时，当前页面仍保留最新完整读取结果，并仅保存精简只读副本。
- 连精简副本也无法保存时，刷新不会被改判为数据源失败；页面只显示本机缓存提示。
- 兼容旧页面的缓存写入已全部经过安全缓存层。

### 2. 自动回归与语法检查

- `node --check src/legacy-app.mjs`、`src/app.mjs`、`src/app/business-data-cache.mjs`：通过。
- `git diff --check`：通过。
- `node --test tests/*.test.mjs`：`590/590` 通过，失败 `0`。

### 3. 浏览器与正式站回读

- 本地浏览器进入万嘉 `#local-life`：正文非空、无页面级错误，控制台 error `0`。
- 未接通实时数据时，页面显示“待同步 / 历史数据积累中”，未把缺失历史误写为 0。
- 正式站入口、`manifest.json`、`sw.js`、`src/legacy-app.mjs` 已回读为 `2.6.1`，并确认新版脚本引用 `business-data-cache.mjs`。

## 用户数据保护结论

- 未清空 `localStorage`，未删除本机任务、日历、Agent、知识索引或浏览器备份。
- 未写飞书、Supabase、Vault、SQLite 历史仓，也没有触发自动外发或派单。
- 旧缓存即使很大，也会在下一次刷新时尝试安全降级；无法降级只影响跨刷新缓存，不影响该次已成功读取并展示的数据。

## 回滚

如需回滚，仅以 `zos-workbench-v2.6.0` 创建新的代码恢复提交，并用新的 Service Worker 缓存版本重新发布。保留浏览器本机数据、飞书记录、Supabase 数据、Vault 文件和 SQLite 数据仓。
