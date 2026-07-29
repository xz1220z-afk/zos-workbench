import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [indexHtml, serviceWorker] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../sw.js', import.meta.url), 'utf8'),
]);

assert.match(serviceWorker, /const CACHE_NAME = 'zos-workbench-v1\.0\.5';/,
  'Service Worker cache must match the current v1.0.5 application release');
assert.doesNotMatch(indexHtml, /code\.coze\.cn\/api\/coding\/deployment\/analytics/i,
  'Local takeover must not report page views to Coze analytics');
assert.doesNotMatch(indexHtml, /apm\.volccdn\.com\/mars-web\/apmplus/i,
  'Local takeover must not load Coze performance monitoring');
assert.doesNotMatch(indexHtml, /跨端同步已就绪/,
  'The interface must not claim cross-device sync before authentication and cloud sync are connected');

console.log('PWA baseline privacy and cache version checks passed');
