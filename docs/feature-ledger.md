# ZOS 功能账本

本账本是发布前的固定回读入口。新增功能只能追加记录，不删除旧记录；事实、设计意图和未完成边界必须分开写。

## v2.10.0（发布候选）

### 手机端 AI 办公体验

- **入口与范围**：手机端保留工作首页、任务、日历、情报和更多导航；底部主入口为首页、语音、Agent、日历、更多，桌面左侧导航及既有路由保持可用。
- **实现模块**：`src/app/mobile-navigation.mjs`、`src/app/mobile-dashboard.mjs`、`src/app/mobile-agent-directory.mjs`、`src/app/views/mobile-command-sheet.mjs`，以及既有 `src/app.mjs`、`src/legacy-app.mjs`、`assets/app.css` 与版本化 PWA 入口。
- **AI 与 Agent**：中央语音/键盘指令复用既有指令状态；浏览器拒绝或不支持语音时保留键盘文字。Agent 目录按组织→部门→Agent 呈现，私密关系 Agent 保持个人分支和既有权限边界。
- **受控执行边界**：L0 只读导航可直达；L1 仅本机可撤销草稿；L2 飞书写入、消息、发布、外部日历、删除、付款等只显示精确影响、测试与回滚预览，仍等待明确确认，不执行外部写入。
- **数据与隐私**：不迁移、不覆盖任务、日历、决策、Agent 上下文、业务只读数据或用户记录；不持续监听、不后台录音、不保存原始音频。
- **PWA 版本**：缓存和浏览器模块查询参数统一为 `2.10.0`；Task 1–4 的新增静态模块均进入 `ASSETS_TO_CACHE`，Task 5–6 未新增静态模块。
- **自动化证据**：三轮完整自动化与本地静态检查结果见 `docs/releases/zos-ceo-os-v2.10.0.md`；正式站和四尺寸真机/浏览器验收仍以生产验收记录为准。
- **回滚**：本候选的代码恢复点为本地 tag `zos-workbench-v2.9.0-mobile-preflight`（指向 `87c784a`）。正式发布若失败，基于该代码恢复点提高 PWA 缓存世代后重发；不删除、不迁移、不回滚用户或经营数据。

## v2.9.0（正式候选）

### AI 优先首页与 C 级受控执行

- **入口**：既有工作首页第一屏；保留原经营总览、公司页面、Agent OS、日历和情报入口。
- **目标**：把“找页面、翻资料”改为“输入或说出任务，由系统路由到当前事实源与长期知识”；不以 AI 回答覆盖飞书 ERP、合同、平台后台或项目源文件。
- **实现文件**：`src/app/ai-command-center.mjs`、`src/app/intent-router.mjs`、`src/app/controlled-execution.mjs`、`src/app/voice-input.mjs`、`src/app/views/ai-command-view.mjs`、`src/app.mjs`、`assets/app.css` 与版本化 PWA 入口。
- **执行边界**：L0 只读导航直接执行；L1 本机草稿执行后可撤销；L2 飞书写入、消息、发布、外部日历、删除、付款等只显示精确变更、影响、测试和回滚预览，没有安全执行器时不能确认。
- **语音边界**：只在本人点击或按住麦克风时请求浏览器语音识别；不持续监听、不后台录音、不保存音频。浏览器不支持或拒绝权限时，键盘输入仍可用。
- **知识与隐私**：回答可按需引用既有知识入口；安全活动记录不保存完整语音文本、AI 回答或原始资料正文。
- **第二阶段**：原生 iOS、后台唤醒词、锁屏常驻与无需用户手势的监听均未实施。
- **回滚**：回到标签 `zos-workbench-v2.8.4`，提高 PWA 缓存版本后重新发布；不删除、不迁移任何用户或经营数据。

## v2.8.4（正式候选）

- **目标**：为已完成的万嘉局部面板、当前页按需模型和模型缓存分配唯一最终缓存世代。
- **功能差异**：与 2.8.3 相同；只提升 PWA 资源版本，避免同名中间缓存。
- **测试**：25/25 定向回归、619/619 全量自动化通过。
- **回滚**：回到 `zos-workbench-v2.8.1` 后提高缓存版本发布；用户数据无须回滚。

## v2.8.3（候选）

### 万嘉局部面板与按需模型

- **入口**：万嘉网络 `#local-life` 四个运营语境，以及设置/隐私等旧页面。
- **目标**：万嘉语境切换只更新内容面板；当前页只构建当前业务所需数据模型。
- **实现文件**：`src/app.mjs`、`src/app/views/wanjia-ops-view.mjs`、`tests/app-composition.test.mjs`。
- **数据边界**：不改变页面导航、用户数据结构、飞书、Supabase 或历史快照。
- **测试**：25/25 定向回归、619/619 全量自动化通过；覆盖局部面板更新与模型复用。
- **回滚**：回到 `zos-workbench-v2.8.2` 或 `zos-workbench-v2.8.1` 后提升缓存版本重新发布；用户数据无须回滚。

## v2.8.2（候选）

### 当前页增量渲染

- **入口**：全工作台页面切换与当前页面内交互；重点验收万嘉网络 `#local-life` 四个运营语境。
- **目标**：当前按钮操作只刷新正在查看的页面，消除无关页面同步重绘造成的闪动、卡顿和触感迟缓。
- **实现文件**：`src/app.mjs`、`tests/app-composition.test.mjs`、PWA 版本化入口与发布记录。
- **数据边界**：不改变或迁移任务、收集箱、日历、决策、Agent 上下文、万嘉历史数据和飞书/Supabase 数据；只改变视图渲染调度。
- **测试**：回归测试证明 `#local-life` 渲染不会写入工作首页、生活首页或日历的隐藏 DOM；进入其他页面时仍由既有导航调用即时渲染。
- **回滚**：回到 `zos-workbench-v2.8.1` 标签并提升 PWA 缓存版本重新发布；不回滚、不删除任何用户或经营数据。

## v2.8.1（候选）

### 万嘉历史完整读取与 Agent 调用回读

- **入口**：万嘉网络 `#local-life` → 数据分析；Agent OS → Agent 详情 → 派任务/直接分析。
- **目标**：完整读取本人已校验的万嘉历史快照，消除 1000 行静默截断与无当日快照显示 ¥0 的误导；同时确认 Agent 身份、规则和上下文能进入既有任务入口。
- **实现文件**：`supabase/functions/zos-business-data/index.ts`、`supabase/functions/_shared/wanjia-history.mjs`、`src/app/wanjia-history.mjs`、版本化 PWA 入口和对应测试。
- **数据边界**：接口只在 Supabase 登录态下读取，服务端仍用已认证用户 ID 显式过滤；仅返回白名单字段。不会写飞书、历史数据仓、Vault、商家数据或用户数据。
- **口径**：`daily_increment` 才可累计；`period_snapshot` 只展示单日快照或有完整基线的区间变化。所选结束日无快照、任一商家缺少起点基线时返回 `insufficient_history`，不显示 0 或模拟业绩。
- **Agent 边界**：索引只保存在当前设备；派任务仅生成既有任务草案，带入 Agent 规则、边界、知识入口和输出格式，不自动执行或外发。
- **回滚**：回到 `zos-workbench-v2.8.0` 代码标签并提升缓存版本重新发布；不删除、不回滚历史数据、Agent 原始身份卡或用户记录。

## v2.8.0（候选）

### 万嘉本地生活运营总控台分层

- **入口**：既有万嘉网络页面 `#local-life`。
- **目标**：把老板与运营人员的高频问题分为“今日总控、商家作战、增长复盘、数据分析”，降低单页信息混杂；保留所有既有万嘉工具与来源边界。
- **实现文件**：`src/app/wanjia-ops-navigation.mjs`、`src/app/wanjia-ops-center.mjs`、`src/app/views/wanjia-ops-view.mjs`、`src/app.mjs`、`assets/app.css`、`sw.js` 与版本化 PWA 入口。
- **数据边界**：不写飞书、Supabase、SQLite、商家资料、历史批次或用户数据；默认总控不把历史林客快照作为今日经营事实。`period_snapshot` 的历史查询继续禁止跨日期相加；缺基线继续显示数据积累中/口径限制。
- **测试**：导航纯函数、视图隔离、运行时面板切换、PWA 模块图和版本契约、全量回归、三尺寸交互与正式站资源回读。
- **回滚**：回到 `zos-workbench-v2.7.4` 代码标签，提升 PWA 缓存版本并重新部署；不清理、不迁移、不改写用户或经营数据。

## v2.7.4（候选）

### 设置页同步配额保护

- **入口**：设置 → 私有云同步（Supabase）→ 立即同步。
- **目标**：已登录时统一走现有 CEO OS 同步控制器，避免旧页面再向 `zos_inbox` 写入第二份完整集合而触发浏览器配额错误。
- **实现文件**：`src/app/settings-sync-bridge.mjs`、`src/app.mjs`、`sw.js` 与版本化 PWA 入口。
- **数据边界**：不删除、不清空、不压缩用户任务、收集箱、项目、日历、决策或云端记录；未登录时继续走旧登录入口。业务只读缓存和万嘉历史数据口径不变。
- **测试**：已登录桥接不触发遗留写入、未登录可回退登录、PWA 完整模块图、版本契约、状态恢复回归。
- **回滚**：回到 `zos-workbench-v2.7.3` 代码标签并提升缓存版本后重新部署；不对用户数据或历史数据仓做任何回滚写入。

## v2.7.3（候选）

### 万嘉受保护历史快照读取

- **入口**：万嘉网络 `#local-life` 的既有“时间范围查询与历史经营分析”。
- **目标**：仅向已登录用户展示 2026-08-07 至 2026-08-08 的已验证历史快照，并让现有时间筛选、快照趋势和商家明细真正基于历史信封工作。
- **实现文件**：`src/business-data-client.mjs`、`src/app/browser-runtime.mjs`、`src/app/wanjia-history.mjs`、`src/app/views/wanjia-ops-view.mjs`、`supabase/functions/zos-business-data/index.ts`、`supabase/functions/_shared/wanjia-history.mjs`、`supabase/migrations/011_wanjia_history_mirror.sql`。
- **数据边界**：仅认证态请求 `source=wanjia&history=1`；只读、按用户 RLS 隔离。适配器只返回允许字段，不返回原始文件、哈希、raw JSON、密钥或凭证。不会写飞书、Vault、任务、用户数据或历史批次。
- **口径**：`period_snapshot` 仅展示单日快照趋势，绝不跨日相加；区间变化为结束日期快照减开始日前最近快照。无起点即 `insufficient_history`，不显示 0、排行或模拟业绩。
- **测试**：客户端请求/信封、适配器字段白名单、真实日期边界模型、Edge 函数认证与 RLS 静态约束、完整 PWA 模块图和全量回归。
- **回滚**：回到 `zos-workbench-v2.7.2` 代码标签，提升缓存版本后再部署页面和函数；不删除用户数据或历史数据仓。

## v2.7.2（候选）

### 万嘉历史查询结果反馈

- **入口**：万嘉网络 `#local-life` 的“时间范围查询与历史经营分析”。
- **目标**：让“查询历史”和“恢复今天”每次都有可见、可读的操作结果，不把无数据的重新渲染误解为点击无效。
- **实现文件**：`src/app.mjs`、`src/app/views/wanjia-ops-view.mjs`、`assets/app.css` 与 PWA 入口版本文件。
- **数据边界**：查询仍只过滤当前已加载的只读历史信封；GitHub Pages 不直接访问本机 SQLite。历史数据未到达或未校验时，必须显示“暂无已校验历史数据”，不得显示 0、趋势、排行或模拟业绩。
- **测试**：空历史查询可见反馈、组件渲染、完整 PWA 模块图与全量回归。
- **回滚**：回到 `zos-workbench-v2.7.1` 代码标签并提高缓存版本；不清理用户数据、飞书数据、Vault 或本地 SQLite。

## v2.7.1（候选）

### 可信数据刷新、定位天气与情报交互修复

- **入口**：万嘉网络、待我决策、情报中心、工作和生活首页天气卡。
- **目标**：区分成功读取与本机离线缓存容量；避免不完整来源误归档；使情报卡的阅读状态与追问入口实际可操作；只在本人点击时读取当前位置天气。
- **实现文件**：`src/app/business-data-cache.mjs`、`src/app/decision-center.mjs`、`src/app/operating-loop.mjs`、`src/app/weather-center.mjs`、`src/app.mjs`、决策与情报视图、`sw.js` 与入口版本文件。
- **数据边界**：万嘉仍保持只读；缓存是离线便利副本而非事实源。定位不保存经纬度、地址或轨迹；情报状态仅更新本人本地/私有记录，不外发。来源数据未声明完整覆盖时，既有待决策保持原状。
- **测试**：业务缓存、决策防误归档、天气按需定位、情报状态即时刷新、PWA 版本契约、全量回归与生产资源回读。
- **回滚**：回到 `zos-workbench-v2.7.0` 代码标签后提高缓存版本；不清理或回滚用户任务、日历、决策、情报状态和私有数据。

## v2.6.0（候选）

### 首页动态摘要、单次渲染与万嘉历史范围

- **入口**：工作首页、生活首页、万嘉网络（`#local-life`）。
- **目标**：避免导航和筛选的双重渲染；让首页呈现基于当前事实的简明状态；让万嘉历史查询不混入旧快照。
- **实现文件**：`src/app.mjs`、`src/legacy-app.mjs`、`src/app/homepage-presence.mjs`、`src/app/wanjia-history.mjs`、`src/app/wanjia-ops-center.mjs`、相关视图、`assets/app.css` 与 `sw.js`。
- **数据边界**：历史只接受受保护只读适配器给出的 SQLite 索引。飞书不替代完整历史仓；无历史或口径未知时不显示 0 或趋势。
- **测试**：`homepage-presence`、`wanjia-history`、`wanjia-ops-view`、完整回归和生产资源回读。
- **回滚**：回到 `zos-workbench-v2.5.0` 代码标签并提高缓存版本；用户记录、云端记录和 Vault 内容保持不动。

## v2.4.0（候选）

### Apple 交互层

- **入口**：全局导航、工作首页、按钮与卡片交互。
- **目标**：减少层级噪音，统一 44px 触控目标、按压反馈、页面切换与减少动态效果。
- **实现文件**：`assets/app.css`、`src/legacy-app.mjs`、`src/app/navigation-preferences.mjs`、`src/app/views/dashboard-view.mjs`。
- **保留的数据**：不改变路由 ID、状态集合、飞书接口、Supabase 数据或本机记录。
- **测试**：`apple-interaction-system`、`navigation-preferences`、`dashboard-apple-hierarchy` 及全量回归。
- **回滚**：回到 `zos-workbench-v2.3.1` 的视觉与导航代码；不恢复或删除用户数据。

### 情报卡上下文问答

- **入口**：情报中心每张信息卡的“问这条情报”。
- **目标**：用户可直接追问陌生概念；答案限定为当前卡片与已载入相关情报的事实证据。
- **实现文件**：`src/app/intelligence-explainer.mjs`、`src/app/views/intelligence-view.mjs`、`src/app.mjs`。
- **安全边界**：问题和答案只存在于当前页面运行时，不上传、不写飞书、不冒充外部 AI；证据不足时明确提示需要补充来源或转调研。
- **保留的数据**：不修改原情报卡、人工状态、排序、筛选和已保存记录。
- **测试**：`intelligence-explainer`、`intelligence-question-view`、`intelligence-question-actions`、响应式测试及全量回归。
- **回滚**：移除问答入口和运行时状态即可；情报数据无需迁移。

### 版本备份与回读治理

- **入口**：`docs/release-governance.md` 与 `scripts/verify-release-readback.mjs`。
- **目标**：每版有标签、功能账本、验收记录、变更日志；发布前回读旧功能，发布后回读真实资源。
- **保留的数据**：沿用现有 v2.0.2 本机检查点和安全合并恢复，不把代码标签误当成用户数据备份。
- **回滚**：治理文档为加法变更，不影响运行时。
