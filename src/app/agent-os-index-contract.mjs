export const AGENT_OS_INDEX_SCHEMA_VERSION = 'agent-os-index-v1';

const COLLECTIONS = Object.freeze(['agents', 'skills', 'workflows', 'evaluations', 'logs', 'runbooks']);

function validDate(value) {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function assertCollection(value, name) {
  if (!Array.isArray(value)) throw new Error(`agent_os_index_invalid:${name}`);
  for (const record of value) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`agent_os_index_invalid:${name}`);
    if (Object.hasOwn(record, 'body') || Object.hasOwn(record, 'content') || Object.hasOwn(record, 'markdown')) {
      throw new Error('agent_os_index_body_forbidden');
    }
  }
}

export function validateAgentOsIndex(value) {
  if (!value || value.schemaVersion !== AGENT_OS_INDEX_SCHEMA_VERSION || !validDate(value.generatedAt) || !String(value.sourceRoot || '')) {
    throw new Error('agent_os_index_invalid');
  }
  for (const name of COLLECTIONS) assertCollection(value[name], name);
  return structuredClone(value);
}
