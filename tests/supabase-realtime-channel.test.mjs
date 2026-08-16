import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseRealtimeChannelFactory } from '../src/app/supabase-realtime-channel.mjs';

function socketHarness() {
  const sockets = [];
  class Socket {
    static OPEN = 1;
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; this.listeners = {}; sockets.push(this); }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    emit(type, value = {}) { for (const listener of this.listeners[type] || []) listener(value); }
    open() { this.readyState = 1; this.emit('open'); }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; this.emit('close'); }
  }
  return { Socket, sockets };
}

function clock() {
  let timeouts = [];
  let intervals = [];
  return {
    setTimeout(callback) { timeouts.push(callback); return callback; },
    clearTimeout(callback) { timeouts = timeouts.filter((item) => item !== callback); },
    setInterval(callback) { intervals.push(callback); return callback; },
    clearInterval(callback) { intervals = intervals.filter((item) => item !== callback); },
    flushTimeouts() { const work = timeouts; timeouts = []; work.forEach((callback) => callback()); },
    counts: () => ({ timeouts: timeouts.length, intervals: intervals.length }),
  };
}

test('repository-owned realtime channel joins only the owner-filtered table and emits change signals', async () => {
  const harness = socketHarness();
  const timer = clock();
  const changes = [];
  const statuses = [];
  const factory = createSupabaseRealtimeChannelFactory({
    url: 'https://project.supabase.co', anonKey: 'public-key', WebSocketImpl: harness.Socket, clock: timer,
  });
  const channel = factory({
    userId: 'owner-user', filter: 'user_id=eq.owner-user', accessToken: 'access-1',
    onChange: (change) => changes.push(change), onStatus: (status) => statuses.push(status),
  });
  channel.start();
  assert.match(harness.sockets[0].url, /^wss:\/\/project\.supabase\.co\/realtime\/v1\/websocket\?/);
  assert.match(harness.sockets[0].url, /apikey=public-key/);
  harness.sockets[0].open();
  const join = harness.sockets[0].sent.find((item) => item.event === 'phx_join');
  assert.equal(join.topic, 'realtime:public:zos_records');
  assert.equal(join.payload.access_token, 'access-1');
  assert.deepEqual(join.payload.config.postgres_changes, [{ event: '*', schema: 'public', table: 'zos_records', filter: 'user_id=eq.owner-user' }]);

  harness.sockets[0].emit('message', { data: JSON.stringify({ topic: join.topic, event: 'postgres_changes', payload: { data: { type: 'UPDATE', record: { secret: 'discarded upstream' } } } }) });
  assert.deepEqual(changes, [{ eventType: 'UPDATE' }]);
  assert.doesNotMatch(JSON.stringify(changes), /secret|discarded/);

  await channel.setAccessToken('access-2');
  const access = harness.sockets[0].sent.find((item) => item.event === 'access_token');
  assert.deepEqual(access.payload, { access_token: 'access-2' });
  assert.ok(statuses.some((item) => item.phase === 'connecting'));
  channel.stop();
  assert.deepEqual(timer.counts(), { timeouts: 0, intervals: 0 });
});

test('unexpected disconnect reconnects once while stop prevents stale reconnects', () => {
  const harness = socketHarness();
  const timer = clock();
  const factory = createSupabaseRealtimeChannelFactory({
    url: 'https://project.supabase.co', anonKey: 'public-key', WebSocketImpl: harness.Socket, clock: timer,
  });
  const channel = factory({
    userId: 'owner-user', filter: 'user_id=eq.owner-user', accessToken: 'access-1', onChange() {}, onStatus() {},
  });
  channel.start();
  harness.sockets[0].open();
  harness.sockets[0].emit('close');
  assert.equal(timer.counts().timeouts, 1);
  timer.flushTimeouts();
  assert.equal(harness.sockets.length, 2);
  channel.stop();
  harness.sockets[1].emit('close');
  timer.flushTimeouts();
  assert.equal(harness.sockets.length, 2);
});
