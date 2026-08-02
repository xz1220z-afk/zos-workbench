import test from 'node:test';
import assert from 'node:assert/strict';

import { createAutoRefreshController } from '../src/app/auto-refresh-controller.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeClock(startAt = 0) {
  let now = startAt;
  let sequence = 0;
  let timers = [];
  return {
    now: () => now,
    setTimeout(callback, delay = 0) {
      const handle = { id: ++sequence, at: now + delay, callback };
      timers.push(handle);
      return handle;
    },
    clearTimeout(handle) { timers = timers.filter((item) => item !== handle); },
    async advance(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        timers.sort((left, right) => left.at - right.at || left.id - right.id);
        const next = timers[0];
        if (!next || next.at > target) break;
        timers.shift();
        now = next.at;
        await next.callback();
        await Promise.resolve();
      }
      now = target;
      await Promise.resolve();
    },
    pending: () => timers.length,
  };
}

function makeVisibility(state = 'visible') {
  const visibility = new EventTarget();
  visibility.visibilityState = state;
  return visibility;
}

test('manual and automatic refreshes share one in-flight operation', async () => {
  const pending = deferred();
  const calls = [];
  const controller = createAutoRefreshController({
    refreshAll: (reason) => { calls.push(reason); return pending.promise; },
    clock: makeClock(),
    visibility: makeVisibility(),
    eventTarget: new EventTarget(),
    jitterMs: 0,
  });

  const first = controller.refresh('startup');
  const second = controller.refresh('manual');

  assert.equal(first, second);
  assert.deepEqual(calls, ['startup']);
  pending.resolve({ succeeded: ['wanjia'], failed: [] });
  await first;
  assert.equal(controller.getStatus().phase, 'idle');
});

test('periodic refresh pauses while hidden and catches up when stale visibility returns', async () => {
  const clock = makeClock(1_000);
  const visibility = makeVisibility('hidden');
  const calls = [];
  const controller = createAutoRefreshController({
    refreshAll: async (reason) => { calls.push(reason); return { succeeded: ['wanjia'], failed: [] }; },
    clock,
    now: clock.now,
    visibility,
    eventTarget: new EventTarget(),
    intervalMs: 15 * 60_000,
    foregroundStaleMs: 5 * 60_000,
    jitterMs: 0,
  });

  controller.start();
  await clock.advance(15 * 60_000);
  assert.deepEqual(calls, []);

  visibility.visibilityState = 'visible';
  visibility.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(calls, ['visibility']);

  controller.stop();
  assert.equal(clock.pending(), 0);
});

test('online recovery triggers once and partial failure remains source-isolated', async () => {
  const eventTarget = new EventTarget();
  const calls = [];
  const statuses = [];
  const controller = createAutoRefreshController({
    refreshAll: async (reason) => {
      calls.push(reason);
      return {
        succeeded: ['wanjia', 'projects'],
        failed: [{ source: 'huahuo', safeCode: 'feishu_permission_denied' }],
      };
    },
    clock: makeClock(),
    visibility: makeVisibility(),
    eventTarget,
    jitterMs: 0,
    onStatus: (status) => statuses.push(status),
  });

  controller.start();
  eventTarget.dispatchEvent(new Event('online'));
  eventTarget.dispatchEvent(new Event('online'));
  await controller.refresh('observer');

  assert.deepEqual(calls, ['online']);
  assert.equal(controller.getStatus().phase, 'partial');
  assert.deepEqual(controller.getStatus().succeeded, ['wanjia', 'projects']);
  assert.equal(controller.getStatus().failed[0].source, 'huahuo');
  assert.equal(statuses.at(-1).phase, 'partial');
  controller.stop();
});

test('offline and hidden periodic checks never issue remote work', async () => {
  const clock = makeClock();
  const visibility = makeVisibility('visible');
  const calls = [];
  let online = false;
  const controller = createAutoRefreshController({
    refreshAll: async (reason) => { calls.push(reason); return { succeeded: [], failed: [] }; },
    clock,
    now: clock.now,
    visibility,
    eventTarget: new EventTarget(),
    isOnline: () => online,
    intervalMs: 100,
    jitterMs: 0,
  });

  controller.start();
  await clock.advance(100);
  assert.deepEqual(calls, []);
  assert.equal(controller.getStatus().phase, 'offline');

  online = true;
  visibility.visibilityState = 'hidden';
  await clock.advance(100);
  assert.deepEqual(calls, []);
  controller.stop();
});
