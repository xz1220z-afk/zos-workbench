const CACHE_NAME = 'zos-workbench-v2.9.0';
// Resolve from the service worker scope so the PWA works both at a domain root
// and from a GitHub Pages project path such as /zos-workbench/.
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'assets/app.css?v=2.9.0',
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
  'src/app/business-data-cache.mjs',
  'src/app/ai-assistant-client.mjs',
  'src/app/weather-center.mjs',
  'src/app/homepage-presence.mjs',
  'src/knowledge-context-index.mjs',
  'src/app/state-store.mjs',
  'src/app/settings-sync-bridge.mjs',
  'src/app/sync-controller.mjs',
  'src/app/auto-refresh-controller.mjs',
  'src/app/company-operating-contract.mjs',
  'src/app/company-cockpit.mjs',
  'src/app/priority-engine.mjs',
  'src/app/reminder-center.mjs',
  'src/app/daily-digest.mjs',
  'src/app/push-notifications.mjs',
  'src/app/reliability-center.mjs',
  'src/app/data-durability.mjs',
  'src/app/snapshot-repository.mjs',
  'src/app/sensitive-fields.mjs',
  'src/app/company-agent-hub.mjs',
  'src/app/content-growth.mjs',
  'src/app/knowledge-workspace.mjs',
  'src/app/social-insight-center.mjs',
  'src/app/agent-workbench.mjs',
  'src/app/agent-os-center.mjs',
  'src/app/agent-os-index-contract.mjs',
  'src/app/agent-task-context.mjs',
  'src/app/ai-command-center.mjs',
  'src/app/intent-router.mjs',
  'src/app/controlled-execution.mjs',
  'src/app/voice-input.mjs',
  'src/app/ics-calendar.mjs',
  'src/app/operating-loop.mjs',
  'src/app/decision-center.mjs',
  'src/app/targets.mjs',
  'src/app/source-health.mjs',
  'src/app/daily-brief.mjs',
  'src/app/feishu-approvals.mjs',
  'src/app/monitoring.mjs',
  'src/app/intelligence-center.mjs',
  'src/app/intelligence-explainer.mjs',
  'src/app/navigation-preferences.mjs',
  'src/app/mobile-navigation.mjs',
  'src/app/calendar-center.mjs',
  'src/app/calendar-range.mjs',
  'src/app/calendar-event.mjs',
  'src/app/calendar-selection.mjs',
  'src/app/calendar-recurrence.mjs',
  'src/app/important-dates.mjs',
  'src/app/task-center.mjs',
  'src/app/focus-center.mjs',
  'src/app/countdown-center.mjs',
  'src/app/availability-center.mjs',
  'src/app/merchant-center.mjs',
  'src/app/wanjia-ops-center.mjs',
  'src/app/wanjia-ops-navigation.mjs',
  'src/app/wanjia-history.mjs',
  'src/app/search-center.mjs',
  'src/app/life-os.mjs',
  'src/app/ritual-calendar.mjs',
  'src/app/private-date-import.mjs',
  'src/app/relation-center.mjs',
  'src/app/review-center.mjs',
  'src/app/value-utils.mjs',
  'src/app/views/view-utils.mjs',
  'src/app/views/dashboard-view.mjs',
  'src/app/views/decision-view.mjs',
  'src/app/views/targets-view.mjs',
  'src/app/views/health-view.mjs',
  'src/app/views/business-view.mjs',
  'src/app/views/mobile-view.mjs',
  'src/app/views/intelligence-view.mjs',
  'src/app/views/calendar-view.mjs',
  'src/app/views/life-view.mjs',
  'src/app/views/search-view.mjs',
  'src/app/views/lingli-view.mjs',
  'src/app/views/company-cockpit-view.mjs',
  'src/app/views/relation-view.mjs',
  'src/app/views/review-view.mjs',
  'src/app/views/task-view.mjs',
  'src/app/views/focus-view.mjs',
  'src/app/views/today-execution-view.mjs',
  'src/app/views/availability-view.mjs',
  'src/app/views/merchant-view.mjs',
  'src/app/views/wanjia-ops-view.mjs',
  'src/app/views/content-growth-view.mjs',
  'src/app/views/knowledge-workspace-view.mjs',
  'src/app/views/social-insights-view.mjs',
  'src/app/views/agent-workbench-view.mjs',
  'src/app/views/ai-command-view.mjs',
  'src/app/views/mobile-command-sheet.mjs',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'icons/icon-maskable-512x512.png',
  'icons/apple-touch-icon.png'
].map(function(asset) {
  const versionedAsset = asset.endsWith('.mjs') ? `${asset}?v=2.9.0` : asset;
  return new URL(versionedAsset, self.registration.scope).href;
});

// Install: cache app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return Promise.all(ASSETS_TO_CACHE.map(function(assetUrl) {
          return fetch(assetUrl, { cache: 'reload' }).then(function(response) {
            if (!response.ok) throw new Error(`Failed to refresh ${assetUrl}: ${response.status}`);
            return cache.put(assetUrl, response);
          });
        }));
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

self.addEventListener('push', function(event) {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = typeof payload.title === 'string' ? payload.title.slice(0, 80) : 'ZOS 提醒';
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 160) : '有一项安排需要处理';
  const tag = typeof payload.tag === 'string' ? payload.tag.slice(0, 200) : 'zos-reminder';
  const url = typeof payload.url === 'string' ? payload.url : './#today';
  event.waitUntil(self.registration.showNotification(title, {
    body, tag, renotify: false, icon: 'icons/icon-192x192.png', badge: 'icons/icon-192x192.png', data: { url },
  }));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const requestedUrl = event.notification?.data?.url || './#today';
  const scopeUrl = new URL(self.registration.scope);
  const targetUrl = new URL(requestedUrl, self.registration.scope);
  const safeUrl = targetUrl.origin === scopeUrl.origin ? targetUrl.href : new URL('./#today', self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windows) {
    const existing = windows.find(function(client) { return new URL(client.url).origin === scopeUrl.origin; });
    if (existing) return existing.navigate(safeUrl).then(function() { return existing.focus(); });
    return clients.openWindow(safeUrl);
  }));
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
