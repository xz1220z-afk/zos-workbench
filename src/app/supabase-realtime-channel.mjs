function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function socketUrl(baseUrl, anonKey) {
  const url = new URL('/realtime/v1/websocket', `${String(baseUrl).replace(/\/$/, '')}/`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('apikey', anonKey);
  url.searchParams.set('vsn', '1.0.0');
  return url.toString();
}

export function createSupabaseRealtimeChannelFactory({
  url,
  anonKey,
  WebSocketImpl = globalThis.WebSocket,
  clock = globalThis,
  reconnectDelays = [1_000, 3_000, 10_000, 30_000],
} = {}) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  required(WebSocketImpl, 'WebSocketImpl');

  return ({ userId, filter, accessToken, onChange = () => {}, onStatus = () => {} } = {}) => {
    required(userId, 'userId');
    required(filter, 'filter');
    required(accessToken, 'accessToken');
    let socket = null;
    let token = accessToken;
    let stopped = true;
    let heartbeat = null;
    let reconnect = null;
    let reconnectAttempt = 0;
    let reference = 0;
    const topic = 'realtime:public:zos_records';

    function nextRef() { reference += 1; return String(reference); }
    function send(event, payload = {}, targetTopic = topic) {
      if (!socket || socket.readyState !== 1) return false;
      socket.send(JSON.stringify({ topic: targetTopic, event, payload, ref: nextRef() }));
      return true;
    }
    function clearTimers() {
      if (heartbeat) clock.clearInterval?.(heartbeat);
      if (reconnect) clock.clearTimeout?.(reconnect);
      heartbeat = null;
      reconnect = null;
    }
    function scheduleReconnect() {
      if (stopped || reconnect) return;
      const delay = reconnectDelays[Math.min(reconnectAttempt, reconnectDelays.length - 1)];
      reconnectAttempt += 1;
      onStatus({ phase: 'reconnecting', safeCode: null });
      reconnect = clock.setTimeout?.(() => {
        reconnect = null;
        if (!stopped) connect();
      }, delay);
    }
    function connect() {
      if (stopped) return;
      onStatus({ phase: 'connecting', safeCode: null });
      const current = new WebSocketImpl(socketUrl(url, anonKey));
      socket = current;
      current.addEventListener('open', () => {
        if (stopped || socket !== current) return;
        reconnectAttempt = 0;
        send('phx_join', {
          config: {
            broadcast: { ack: false, self: false },
            presence: { enabled: false },
            postgres_changes: [{ event: '*', schema: 'public', table: 'zos_records', filter }],
          },
          access_token: token,
        });
        heartbeat = clock.setInterval?.(() => send('heartbeat', {}, 'phoenix'), 25_000);
        onStatus({ phase: 'connected', safeCode: null });
      });
      current.addEventListener('message', (event) => {
        if (stopped || socket !== current) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message?.topic !== topic || message?.event !== 'postgres_changes') return;
        const eventType = String(message?.payload?.data?.type || message?.payload?.type || 'CHANGE').toUpperCase();
        onChange({ eventType });
      });
      current.addEventListener('error', () => {
        if (!stopped && socket === current) onStatus({ phase: 'attention', safeCode: 'realtime_connection_failed' });
      });
      current.addEventListener('close', () => {
        if (socket !== current) return;
        if (heartbeat) clock.clearInterval?.(heartbeat);
        heartbeat = null;
        socket = null;
        scheduleReconnect();
      });
    }

    return {
      start() {
        if (!stopped) return;
        stopped = false;
        reconnectAttempt = 0;
        connect();
      },
      async setAccessToken(nextToken) {
        required(nextToken, 'accessToken');
        if (nextToken === token) return;
        token = nextToken;
        send('access_token', { access_token: token });
      },
      stop() {
        if (stopped) return;
        stopped = true;
        clearTimers();
        const current = socket;
        socket = null;
        try { current?.close?.(1000, 'client stop'); } catch { /* Socket is already closed. */ }
        onStatus({ phase: 'stopped', safeCode: null });
      },
    };
  };
}
