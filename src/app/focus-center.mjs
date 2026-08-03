const TRANSITIONS = Object.freeze({
  planned: new Set(['start', 'cancel']),
  running: new Set(['pause', 'finish', 'cancel']),
  paused: new Set(['resume', 'finish', 'cancel']),
  completed: new Set(),
  cancelled: new Set(),
});

function iso(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('invalid focus timestamp');
  return date.toISOString();
}

function secondsBetween(start, end) {
  return Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

function durationMinutes(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 25;
  return Math.min(180, Math.max(1, Math.round(number)));
}

function localDateKey(value, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function createFocusSession(input = {}, options = {}) {
  const now = iso(options.now);
  const minutes = durationMinutes(input.durationMinutes);
  return {
    id: String(options.id || input.id || globalThis.crypto?.randomUUID?.() || `focus-${Date.now()}`),
    taskId: input.taskId || null,
    title: String(input.title || '').trim(),
    mode: input.mode === 'break' ? 'break' : 'focus',
    durationMinutes: minutes,
    state: 'planned',
    startedAt: null,
    pausedAt: null,
    endedAt: null,
    pausedSeconds: 0,
    actualMinutes: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function focusSnapshot(session, options = {}) {
  const state = session?.state || 'planned';
  const now = iso(options.now);
  if (!session?.startedAt) {
    return { state, remainingSeconds: Number(session?.durationMinutes || 0) * 60, elapsedSeconds: 0 };
  }
  const endpoint = state === 'paused'
    ? session.pausedAt
    : ['completed', 'cancelled'].includes(state) ? session.endedAt : now;
  const elapsedSeconds = Math.max(
    0,
    secondsBetween(session.startedAt, endpoint || now) - Math.max(0, Number(session.pausedSeconds) || 0),
  );
  const totalSeconds = Math.max(60, Number(session.durationMinutes || 25) * 60);
  return { state, remainingSeconds: Math.max(0, totalSeconds - elapsedSeconds), elapsedSeconds };
}

export function transitionFocus(session, action, options = {}) {
  const state = session?.state || 'planned';
  if (!TRANSITIONS[state]?.has(action)) throw new Error(`invalid focus transition: ${state} -> ${action}`);
  const now = iso(options.now);
  if (action === 'start') return { ...session, state: 'running', startedAt: now, updatedAt: now };
  if (action === 'pause') return { ...session, state: 'paused', pausedAt: now, updatedAt: now };
  if (action === 'resume') {
    const pausedSeconds = Math.max(0, Number(session.pausedSeconds) || 0)
      + secondsBetween(session.pausedAt, now);
    return { ...session, state: 'running', pausedAt: null, pausedSeconds, updatedAt: now };
  }
  if (action === 'cancel') return { ...session, state: 'cancelled', endedAt: now, updatedAt: now };

  const snapshot = focusSnapshot(session, { now });
  const ongoingPause = state === 'paused' ? secondsBetween(session.pausedAt, now) : 0;
  return {
    ...session,
    state: 'completed',
    endedAt: now,
    pausedAt: null,
    pausedSeconds: Math.max(0, Number(session.pausedSeconds) || 0) + ongoingPause,
    actualMinutes: Math.max(1, Math.round(snapshot.elapsedSeconds / 60)),
    updatedAt: now,
  };
}

export function applyFocusCompletion(tasks = [], session = {}) {
  if (session.state !== 'completed' || !session.taskId) return tasks.map((task) => ({ ...task }));
  const minutes = Math.max(0, Number(session.actualMinutes) || 0);
  return tasks.map((task) => task.id === session.taskId ? {
    ...task,
    focusMinutes: Math.max(0, Number(task.focusMinutes) || 0) + minutes,
    focusCount: Math.max(0, Number(task.focusCount) || 0) + 1,
  } : { ...task });
}

export function summarizeFocus(sessions = [], options = {}) {
  const now = new Date(options.now || Date.now());
  if (Number.isNaN(now.getTime())) throw new Error('invalid summary timestamp');
  const timeZone = options.timeZone || 'Asia/Shanghai';
  const todayKey = localDateKey(now, timeZone);
  const rollingWeekStart = now.getTime() - (7 * 24 * 60 * 60 * 1000);
  const summary = { today: { minutes: 0, sessions: 0 }, week: { minutes: 0, sessions: 0 } };

  for (const session of sessions) {
    if (session.state !== 'completed' || !session.endedAt) continue;
    const endedAt = new Date(session.endedAt);
    if (Number.isNaN(endedAt.getTime())) continue;
    const minutes = Math.max(0, Number(session.actualMinutes) || 0);
    if (endedAt.getTime() >= rollingWeekStart && endedAt.getTime() <= now.getTime()) {
      summary.week.minutes += minutes;
      summary.week.sessions += 1;
    }
    if (localDateKey(endedAt, timeZone) === todayKey) {
      summary.today.minutes += minutes;
      summary.today.sessions += 1;
    }
  }
  return summary;
}
