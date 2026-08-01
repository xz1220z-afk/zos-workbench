import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [indexHtml, serviceWorker] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../sw.js', import.meta.url), 'utf8'),
]);

assert.match(serviceWorker, /const CACHE_NAME = 'zos-workbench-v1\.2\.2';/,
  'Service Worker cache must match the current v1.2.2 application release');
assert.doesNotMatch(indexHtml, /本地生活运营/,
  'Current UI must use the 万嘉网络 brand name');
assert.match(indexHtml, /万嘉网络/,
  'Current UI must expose the 万嘉网络 brand name');
assert.match(indexHtml, /refreshSession\(session\.refreshToken\)/,
  'Sync must refresh an existing Supabase session before pulling data');
assert.match(indexHtml, /const PUBLIC_APP_URL = 'https:\/\/xz1220z-afk\.github\.io\/zos-workbench\/'/,
  'The public app URL must be explicit so auth callbacks stay on the GitHub Pages subpath');
assert.match(indexHtml, /const APP_VERSION = '1\.2\.2'/,
  'The inline application version must match the current release');
assert.match(indexHtml, /工作台版本<\/div>[\s\S]{0,120}v1\.2\.2/,
  'The settings page version label must match the current release');
assert.match(indexHtml, /requestOtp\(email, PUBLIC_APP_URL\)/,
  'Magic-link requests must redirect to the public app subpath');
assert.doesNotMatch(indexHtml, /requestOtp\(email, window\.location\.origin \+ window\.location\.pathname\)/,
  'Magic-link requests must not derive redirects from the current page location');
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

console.log('PWA baseline privacy and cache version checks passed');
