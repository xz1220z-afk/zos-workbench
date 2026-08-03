import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyFocusCompletion,
  createFocusSession,
  focusSnapshot,
  summarizeFocus,
  transitionFocus,
} from '../src/app/focus-center.mjs';

test('focus snapshot restores remaining time from timestamps', () => {
  const session = createFocusSession(
    { taskId: 't1', durationMinutes: 25 },
    { now: '2026-08-03T01:00:00.000Z', id: 'f1' },
  );
  const running = transitionFocus(session, 'start', { now: '2026-08-03T01:00:00.000Z' });

  assert.deepEqual(focusSnapshot(running, { now: '2026-08-03T01:10:00.000Z' }), {
    state: 'running', remainingSeconds: 900, elapsedSeconds: 600,
  });
});

test('pause and resume exclude paused time and invalid transitions fail closed', () => {
  const planned = createFocusSession(
    { durationMinutes: 25 },
    { now: '2026-08-03T01:00:00.000Z', id: 'f1' },
  );
  const running = transitionFocus(planned, 'start', { now: '2026-08-03T01:00:00.000Z' });
  const paused = transitionFocus(running, 'pause', { now: '2026-08-03T01:05:00.000Z' });
  assert.deepEqual(focusSnapshot(paused, { now: '2026-08-03T01:20:00.000Z' }), {
    state: 'paused', remainingSeconds: 1200, elapsedSeconds: 300,
  });
  const resumed = transitionFocus(paused, 'resume', { now: '2026-08-03T01:20:00.000Z' });
  assert.deepEqual(focusSnapshot(resumed, { now: '2026-08-03T01:25:00.000Z' }), {
    state: 'running', remainingSeconds: 900, elapsedSeconds: 600,
  });
  assert.throws(() => transitionFocus(planned, 'resume'), /invalid focus transition/);
});

test('custom duration clamps to 1–180 minutes and completion records actual time', () => {
  assert.equal(createFocusSession({ durationMinutes: 0 }, { id: 'a' }).durationMinutes, 1);
  assert.equal(createFocusSession({ durationMinutes: 999 }, { id: 'b' }).durationMinutes, 180);
  const running = transitionFocus(
    createFocusSession({ durationMinutes: 25 }, { now: '2026-08-03T01:00:00.000Z', id: 'c' }),
    'start',
    { now: '2026-08-03T01:00:00.000Z' },
  );
  const completed = transitionFocus(running, 'finish', { now: '2026-08-03T01:24:30.000Z' });
  assert.equal(completed.state, 'completed');
  assert.equal(completed.actualMinutes, 25);
});

test('completing focus increments only the bound task', () => {
  const result = applyFocusCompletion([
    { id: 't1', title: 'A', focusMinutes: 10, focusCount: 1 },
    { id: 't2', title: 'B', focusMinutes: 0, focusCount: 0 },
  ], { taskId: 't1', actualMinutes: 25, state: 'completed' });

  assert.deepEqual(
    result.map(({ focusMinutes, focusCount }) => [focusMinutes, focusCount]),
    [[35, 2], [0, 0]],
  );
});

test('focus summary reports completed sessions only', () => {
  const summary = summarizeFocus([
    { state: 'completed', actualMinutes: 25, endedAt: '2026-08-03T01:25:00.000Z' },
    { state: 'completed', actualMinutes: 50, endedAt: '2026-08-01T01:25:00.000Z' },
    { state: 'cancelled', actualMinutes: 10, endedAt: '2026-08-03T02:00:00.000Z' },
  ], { now: '2026-08-03T12:00:00+08:00', timeZone: 'Asia/Shanghai' });

  assert.deepEqual(summary.today, { minutes: 25, sessions: 1 });
  assert.deepEqual(summary.week, { minutes: 75, sessions: 2 });
});
