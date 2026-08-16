import assert from 'node:assert/strict';
import test from 'node:test';
import { createRealtimeSyncSignal } from '../src/app/realtime-sync-signal.mjs';

function clock() {
  let queue = [];
  return {
    setTimeout(callback) { queue.push(callback); return callback; },
    clearTimeout(callback) { queue = queue.filter((item) => item !== callback); },
    async flush() { const current = queue; queue = []; for (const callback of current) await callback(); },
    size: () => queue.length,
  };
}

function broadcastHarness() {
  const instances = [];
  class Channel {
    constructor(name) { this.name = name; this.onmessage = null; this.closed = false; instances.push(this); }
    postMessage(data) { for (const item of instances) if (item !== this && !item.closed && item.name === this.name) item.onmessage?.({ data }); }
    close() { this.closed = true; }
  }
  return { Channel, instances };
}

test('realtime subscribes only with an authorized user, token and exact row filter', async () => {
  const created = [];
  const signal = createRealtimeSyncSignal({
    userId: 'owner-user', getAccessToken: async () => 'access-token',
    channelFactory: (options) => { created.push(options); return { start() {}, stop() {}, setAccessToken() {} }; },
    onSignal: async () => {},
  });
  await signal.start();
  assert.equal(created.length, 1);
  assert.equal(created[0].accessToken, 'access-token');
  assert.equal(created[0].filter, 'user_id=eq.owner-user');
  assert.equal(created[0].userId, 'owner-user');
  signal.stop();

  const missing = createRealtimeSyncSignal({
    userId: 'owner-user', getAccessToken: async () => '', channelFactory: () => { throw new Error('must not subscribe'); }, onSignal: async () => {},
  });
  await assert.rejects(() => missing.start(), /authentication_required/);
});

test('database payloads are discarded and bursts coalesce into one authoritative pull signal', async () => {
  const timer = clock();
  let options;
  const received = [];
  const signal = createRealtimeSyncSignal({
    userId: 'owner-user', getAccessToken: async () => 'token', clock: timer,
    channelFactory: (value) => { options = value; return { start() {}, stop() {}, setAccessToken() {} }; },
    onSignal: async (...args) => received.push(args), debounceMs: 25,
  });
  await signal.start();
  options.onChange({ record: { private: 'must-not-flow' }, eventType: 'UPDATE' });
  options.onChange({ record: { private: 'must-not-flow-2' }, eventType: 'DELETE' });
  assert.equal(timer.size(), 1);
  await timer.flush();
  assert.deepEqual(received, [['realtime-signal']]);
  assert.doesNotMatch(JSON.stringify(received), /private|must-not-flow/);
  signal.stop();
});

test('same-browser tabs wake each other without rebroadcast loops', async () => {
  const bus = broadcastHarness();
  const timerA = clock();
  const timerB = clock();
  let databaseChange;
  const reasonsA = [];
  const reasonsB = [];
  const shared = {
    userId: 'owner-user', getAccessToken: async () => 'token', BroadcastChannelImpl: bus.Channel,
    channelFactory: (options) => { if (!databaseChange) databaseChange = options.onChange; return { start() {}, stop() {}, setAccessToken() {} }; },
  };
  const a = createRealtimeSyncSignal({ ...shared, clock: timerA, instanceId: 'a', onSignal: async (reason) => reasonsA.push(reason) });
  const b = createRealtimeSyncSignal({ ...shared, clock: timerB, instanceId: 'b', onSignal: async (reason) => reasonsB.push(reason) });
  await a.start(); await b.start();
  databaseChange({ eventType: 'INSERT' });
  await timerA.flush();
  await timerB.flush();
  assert.deepEqual(reasonsA, ['realtime-signal']);
  assert.deepEqual(reasonsB, ['realtime-tab-signal']);
  assert.equal(timerA.size() + timerB.size(), 0);
  a.stop(); b.stop();
});

test('token refresh is forwarded once and stop cancels every late callback', async () => {
  const timer = clock();
  let options;
  const tokens = [];
  let stopped = 0;
  let signals = 0;
  const signal = createRealtimeSyncSignal({
    userId: 'owner-user', getAccessToken: async () => 'token-1', clock: timer,
    channelFactory: (value) => { options = value; return { start() {}, stop() { stopped += 1; }, setAccessToken(token) { tokens.push(token); } }; },
    onSignal: async () => { signals += 1; },
  });
  await signal.start();
  await signal.setAccessToken('token-2');
  await signal.setAccessToken('token-2');
  options.onChange({ eventType: 'UPDATE' });
  signal.stop();
  await timer.flush();
  options.onChange({ eventType: 'UPDATE' });
  await timer.flush();
  assert.deepEqual(tokens, ['token-2']);
  assert.equal(stopped, 1);
  assert.equal(signals, 0);
});
