const COMMAND_STATES = new Set([
  'idle', 'listening', 'transcribing', 'routing', 'answering',
  'preview_required', 'executing', 'completed', 'failed', 'unsupported', 'permission_denied',
]);

function stringList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function sources(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((source) => {
    if (typeof source === 'string') return source.trim() ? [source.trim()] : [];
    if (!source || typeof source !== 'object') return [];
    const label = String(source.label || source.title || source.name || '').trim();
    return label ? [{ label, date: String(source.date || source.updatedAt || '').trim() }] : [];
  });
}

export function createAiCommand(input, options = {}) {
  return {
    id: options.id || globalThis.crypto?.randomUUID?.() || `cmd-${Date.now().toString(36)}`,
    input: String(input || '').trim(),
    scope: options.scope || 'auto',
    state: 'idle',
    createdAt: options.now || new Date().toISOString(),
    error: null,
  };
}

export function transitionAiCommand(command, state, changes = {}) {
  if (!COMMAND_STATES.has(state)) throw new Error('invalid_ai_command_state');
  return { ...command, ...changes, state };
}

export function normalizeAiCommandResult(payload = {}, context = {}) {
  const answer = String(payload.answer || '').trim();
  const facts = stringList(payload.facts);
  const advice = stringList(payload.advice);
  return {
    task: String(context.task || '').trim(),
    answer,
    sources: sources(payload.sources),
    sections: {
      facts,
      inference: stringList(payload.inference),
      advice: advice.length ? advice : answer ? [answer] : [],
      pending: stringList(payload.pending),
      next: stringList(payload.next),
    },
    execution: {
      level: context.execution?.level || 'L0',
      actions: Array.isArray(context.execution?.actions) ? context.execution.actions : [],
    },
  };
}

export function sanitizeAiActivity(command = {}) {
  return {
    id: command.id,
    scope: command.scope,
    state: command.state,
    createdAt: command.createdAt,
  };
}
