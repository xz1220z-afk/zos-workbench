import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [indexHtml, serviceWorker] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../sw.js', import.meta.url), 'utf8'),
]);

assert.match(serviceWorker, /const CACHE_NAME = 'zos-workbench-v1\.0\.9';/,
  'Service Worker cache must match the current v1.0.9 application release');
assert.match(indexHtml, /refreshSession\(session\.refreshToken\)/,
  'Sync must refresh an existing Supabase session before pulling data');
assert.match(indexHtml, /const PUBLIC_APP_URL = 'https:\/\/xz1220z-afk\.github\.io\/zos-workbench\/'/,
  'The public app URL must be explicit so auth callbacks stay on the GitHub Pages subpath');
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

console.log('PWA baseline privacy and cache version checks passed');
