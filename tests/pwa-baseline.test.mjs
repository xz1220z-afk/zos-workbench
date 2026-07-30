import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [indexHtml, serviceWorker] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../sw.js', import.meta.url), 'utf8'),
]);

assert.match(serviceWorker, /const CACHE_NAME = 'zos-workbench-v1\.0\.11';/,
  'Service Worker cache must match the current v1.0.11 application release');
assert.doesNotMatch(indexHtml, /本地生活运营/,
  'Current UI must use the 万嘉网络 brand name');
assert.match(indexHtml, /万嘉网络/,
  'Current UI must expose the 万嘉网络 brand name');
assert.match(indexHtml, /refreshSession\(session\.refreshToken\)/,
  'Sync must refresh an existing Supabase session before pulling data');
assert.match(indexHtml, /const PUBLIC_APP_URL = 'https:\/\/xz1220z-afk\.github\.io\/zos-workbench\/'/,
  'The public app URL must be explicit so auth callbacks stay on the GitHub Pages subpath');
assert.match(indexHtml, /const APP_VERSION = '1\.0\.11'/,
  'The inline application version must match the current release');
assert.match(indexHtml, /工作台版本<\/div>[\s\S]{0,120}v1\.0\.11/,
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
assert.match(indexHtml, /function renderBusinessDataStates\(\)/,
  '页面必须根据实际连接状态渲染业务数据源');

console.log('PWA baseline privacy and cache version checks passed');
