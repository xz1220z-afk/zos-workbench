const CACHE_NAME = 'zos-workbench-v1.3.0';
// Resolve from the service worker scope so the PWA works both at a domain root
// and from a GitHub Pages project path such as /zos-workbench/.
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/app.css',
  'src/data-model.mjs',
  'src/legacy-app.mjs',
  'src/app.mjs',
  'src/business-data-client.mjs',
  'src/supabase-auth.mjs',
  'src/supabase-transport.mjs',
  'src/sync-engine.mjs',
  'src/risk-detector.mjs',
  'src/wanjia-data.mjs',
  'src/huahuo-data.mjs',
  'src/app/router.mjs',
  'src/app/browser-runtime.mjs',
  'src/app/state-store.mjs',
  'src/app/sync-controller.mjs',
  'src/app/operating-loop.mjs',
  'src/app/decision-center.mjs',
  'src/app/targets.mjs',
  'src/app/source-health.mjs',
  'src/app/daily-brief.mjs',
  'src/app/feishu-approvals.mjs',
  'src/app/monitoring.mjs',
  'src/app/views/view-utils.mjs',
  'src/app/views/dashboard-view.mjs',
  'src/app/views/decision-view.mjs',
  'src/app/views/targets-view.mjs',
  'src/app/views/health-view.mjs',
  'src/app/views/business-view.mjs',
  'src/app/views/mobile-view.mjs',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'icons/icon-maskable-512x512.png',
  'icons/apple-touch-icon.png'
].map(function(asset) {
  return new URL(asset, self.registration.scope).href;
});

// Install: cache app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(function() {
        return self.skipWaiting();
      })
      .catch(function(err) {
        console.error('[SW] Cache addAll failed:', err);
      })
  );
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.filter(function(name) {
            return name.startsWith('zos-workbench-') && name !== CACHE_NAME;
          }).map(function(name) {
            return caches.delete(name);
          })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

// Fetch: cache-first for shell assets, network-first for others, offline fallback
self.addEventListener('fetch', function(event) {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  const isShellAsset = ASSETS_TO_CACHE.includes(url.href);

  event.respondWith(
    caches.match(request).then(function(cachedResponse) {
      if (isShellAsset) {
        // Cache-first for shell assets
        return cachedResponse || fetch(request)
          .then(function(networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(function() {
            return cachedResponse || offlineResponse();
          });
      }

      // Network-first for other same-origin requests
      return fetch(request)
        .then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(function() {
          return cachedResponse || offlineResponse();
        });
    })
  );
});

// Message handling for skip-waiting
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'skip-waiting') {
    self.skipWaiting();
  }
});

function offlineResponse() {
  return new Response(
    `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>离线 · ZOS 工作台</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif; background:#07101d; color:#eef4ff; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; text-align:center; }
  .box { background:#0b1626; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:40px 32px; box-shadow:0 18px 50px rgba(0,0,0,.32); max-width:360px; width:100%; }
  .icon { width:72px; height:72px; margin:0 auto 20px; border-radius:50%; background:#14243a; display:flex; align-items:center; justify-content:center; font-size:32px; }
  h1 { font-size:18px; margin-bottom:8px; }
  p { font-size:14px; color:#9eabc0; line-height:1.6; margin-bottom:24px; }
  button { min-height:44px; padding:10px 24px; border:none; border-radius:8px; background:#c89b50; color:#07101d; font-size:14px; font-weight:700; cursor:pointer; }
</style>
</head>
<body>
<div class="box">
  <div class="icon">📡</div>
  <h1>当前处于离线状态</h1>
  <p>请检查网络连接后重试。ZOS 工作台需要联网才能获取最新数据。</p>
  <button onclick="location.reload()">刷新重试</button>
</div>
</body>
</html>`,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}
