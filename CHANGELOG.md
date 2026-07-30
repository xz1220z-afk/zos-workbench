# ZOS 跨端 AI 工作台 · 变更日志

---

## v1.1.0 — ZOS AI OS：企业数据驾驶舱 + 项目经理 Agent

**日期**：2026-07-30

**本次更新（接手 Codex 版后首次大版本）**：
- **数据层（只读索引机制）**：新增 `src/project-data.mjs` 项目只读元数据契约（validateProjectIndex / createProjectCacheClient / summarizeProjects），严禁正文字段；新增迁移 `supabase/migrations/003_projects_cache.sql` 将 `zos_business_cache.source` 枚举扩展为 `('wanjia','huahuo','brain','projects')`。
- **项目中心**：在「ZOS 企业大脑」页新增项目中心，展示进行中项目数 / 今日风险 / 项目总数统计，按类型（万嘉商家运营 / 花火拍摄 / 政府项目 / ERP建设）筛选，列表含项目名、类型、状态、负责人、更新时间、风险等级与来源；显式只读徽章；支持「导入本地索引」与登录后「刷新项目」。
- **今日驾驶舱**：首页新增驾驶舱五卡——进行中项目、待处理事项、今日风险、AI 建议、待审核内容，数据来自项目只读索引 + 本地任务/收集箱。
- **项目经理 Agent V1**：新增 `src/project-manager-agent.mjs`，确定性生成《朱帅每日经营简报》（今日重点任务 / 项目延期风险 / 商家跟进提醒 / 待决策事项 / AI 建议）；纯函数、无网络、无密钥；简报进入收集箱「待人工审核」，审核通过仅导出 `.md` 草稿，**绝不**直接修改数据库 / 知识库 / 发送外部消息。
- **扫描器与示例**：新增 `scripts/project-metadata-scan.mjs`（本地、只读、无密钥）与 `samples/projects-source.example.json` 模板，可将结构化导出转换为 `zos_business_cache` 兼容的只读 payload。

**测试**：新增 `tests/project-data.test.mjs`（12 项）、`tests/project-manager-agent.test.mjs`（9 项）；全量 **57/57 通过**；pwa-baseline 同步覆盖 V1.1 功能；内联脚本 `node --check` 通过。

**当前限制**：真实企业数据接入需你执行 003 迁移 + 部署更新后的 Edge Function（已含 `projects` 返回位，待你配置飞书表映射）；AI 简报与驾驶舱在登录/同步前显示空态或本地缓存。

---

## v1.2.0 — 万嘉/花火明细接入 + 风险中心 + 项目经理 Agent V2

**日期**：2026-07-30

**本次更新（经营驾驶舱闭环）**：
- **万嘉网络只读明细**：新增 `src/wanjia-data.mjs`（extractWanjiaRecord / buildWanjiaIndex / validateWanjiaIndex / createWanjiaCacheClient / summarizeWanjiaRecords），字段含商家名称、合作类型、阶段、负责人、更新时间、下一步、风险等级、收入状态（source='wanjia'）；契约严禁正文字段；Edge Function `zos-business-data` 扩展返回 `wanjia.records` 明细（mode 强制 `read_only`）。
- **花火影像只读明细**：新增 `src/huahuo-data.mjs`（extractHuahuoRecord / buildHuahuoIndex / validateHuahuoIndex / createHuahuoCacheClient / summarizeHuahuoRecords），字段含客户、项目、类型、拍摄日期、阶段、交付状态、回款状态、利润状态（source='huahuo'）。
- **风险探测器**：新增 `src/risk-detector.mjs`（daysSince / isStale>7天 / isStuck / hasUnfinished / detectRisks / bucketRisks / riskLevelFromReasons），按 kind（project / wanjia / huahuo）区分完成态，支持 asOf 注入；归一化函数对非规范日期容错回退。
- **项目经理 Agent V2**：`src/project-manager-agent.mjs` 在保留 V1 简报能力基础上，新增 `generateDailyReport(ctx)` → 《朱帅经营日报》（今日重点 / 项目风险 / 需要决策 / 建议动作）+ `reportToMarkdown`；纯函数、无网络、无密钥、`reviewRequired:true`、`disclaimer` 声明不直写事实源。
- **风险中心 · 老板决策页**：原三桶列表改造为决策卡片页——汇总横幅（🔴 需立即处理 / 🟡 需关注 / 🟢 正常）、按风险等级 / 来源排序、卡片含项目名、来源、阶段、负责人、风险原因、建议动作，红黄绿配色；仅读取万嘉/花火/项目只读缓存，绝不回写。
- **经营日报入口**：首页与风险页均提供「生成今日经营日报」按钮；点击读取万嘉/花火/项目缓存 + 风险检测结果 → 生成草稿 → 进入收集箱「AI日报·待审核」，导出 `.md` 后人工确认；绝不自动发送、绝不自动修改业务数据。
- **首页经营驾驶舱**：五卡改为老板关心的 5 件事——当前项目数量、今日风险数量、待跟进事项、待审核 AI 内容、AI 建议；读取万嘉/花火/项目缓存与风险检测汇总。
- **万嘉/花火明细展示**：万嘉页与花火页新增只读明细列表，展示各自核心字段与风险标签，仅在点击「刷新数据」读取后呈现。

**测试**：新增 `tests/wanjia-data.test.mjs`、`tests/huahuo-data.test.mjs`、`tests/risk-detector.test.mjs`、`tests/project-manager-agent-v2.test.mjs`、`tests/data-authenticity.test.mjs`（覆盖空数据 / 异常状态 / 权限只读 / 风险规则 / Agent 输出），全量 **114/114 通过**；`tests/pwa-baseline.test.mjs` 同步覆盖 V1.2（版本号、驾驶舱 ID、风险决策页、日报入口）；内联脚本 `node --check` 通过。

**当前限制**：万嘉/花火真实数据仍需你部署扩展了 `records` 返回的 Edge Function 并配置对应 ERP 只读视图；未登录前明细区与驾驶舱显示空态或本地缓存；AI 日报/简报仅生成草稿，须经收集箱人工审核确认后方可执行。

---

## v1.2.1 — Hotfix：修复花火记录缺失 updatedAt 导致风险假阳性

**日期**：2026-07-31

**本次更新（P1 数据契约修复，无业务功能变更）**：
- **P1 根因**：`huahuo.records` 缺少 `updatedAt` 字段，风险探测器用 `updatedAt` 计算停滞天数时得到 `Infinity`，导致所有花火项目被误判为「超 7 天未更新 / 状态停滞」高风险假阳性。
- **Edge Function `zos-business-data`**：`buildHuahuoRecords` 新增 `updatedAt` 字段，取值优先飞书项目更新时间字段（`最近更新时间` / `更新时间`），若不存在则 fallback 到 `shootingDate`；同时在 huahuo `projectTable` 拉取字段中增补 `最近更新时间` / `更新时间`。保持 `mode:'read_only'`、不回写飞书、不修改权限模型。
- **本地契约 `src/huahuo-data.mjs`**：`extractHuahuoRecord` 同步补齐 `updatedAt`（fallback `shootingDate`），与万嘉契约对齐；`updatedAt` 保持可选（不进入 `REQUIRED_HUAHUO_KEYS`），不破坏既有校验。
- **版本号**：`index.html` `APP_VERSION`、设置页标签、`sw.js` `CACHE_NAME` 统一升至 `1.2.1`；`tests/pwa-baseline.test.mjs` 断言同步。

**测试**：新增 `tests/huahuo-risk.test.mjs`（4 项，覆盖有 updatedAt 正常计算 daysSince / 无 updatedAt 回退 shootingDate / 不产生 Infinity / 不误判全部风险）；与既有回归共同保障；内联脚本 `node --check` 通过。

**当前限制（与 v1.2.0 一致）**：万嘉/花火真实数据仍需你部署上述更新后的 Edge Function 并配置对应 ERP 只读视图；AI 日报/简报仅生成草稿，须经收集箱人工审核确认。

---

## v1.0.15 — 企业大脑只读元数据索引与审核网关

**日期**：2026-07-30

**本次更新**：
- 企业大脑页接入「只读元数据索引」：从 Supabase `zos_business_cache`（source=brain）拉取仅含 path/title/tags/mtime/folder/reviewStatus 的索引；前端强制校验 `mode=read_only` 且禁止出现正文，跨端可浏览笔记目录而不读取或写入知识库正文。
- 新增收集箱草稿统计、按业务域（万嘉 / 花火 / SOP·案例）筛选与标题/标签搜索。
- 新增 Inbox 审核队列 + 发布网关：仅审核通过的草稿可导出为 `.md` 下载到暂存目录，绝不自动写入知识库；审核状态本地留痕。
- 同源已落地 `src/obsidian-metadata-index.mjs` 与本地扫描器 `scripts/obsidian-metadata-scan.mjs`（10/10 测试通过；扫描真实 Vault 产出 1987 条纯元数据、零正文泄漏）。

---

## v1.0.12 — 受保护的只读业务汇总调用

**日期**：2026-07-30

**本次更新**：
- 已登录用户主动点击刷新时，工作台才请求 Supabase Edge Function。
- 浏览器仅缓存万嘉、花火的汇总指标；不保存飞书凭证、商家、客户或订单明细。
- 接口未明确返回 `read_only` 模式时，前端拒绝显示结果。

---

## v1.0.11 — 多源数据接入框架

**日期**：2026-07-30

**本次更新**：
- 万嘉网络、花火影像、ZOS 企业大脑页面新增明确的数据来源、只读状态和刷新入口。
- 万嘉页面预留商家总数、动销商家、支付 GMV；花火页面预留进行中项目、待交付、已收金额。
- 新增本地业务汇总契约与数据源映射文档，明确不接入历史归档、个人账本与敏感财务明细。
- 未配置服务端通道时明确显示“未启用/待部署”，不伪造实时数据；不写入飞书或 Obsidian。

---

## v1.0.7 — 状态真实性修复

**日期**：2026-07-30

**本次修复**：
- 统一正式访问地址为 GitHub Pages，移除设置页中已退役的 Coze 地址。
- 修正版本号、发布日期和 PWA 缓存版本。
- 隐私与数据页改为动态反映 Supabase 状态，并明确飞书、Obsidian 与业务平台尚未直接接入 PWA。
- 移除当前登录链接流程下不可达的验证码输入与验证按钮。
- 明确云端数据只有在用户完成登录并手动点击同步后才上传。

**未改变**：
- 不写入飞书、Obsidian 或 Supabase 业务数据。
- 不提高 Supabase 邮件限流，不配置自定义 SMTP。

**上线链接**：
- https://xz1220z-afk.github.io/zos-workbench/

---

## v1.0 — 基础工作台正式上线

**日期**：2026-07-27

**功能**：
- 六大模块：仪表盘、本地生活运营、花火影像、企业项目、ZOS 企业大脑、设置
- 响应式适配：Mac / Windows 桌面端（可折叠侧边栏）、平板（抽屉式侧边栏）、手机（抽屉 + 底部导航）
- 实时 UTC+8 时钟 + 时段问候语
- 页面切换动画（fade-in）
- 空状态设计：所有数据区不虚构业务数据，显示“待接入数据源”占位

**已知问题**：
- 无

**上线链接**：
- https://599081ff3da645a1b27ded9c6b1ea50c.app.codebuddy.work

**版本目录**：`versions/v1.0/`

---

## v1.0.1 — PWA 手机 App 化

**日期**：2026-07-27

**功能**：
- 完整 PWA 支持：可安装到 iPhone / 安卓主屏幕，以独立 App 全屏运行
- 新增 `manifest.webmanifest`：应用名 `ZOS 跨端 AI 工作台`、短名 `ZOS`、standalone 模式
- 新增应用图标：192×192、512×512、Apple Touch Icon、Maskable Icon
- 新增 `sw.js` Service Worker：缓存应用外壳、离线友好提示、新版本自动检测
- iPhone 适配：Apple Web App Meta 标签、刘海屏安全区（`env(safe-area-inset-*)`）、状态栏透传
- 优化移动端触控：底部导航栏适配 Home Indicator、按钮触控区域不小于 44px
- 禁止页面缩放与横向滚动，键盘弹出时自动隐藏底部导航
- 设置页新增「安装到手机桌面」说明与当前运行模式检测
- 修复花火影像模块描述文字乱码

**已知问题**：
- 首次安装到 iPhone 主屏幕需用户手动通过 Safari 分享菜单操作，无法自动弹出安装提示

**上线链接**：
- https://599081ff3da645a1b27ded9c6b1ea50c.app.codebuddy.work

**版本目录**：`versions/v1.0.1/`

---

## v1.0.2 — 本地工作台实战化

**日期**：2026-07-27

**从"展示原型"升级为"可实际使用的本地工作台"。**

**新增功能**：
- **任务管理**：新建/完成/删除任务，按"全部/进行中/已完成"筛选，支持关联项目。数据持久保存在 localStorage。
- **收集箱**：快速记录想法/备忘，一键转为任务或项目。待处理计数徽章显示在侧边栏。
- **项目管理**：新建/编辑/删除项目，支持四种状态切换（规划中/进行中/已完成/暂停），关联任务可见。无真实数据的项目标注"待确认"。
- **AI 指令队列**：作为待执行指令队列，可添加/标记执行/删除指令，不虚构 AI 已执行结果。标记执行时说明需接入后端。
- **数据隐私页面**：明确列出所有外部服务连接状态（均为"未连接"），声明数据仅保存在浏览器本地 localStorage。
- **数据导入/导出**：设置页支持导出全部数据为 JSON、从 JSON 恢复数据、清除所有本地数据。
- **仪表盘增强**：显示待处理收集数、进行中/已完成任务数、活跃项目数、待执行指令数。

**修改文件**：`index.html`（79KB，新增约 1000 行业务逻辑）

**已知问题**：
- 数据仅保存在当前设备浏览器，换设备或清缓存后数据丢失（可通过导出功能备份）
- AI 指令队列仅为手动标记，未接入后端 AI 执行引擎

**上线链接**：
- https://599081ff3da645a1b27ded9c6b1ea50c.app.codebuddy.work

**版本目录**：`versions/v1.0.2/`

---

## v1.0.3 — 质量与安全收口

**日期**：2026-07-27

**本次升级聚焦质量与安全，未接入任何外部服务或新权限。**

**新增功能**：
- **双链接体系**：新增仅供日常使用的公开链接，与原管理链接分离。设置页标注两者用途。
- **首次使用引导**：新用户可一键创建"收集—任务—项目—AI 指令"示例数据；可随时一键清除示例数据。
- **今日视图**：新增「今日」页面，显示今日到期任务、待处理收集、待执行 AI 指令。无日期任务不自动归入今日。
- **JSON 导入校验**：导入前格式校验、覆盖确认弹窗、错误详情提示；导出文件名含日期（`ZOS_Backup_YYYY-MM-DD.json`）。
- **跨端实测清单**：设置页内置测试清单，区分"已自动验证"和"需人工验证"项。
- **任务日期字段**：新建任务可选截止日期；收集箱转任务默认设为今天。

**修改文件**：`index.html`（107KB）

**已知问题**：
- iPhone Safari 安装到主屏幕仍需手动操作（系统限制）
- Service Worker 缓存可能导致旧版残留，回退后需清除浏览器缓存

**上线链接**：
- 公开使用链接：https://cd7f6022679747ffaa06c78ee25a6c1f.app.codebuddy.work
- 私有管理链接：https://599081ff3da645a1b27ded9c6b1ea50c.app.codebuddy.work

**版本目录**：`versions/v1.0.3/`

---

## v1.0.4 — 毛玻璃拟态风视觉升级

**日期**：2026-07-28

**本次为纯视觉风格升级，功能与数据结构不变，未接入任何外部服务或新权限。**

**视觉改动**：
- **毛玻璃拟态（Glassmorphism）**：所有卡片、面板、弹窗、底部导航改为半透明材质 + `backdrop-filter: blur` 模糊，叠加柔和投影。
- **渐变背景**：页面底层加入紫/蓝/粉三色模糊光斑，深色侧边栏叠加后形成通透质感。
- **细边框**：边框统一改为半透明白色（`rgba(255,255,255,.5)`），强化玻璃边缘高光。
- **圆角加大**：卡片圆角 12px → 16px，小元素 8px → 10px，更柔润。
- **主色微调**：品牌紫 `#4f46e5` → `#6366f1`，按钮/标签底色改为半透明同色系。
- **欢迎卡 / 引导横幅 / Toast / 弹窗** 同步玻璃化，弹窗遮罩改为模糊而非纯黑。
- **输入框 / 选择框**：聚焦时背景提亮、外发光同色系，保持通透。

**组件覆盖**：侧边栏、顶栏、仪表盘欢迎卡、模块卡、统计卡、任务/收集/项目/指令列表、弹窗、Toast、底部导航、今日视图、设置页、隐私页、链接卡、测试清单、引导横幅。

**修改文件**：`index.html`（105KB）

**已知问题**：
- 部分低端安卓机型 backdrop-filter 支持有限，可能降级为半透明实色（不影响功能）
- 用户如需更强对比，可在后续版本增加"高对比模式"

**上线链接**：
- 公开使用链接：https://cd7f6022679747ffaa06c78ee25a6c1f.app.codebuddy.work
- 私有管理链接：https://599081ff3da645a1b27ded9c6b1ea50c.app.codebuddy.work

**版本目录**：`versions/v1.0.4/`

---
## v1.0.8 — 修复 Supabase 邮箱登录回调路径

**日期**：2026-07-30

- 邮箱登录链接固定回调到 `https://xz1220z-afk.github.io/zos-workbench/`。
- 修复从登录邮件跳转 GitHub Pages 根域名导致 404 的问题。
- Service Worker 缓存升级为 v1.0.8，避免旧版本继续生成错误回调。

---
## v1.0.9 — 同步前自动续期登录会话

**日期**：2026-07-30

- 同步前使用已保存的 refresh token 续期 Supabase 会话。
- 续期成功后保存新的 access token 和 refresh token，减少日常重新登录。
- 续期失败仍保留安全错误提示，不绕过邮箱认证。
- Service Worker 缓存升级为 v1.0.9。

---
## v1.0.10 — 统一万嘉网络品牌名称

**日期**：2026-07-30

- 将工作台中的“本地生活运营”统一改为“万嘉网络”。
- 同步更新导航、业务模块、设置页、PWA 描述和示例数据。

---
