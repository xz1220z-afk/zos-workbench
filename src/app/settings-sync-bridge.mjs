/**
 * The settings screen predates the modular CEO OS and still invokes the
 * window-level legacy `syncNow`. Once a signed-in modular runtime exists,
 * that legacy routine duplicates every collection into the old localStorage
 * keys. Large inboxes can exceed the browser quota there even though the
 * modular/cloud sync path is healthy.
 *
 * Keep the legacy function for first-time sign-in, but route authenticated
 * syncs through the current application. This avoids a second, quota-prone
 * copy without deleting or compacting any user records.
 */
export function installSettingsSyncBridge({ browserWindow = globalThis, application } = {}) {
  if (!browserWindow || !application) return () => {};

  const legacySync = typeof browserWindow.syncNow === 'function'
    ? browserWindow.syncNow.bind(browserWindow)
    : null;

  browserWindow.syncNow = async (...args) => {
    let controller = application.operatingRuntime?.syncController;
    // The user can click Settings before startup finishes restoring the
    // authenticated runtime. Wait for that one startup pass first so a valid
    // session never falls back to the old full-inbox localStorage mirror.
    if (typeof controller?.sync !== 'function' && typeof application.whenIdle === 'function') {
      try {
        await application.whenIdle();
      } catch {
        // Preserve the existing first-time sign-in path if startup is unable
        // to establish a modular runtime.
      }
      controller = application.operatingRuntime?.syncController;
    }
    if (typeof controller?.sync === 'function' && typeof application.syncNow === 'function') {
      return application.syncNow(...args);
    }
    if (legacySync) return legacySync(...args);
    return undefined;
  };

  return () => {
    if (legacySync) browserWindow.syncNow = legacySync;
  };
}
