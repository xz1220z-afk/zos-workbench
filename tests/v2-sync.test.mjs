import assert from 'node:assert/strict';
import test from 'node:test';
import { createStateStore } from '../src/app/state-store.mjs';
import { applyRemoteSnapshot, buildLocalSyncInput, toCloudRow } from '../src/sync-engine.mjs';

const V2_TYPES = [
  'content_items', 'knowledge_cards', 'reading_items', 'agent_runs', 'social_insights',
  'content_assets', 'brainstorms', 'content_experiments', 'compound_candidates',
];

const EXISTING_CLOUD_TYPES = new Set([
  'tasks', 'inbox', 'projects', 'commands', 'decisions', 'targets',
  'intelligence', 'calendar', 'life', 'focus_sessions', 'countdowns',
]);

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('v2 collections support create update soft delete restore and cloud round-trip', () => {
  let id = 0;
  const store = createStateStore({ storage: memoryStorage(), now: () => '2026-08-06T08:00:00.000Z', deviceId: 'mac', createId: () => `v2-${++id}` });
  for (const entityType of V2_TYPES) {
    const created = store.saveEntity(entityType, { title: entityType });
    const updated = store.saveEntity(entityType, { ...created, title: `${entityType}-updated` });
    assert.equal(updated.revision, 2);
    const deleted = store.deleteEntity(entityType, created.id);
    assert.equal(deleted.entity, entityType);
    assert.equal(store.load().collections[entityType].length, 0);
    store.restoreEntity(entityType, created.id);
    assert.equal(store.load().collections[entityType][0].title, `${entityType}-updated`);
  }
  const local = buildLocalSyncInput(store.load());
  const rows = V2_TYPES.map((entityType) => toCloudRow({ userId: 'owner', entityType, record: local[entityType][0] }));
  assert.equal(rows.every((row) => EXISTING_CLOUD_TYPES.has(row.entity_type)), true);
  assert.deepEqual(rows.map((row) => row.payload._zos_entity_type), V2_TYPES);
  const merged = applyRemoteSnapshot({ local: {}, remoteRows: rows, userId: 'owner' });
  assert.deepEqual(Object.keys(merged.collections).sort(), V2_TYPES.slice().sort());
  assert.equal(JSON.stringify(merged.collections).includes('_zos_entity_type'), false);
});

test('content knowledge and agent edits surface conflicts instead of being overwritten', () => {
  for (const entityType of ['content_items', 'knowledge_cards', 'agent_runs']) {
    const base = { id: 'same', title: 'base', createdAt: '2026-08-06T00:00:00Z', updatedAt: '2026-08-06T00:00:00Z', deletedAt: null, revision: 1, deviceId: 'a' };
    const localRecord = { ...base, title: 'local', updatedAt: '2026-08-06T01:00:00Z', revision: 2 };
    const remoteRecord = { ...base, title: 'remote', updatedAt: '2026-08-06T02:00:00Z', revision: 2, deviceId: 'b' };
    const result = applyRemoteSnapshot({
      local: { [entityType]: [localRecord] },
      remoteRows: [toCloudRow({ userId: 'owner', entityType, record: remoteRecord })],
      userId: 'owner', baseRevisions: { [`${entityType}:same`]: 1 },
    });
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.collections[entityType][0].title, 'local');
  }
});

test('Agent OS identity index and private Agent tasks remain local-only and are never uploaded', () => {
  const local = buildLocalSyncInput({
    collections: {
      agent_os_indexes: [{ id: 'agent-os-current', index: { agents: [{ agentId: 'REL-001' }] } }],
      local_agent_tasks: [{ id: 'private-task', title: '关系关怀草稿', agentContext: { agentId: 'REL-001', knowledgeEntries: ['private/path'] } }],
      tasks: [],
    },
    tombstones: [
      { id: 'agent-os-current', entity: 'agent_os_indexes', deletedAt: '2026-08-07T00:00:00Z' },
      { id: 'private-task', entity: 'local_agent_tasks', deletedAt: '2026-08-07T00:00:00Z' },
    ],
  });
  assert.equal(Object.hasOwn(local, 'agent_os_indexes'), false);
  assert.equal(Object.hasOwn(local, 'local_agent_tasks'), false);
  assert.equal(JSON.stringify(local).includes('private/path'), false);
  assert.deepEqual(local.tasks, []);
});
