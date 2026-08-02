const DEFAULT_INTERVAL_MS = 15 * 60_000;
const DEFAULT_FOREGROUND_STALE_MS = 5 * 60_000;
const DEFAULT_STALE_MS = 30 * 60_000;

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function normalizedResult(result = {}) {
  return {
    succeeded: Array.isArray(result.succeeded) ? result.succeeded.slice() : [],
    failed: Array.isArray(result.failed) ? result.failed.map((item) => ({
      source: String(item?.source || 'unknown'),
      safeCode: String(item?.safeCode || 'refresh_failed'),
    })) : [],
  };
}

export function createAutoRefreshController({
  refreshAll,
  eventTarget = globalThis,
  visibility = globalThis.document,
  clock = globalThis,
  intervalMs = DEFAULT_INTERVAL_MS,
  foregroundStaleMs = DEFAULT_FOREGROUND_STALE_MS,
  staleMs = DEFAULT_STALE_MS,
  jitterMs = 30_000,
  random = Math.random,
  now = () => Date.now(),
  isOnline = () => globalThis.navigator?.onLine !== false,
  onStatus = () => {},
} = {}) {
  if (typeof refreshAll !== 'function') throw new Error('refreshAll is required');

  let started = false;
  let timer = null;
  let active = null;
  let lastSuccessMs = 0;
  let status = {
    phase: 'idle', reason: null, lastAttemptAt: null, lastSuccessAt: null,
    succeeded: [], failed: [],
  };

  function publish(patch) {
    status = { ...status, ...patch };
    onStatus(clone(status));
  }

  function intervalDelay() {
    const jitter = Math.max(0, Number(jitterMs) || 0);
    return Math.max(0, intervalMs + (jitter ? Math.floor(random() * jitter) : 0));
  }

  function scheduleNext() {
    if (!started) return;
    if (timer) clock.clearTimeout(timer);
    timer = clock.setTimeout(async () => {
      timer = null;
      if (!isOnline()) publish({ phase: 'offline', reason: 'interval' });
      else if (visibility?.visibilityState !== 'hidden') {
        try { await refresh('interval'); } catch { /* status already contains the safe failure */ }
      }
      scheduleNext();
    }, intervalDelay());
  }

  function refresh(reason = 'manual') {
    if (active) return active;
    if (!isOnline()) {
      publish({ phase: 'offline', reason });
      return Promise.resolve(clone(status));
    }
    const attemptedMs = now();
    publish({ phase: 'refreshing', reason, lastAttemptAt: new Date(attemptedMs).toISOString() });
    let operation;
    try { operation = refreshAll(reason); }
    catch { operation = Promise.reject(new Error('refresh_failed')); }
    active = Promise.resolve(operation)
      .then((raw) => {
        const result = normalizedResult(raw);
        if (result.succeeded.length && !result.failed.length) {
          lastSuccessMs = now();
        }
        publish({
          phase: result.failed.length ? 'partial' : 'idle',
          reason,
          lastSuccessAt: lastSuccessMs ? new Date(lastSuccessMs).toISOString() : status.lastSuccessAt,
          succeeded: result.succeeded,
          failed: result.failed,
        });
        return clone(status);
      })
      .catch(() => {
        publish({
          phase: 'partial', reason, succeeded: [],
          failed: [{ source: 'all', safeCode: 'refresh_failed' }],
        });
        throw new Error('refresh_failed');
      })
      .finally(() => { active = null; });
    return active;
  }

  const onlineHandler = () => { refresh('online').catch(() => {}); };
  const visibilityHandler = () => {
    if (visibility?.visibilityState !== 'visible' || !isOnline()) return;
    if (!lastSuccessMs || now() - lastSuccessMs >= foregroundStaleMs) {
      refresh('visibility').catch(() => {});
    }
  };

  function start() {
    if (started) return;
    started = true;
    eventTarget?.addEventListener?.('online', onlineHandler);
    visibility?.addEventListener?.('visibilitychange', visibilityHandler);
    scheduleNext();
  }

  function stop() {
    if (!started) return;
    started = false;
    eventTarget?.removeEventListener?.('online', onlineHandler);
    visibility?.removeEventListener?.('visibilitychange', visibilityHandler);
    if (timer) clock.clearTimeout(timer);
    timer = null;
  }

  function getStatus() {
    if (status.phase === 'idle' && lastSuccessMs && now() - lastSuccessMs >= staleMs) {
      return clone({ ...status, phase: 'stale' });
    }
    return clone(status);
  }

  return { start, stop, refresh, getStatus };
}
