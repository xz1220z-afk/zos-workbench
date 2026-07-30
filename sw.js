const CACHE_NAME = 'zos-workbench-v1.0.14';
// Resolve from the service worker scope so the PWA works both at a domain root
// and from a GitHub Pages project path such as /zos-workbench/.
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/data-model.mjs',
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
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif; background:#f0f2f5; color:#1f2937; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; text-align:center; }
  .box { background:#fff; border-radius:16px; padding:40px 32px; box-shadow:0 4px 12px rgba(0,0,0,.08); max-width:360px; width:100%; }
  .icon { width:72px; height:72px; margin:0 auto 20px; border-radius:50%; background:#eef2ff; display:flex; align-items:center; justify-content:center; font-size:32px; }
  h1 { font-size:18px; margin-bottom:8px; }
  p { font-size:14px; color:#6b7280; line-height:1.6; margin-bottom:24px; }
  button { padding:10px 24px; border:none; border-radius:8px; background:#4f46e5; color:#fff; font-size:14px; cursor:pointer; }
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
