import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [shellHtml, legacySource, appSource, appCss, serviceWorker, manifest] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/legacy-app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../assets/app.css', import.meta.url), 'utf8'),
  readFile(new URL('../sw.js', import.meta.url), 'utf8'),
  readFile(new URL('../manifest.json', import.meta.url), 'utf8').then(JSON.parse),
]);
const indexHtml = `${shellHtml}\n${legacySource}\n${appCss}`;

assert.match(serviceWorker, /const CACHE_NAME = 'zos-workbench-v2\.7\.1';/,
  'A command-center UI release must receive a new Service Worker cache revision');
assert.match(serviceWorker, /fetch\(assetUrl, \{ cache: 'reload' \}\)/,
  'A new Service Worker must bypass the browser HTTP cache while building its release cache');
assert.match(shellHtml, /src\/app\.mjs\?v=2\.7\.1/,
  'The application bootstrap must bypass a stale controlling Service Worker cache');
assert.match(shellHtml, /assets\/app\.css\?v=2\.7\.1/,
  'The visual system must bypass a stale browser and Service Worker cache');
assert.match(shellHtml, /rel="manifest" href="manifest\.json"/,
  'The hosted manifest must use a portable JSON MIME type');
assert.match(serviceWorker, /manifest\.json/,
  'The portable hosted manifest must remain available offline');
assert.match(appSource, /\.\/app\/state-store\.mjs\?v=2\.7\.1/,
  'The startup-critical state module must bypass a stale controlling Service Worker cache');
assert.match(legacySource, /\.\/app\/router\.mjs\?v=2\.7\.1/,
  'The startup-critical deep-link router must bypass a stale controlling Service Worker cache');
for (const asset of [
  'assets/app.css', 'src/app.mjs', 'src/legacy-app.mjs', 'src/app/operating-loop.mjs',
  'src/app/decision-center.mjs', 'src/app/targets.mjs', 'src/app/source-health.mjs',
  'src/app/daily-brief.mjs', 'src/app/sync-controller.mjs', 'src/app/feishu-approvals.mjs',
  'src/app/monitoring.mjs', 'src/app/router.mjs', 'src/app/views/dashboard-view.mjs',
  'src/app/value-utils.mjs', 'src/app/calendar-range.mjs', 'src/app/calendar-event.mjs',
  'src/app/calendar-recurrence.mjs',
  'src/app/calendar-selection.mjs', 'src/app/important-dates.mjs',
  'src/app/daily-digest.mjs', 'src/app/push-notifications.mjs',
  'src/app/reliability-center.mjs',
]) assert.match(serviceWorker, new RegExp(asset.replaceAll('.', '\\.') ), `${asset} must be available offline`);
assert.equal(manifest.background_color, '#07101d');
assert.equal(manifest.theme_color, '#0b1626');
assert.match(manifest.description, /CEO OS/);
assert.match(indexHtml, /万嘉网络/,
  'Current UI must expose the 万嘉网络 brand name');
assert.match(indexHtml, /本地生活运营总控/,
  'The 万嘉 page must expose its local-life operating purpose without replacing the brand');
assert.match(indexHtml, /refreshSession\(session\.refreshToken\)/,
  'Sync must refresh an existing Supabase session before pulling data');
assert.match(indexHtml, /const PUBLIC_APP_URL = new URL\('\.', window\.location\.href\)\.href/,
  'The auth callback must follow the current stable host while staying on the app directory');
assert.match(indexHtml, /const APP_VERSION = '2\.7\.1'/,
  'The inline application version must match the current release');
assert.match(indexHtml, /工作台版本<\/div>[\s\S]{0,120}v2\.7\.1/,
  'The settings page version label must match the current release');
assert.doesNotMatch(legacySource, /controllerchange[\s\S]{0,180}window\.location\.reload\(\)/,
  'Service Worker updates must not force a second page load');
assert.match(indexHtml, /requestOtp\(email, PUBLIC_APP_URL\)/,
  'Magic-link requests must redirect to the public app subpath');
assert.doesNotMatch(indexHtml, /const PUBLIC_APP_URL = 'https:\/\/xz1220z-afk\.github\.io\/zos-workbench\/'/,
  'Magic-link callbacks must not be locked to one hosting provider');
assert.doesNotMatch(indexHtml, /n8p3xbsbky\.coze\.site/i,
  'Current UI must not expose the retired Coze address');
assert.doesNotMatch(indexHtml, /当前版本（v1\.0\.2）为纯本地工作台/i,
  'Current UI must not claim the old v1.0.2 local-only release');
assert.doesNotMatch(indexHtml, /工作台版本[\s\S]{0,80}v1\.0\.4/i,
  'Current UI must not expose the old v1.0.4 release label');
assert.doesNotMatch(indexHtml, /<label>邮箱验证码<\/label>/i,
  'Current UI must not expose a code input when the configured mail flow is a magic link');
assert.doesNotMatch(indexHtml, /code\.coze\.cn\/api\/coding\/deployment\/analytics/i,
  'Local takeover must not report page views to Coze analytics');
assert.doesNotMatch(indexHtml, /apm\.volccdn\.com\/mars-web\/apmplus/i,
  'Local takeover must not load Coze performance monitoring');
assert.doesNotMatch(indexHtml, /跨端同步已就绪/,
  'The interface must not claim cross-device sync before authentication and cloud sync are connected');
assert.match(indexHtml, /id="wanjiaDataStatus"/,
  '万嘉页面必须有真实数据源状态位，不能只保留空白占位');
assert.match(indexHtml, /id="huahuoDataStatus"/,
  '花火页面必须有真实数据源状态位，不能只保留空白占位');
assert.match(indexHtml, /id="brainDataStatus"/,
  '企业大脑页面必须有真实数据源状态位，不能只保留空白占位');
assert.match(indexHtml, /id="brainIndexFile"/,
  '企业大脑页面必须提供本机元数据索引文件选择器');
assert.match(indexHtml, /async function uploadBrainIndexFile\(/,
  'PWA 必须通过受保护端点上传所选元数据索引');
assert.match(indexHtml, /'\/functions\/v1\/zos-brain-index'/,
  'PWA 不得直接写缓存表，必须调用专用索引端点');
assert.match(indexHtml, /function renderBusinessDataStates\(\)/,
  '页面必须根据实际连接状态渲染业务数据源');
assert.match(indexHtml, /fetchBusinessData\(\{[\s\S]{0,260}accessToken/,
  '登录用户点击刷新时必须调用受保护的只读汇总接口');

// ===== V1.1 — 项目中心 / 驾驶舱 / 项目经理 Agent =====
assert.match(indexHtml, /id="projectDataStatus"/,
  '项目中心必须有真实数据源状态位');
assert.match(indexHtml, /refreshBusinessData\('projects'\)/,
  '项目中心必须提供只读索引刷新入口');
assert.match(indexHtml, /window\.importProjectIndexFile = function/,
  '项目中心必须支持本地只读索引导入（开发/离线预览）');
assert.match(indexHtml, /id="projectList"/,
  '项目中心必须渲染项目列表');
assert.match(indexHtml, /id="cockpitProjects"/,
  '首页驾驶舱必须展示当前项目数量');
assert.match(indexHtml, /id="cockpitRisk"/,
  '首页驾驶舱必须展示今日风险数量');
assert.match(indexHtml, /id="cockpitFollow"/,
  '首页驾驶舱必须展示待跟进事项');
assert.match(indexHtml, /id="cockpitReview"/,
  '首页驾驶舱必须展示待审核AI内容');
assert.match(indexHtml, /id="cockpitAdvice"/,
  '首页驾驶舱必须展示AI建议');
assert.match(indexHtml, /window\.generateProjectBrief = function/,
  '必须提供项目经理 Agent 简报生成入口');
assert.match(indexHtml, /window\.exportBriefDraft = function/,
  '简报草稿必须经人工审核后导出，不可自动落库');
assert.match(indexHtml, /待人工审核（AI 生成）/,
  '生成的简报必须标记为待人工审核');

// ===== V1.2 — 老板决策页 / 经营日报 Agent V2 / 驾驶舱闭环 =====
assert.match(indexHtml, /风险中心 · 老板决策页/,
  '风险中心必须升级为老板决策页');
assert.match(indexHtml, /id="riskDecisionList"/,
  '老板决策页必须渲染决策卡片容器');
assert.match(indexHtml, /class="decision-card/,
  '老板决策页必须渲染决策卡片（非普通列表）');
assert.match(indexHtml, /setRiskSort\('level'\)/,
  '老板决策页必须支持按风险等级排序');
assert.match(indexHtml, /window\.generateDailyReport = function/,
  '必须提供经营日报生成入口（项目经理 Agent V2）');
assert.match(indexHtml, /window\.exportReportDraft = /,
  '经营日报草稿必须经人工审核后导出，不可自动落库');
assert.match(indexHtml, /生成今日经营日报/,
  '首页与风险页必须提供「生成今日经营日报」按钮');
assert.match(indexHtml, /class="level-badge/,
  '决策卡片必须按风险等级着色（红 / 黄 / 绿）');

// ===== CEO command center shell =====
assert.match(indexHtml, /class="zos-command"/,
  '应用壳必须声明 zos-command 深色主题类');
assert.match(indexHtml, /--cc-background:\s*#[0-9a-f]{6}/i,
  '指挥中心必须定义深色背景令牌');
assert.match(indexHtml, /--cc-panel:\s*#[0-9a-f]{6}/i,
  '指挥中心必须定义面板令牌');
assert.match(indexHtml, /--cc-border:\s*rgba?\(/i,
  '指挥中心必须定义低对比边框令牌');
assert.match(indexHtml, /--cc-text:\s*#[0-9a-f]{6}/i,
  '指挥中心必须定义正文令牌');
assert.match(indexHtml, /--cc-text-muted:\s*#[0-9a-f]{6}/i,
  '指挥中心必须定义弱化正文令牌');
assert.match(indexHtml, /--cc-accent-gold:\s*#[0-9a-f]{6}/i,
  '指挥中心必须定义金色强调令牌');
assert.match(indexHtml, /--cc-success:\s*#[0-9a-f]{6}/i,
  '指挥中心必须定义成功状态令牌');
assert.match(indexHtml, /--cc-warning:\s*#[0-9a-f]{6}/i,
  '指挥中心必须定义警告状态令牌');
assert.match(indexHtml, /--cc-risk:\s*#[0-9a-f]{6}/i,
  '指挥中心必须定义风险状态令牌');
assert.match(indexHtml, /\.zos-command \.sidebar[\s\S]{0,240}var\(--cc-panel\)/,
  '侧边栏必须消费深色面板令牌');
assert.match(indexHtml, /\.zos-command \.topbar[\s\S]{0,240}var\(--cc-panel\)/,
  '顶栏必须消费深色面板令牌');
assert.match(indexHtml, /\.zos-command \.bottom-nav[\s\S]{0,240}var\(--cc-panel\)/,
  '底部导航必须消费深色面板令牌');
assert.match(indexHtml, /@media \(min-width: 1025px\)/,
  '桌面断点必须保留');
assert.match(indexHtml, /@media \(max-width: 1024px\)/,
  '平板断点必须保留');
assert.match(indexHtml, /@media \(max-width: 767px\)[\s\S]{0,600}\.sidebar\s*\{\s*display:\s*none;/,
  '移动端必须隐藏桌面侧边导航');
assert.match(indexHtml, /env\(safe-area-inset-bottom\)/,
  '移动端底部导航必须保留安全区内边距');
assert.match(indexHtml, /@media \(min-width: 1200px\)[\s\S]{0,240}\.zos-command \.command-grid\s*\{\s*grid-template-columns:\s*repeat\(3,/,
  '1200px 及以上的桌面壳必须提供三列布局');
assert.match(indexHtml, /@media \(min-width: 768px\) and \(max-width: 1199px\)[\s\S]{0,240}\.zos-command \.command-grid\s*\{\s*grid-template-columns:\s*repeat\(2,/,
  '768–1199px 的平板壳必须提供两列布局');
assert.match(indexHtml, /@media \(max-width: 767px\)[\s\S]{0,1800}\.zos-command \.command-grid\s*\{\s*grid-template-columns:\s*1fr;/,
  '移动端壳必须提供单列布局');
assert.match(indexHtml, /<nav class="bottom-nav" id="bottomNav">/,
  '既有底部导航必须保留');

const pageIds = new Set([...indexHtml.matchAll(/<section class="page(?: active)?" id="page-([^"]+)"/g)].map(([, id]) => id));
const navigationTargets = [...indexHtml.matchAll(/<(?:div|button)\b[^>]*\bclass="(?:nav-item|bottom-nav-item|mobile-more-item)[^"]*"[^>]*\bdata-page="([^"]+)"/g)]
  .map(([, pageId]) => pageId);
assert.deepEqual(navigationTargets.filter((pageId) => !pageIds.has(pageId)), [],
  '每个侧栏或移动导航目标都必须指向现有页面');
assert.match(indexHtml, /@media \(min-width: 1200px\)/,
  '桌面断点必须存在');
assert.match(indexHtml, /@media \(min-width: 768px\) and \(max-width: 1199px\)/,
  '平板断点必须存在');
assert.match(indexHtml, /@media \(max-width: 767px\)/,
  '移动端断点必须存在');
assert.match(indexHtml, /@media \(max-height: 420px\) and \(max-width: 767px\)\s*\{[\s\S]{0,220}\.bottom-nav\s*\{\s*display:\s*flex;/,
  '横屏或键盘展开时，移动端必须保留可达的底部导航');

console.log('PWA baseline privacy and cache version checks passed');
