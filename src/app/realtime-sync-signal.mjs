function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function createRealtimeSyncSignal({
  userId,
  getAccessToken,
  channelFactory,
  onSignal,
  onStatus = () => {},
  BroadcastChannelImpl = globalThis.BroadcastChannel,
  clock = globalThis,
  debounceMs = 120,
  instanceId = globalThis.crypto?.randomUUID?.() || `tab-${Date.now().toString(36)}`,
} = {}) {
  required(userId, 'userId');
  required(getAccessToken, 'getAccessToken');
  required(channelFactory, 'channelFactory');
  required(onSignal, 'onSignal');
  let channel = null;
  let broadcast = null;
  let timer = null;
  let started = false;
  let generation = 0;
  let currentToken = '';
  let status = { phase: 'idle', safeCode: null };
  const listeners = new Set();

  function publish(next) {
    status = { ...status, ...next };
    onStatus({ ...status });
    for (const listener of listeners) listener({ ...status });
  }

  function schedule(reason) {
    if (!started) return;
    if (timer) clock.clearTimeout?.(timer);
    const expectedGeneration = generation;
    timer = clock.setTimeout?.(async () => {
      timer = null;
      if (!started || expectedGeneration !== generation) return;
      try {
        await onSignal(reason);
        publish({ phase: 'ready', safeCode: null });
      } catch {
        publish({ phase: 'attention', safeCode: 'realtime_sync_failed' });
      }
    }, debounceMs);
  }

  function databaseChange() {
    if (!started) return;
    schedule('realtime-signal');
    broadcast?.postMessage?.({ type: 'zos-records-changed', source: instanceId });
  }

  return {
    async start() {
      if (started) return;
      const token = await getAccessToken();
      if (!token) throw new Error('authentication_required');
      generation += 1;
      started = true;
      currentToken = token;
      if (typeof BroadcastChannelImpl === 'function') {
        broadcast = new BroadcastChannelImpl(`zos-records:${userId}`);
        broadcast.onmessage = (event) => {
          const message = event?.data;
          if (message?.type !== 'zos-records-changed' || message.source === instanceId) return;
          schedule('realtime-tab-signal');
        };
      }
      channel = channelFactory({
        userId,
        filter: `user_id=eq.${userId}`,
        accessToken: token,
        onChange: databaseChange,
        onStatus: (next) => publish(next || {}),
      });
      await channel?.start?.();
      publish({ phase: 'ready', safeCode: null });
    },

    async setAccessToken(token) {
      if (!token) throw new Error('authentication_required');
      if (token === currentToken) return;
      currentToken = token;
      await channel?.setAccessToken?.(token);
    },

    stop() {
      if (!started && !channel && !broadcast) return;
      started = false;
      generation += 1;
      if (timer) clock.clearTimeout?.(timer);
      timer = null;
      channel?.stop?.();
      channel = null;
      if (broadcast) broadcast.onmessage = null;
      broadcast?.close?.();
      broadcast = null;
      currentToken = '';
      publish({ phase: 'stopped', safeCode: null });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getStatus() { return { ...status }; },
  };
}
