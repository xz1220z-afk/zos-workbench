import { selectLatestRecord } from './data-model.mjs?v=1.11.0';
import { sanitizeSensitiveFields } from './app/sensitive-fields.mjs?v=1.11.0';

export const CRITICAL_ENTITY_TYPES = new Set(['decisions', 'targets']);

function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function canonicalMetadata(record) {
  return {
    id: required(record.id, 'record.id'),
    createdAt: required(record.createdAt, 'record.createdAt'),
    updatedAt: required(record.updatedAt, 'record.updatedAt'),
    deletedAt: record.deletedAt || null,
    revision: required(record.revision, 'record.revision'),
    deviceId: required(record.deviceId, 'record.deviceId'),
  };
}

export function toCloudRow({ userId, entityType, record }) {
  required(userId, 'userId');
  required(entityType, 'entityType');
  const safeRecord = sanitizeSensitiveFields(record);
  const metadata = canonicalMetadata(safeRecord);
  return {
    user_id: userId,
    entity_type: entityType,
    record_id: metadata.id,
    payload: { ...safeRecord },
    created_at: metadata.createdAt,
    updated_at: metadata.updatedAt,
    deleted_at: metadata.deletedAt,
    revision: metadata.revision,
    device_id: metadata.deviceId,
  };
}

export function fromCloudRow(row) {
  return {
    ...sanitizeSensitiveFields(row.payload || {}),
    id: required(row.record_id, 'row.record_id'),
    createdAt: required(row.created_at, 'row.created_at'),
    updatedAt: required(row.updated_at, 'row.updated_at'),
    deletedAt: row.deleted_at || null,
    revision: required(row.revision, 'row.revision'),
    deviceId: required(row.device_id, 'row.device_id'),
  };
}

export function buildLocalSyncInput(snapshot = {}) {
  const collections = Object.fromEntries(Object.entries(snapshot.collections || {})
    .map(([entityType, records]) => [entityType, Array.isArray(records) ? records.slice() : []]));
  for (const tombstone of Array.isArray(snapshot.tombstones) ? snapshot.tombstones : []) {
    const entityType = String(tombstone?.entity || '').trim();
    if (!entityType || !tombstone?.id) continue;
    const records = collections[entityType] || [];
    collections[entityType] = [...records.filter((record) => record.id !== tombstone.id), tombstone];
  }
  return collections;
}

function indexRecords(records) {
  return new Map(records.map((record) => [record.id, record]));
}

function businessPayload(record) {
  const { createdAt, updatedAt, deletedAt, revision, deviceId, ...payload } = record || {};
  return payload;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function payloadsDiffer(left, right) {
  return JSON.stringify(stableValue(businessPayload(left)))
    !== JSON.stringify(stableValue(businessPayload(right)));
}

function authoritativeTombstone(left, right) {
  if (!left?.deletedAt && !right?.deletedAt) return null;
  if (left?.deletedAt && right?.deletedAt) return selectLatestRecord(left, right);
  const deleted = left?.deletedAt ? left : right;
  const live = left?.deletedAt ? right : left;
  return (deleted?.revision || 0) >= (live?.revision || 0) ? deleted : null;
}

export function applyRemoteSnapshot({ local, remoteRows, userId = 'sync-user', baseRevisions = {} }) {
  const remoteByEntity = new Map();
  for (const row of remoteRows) {
    const records = remoteByEntity.get(row.entity_type) || [];
    records.push(fromCloudRow(row));
    remoteByEntity.set(row.entity_type, records);
  }

  const collections = {};
  const tombstones = [];
  const uploads = [];
  const conflicts = [];
  const nextBaseRevisions = { ...baseRevisions };
  const entityTypes = new Set([...Object.keys(local), ...remoteByEntity.keys()]);
  for (const entityType of entityTypes) {
    const localRecords = local[entityType] || [];
    const localById = indexRecords(localRecords);
    const remoteById = indexRecords(remoteByEntity.get(entityType) || []);
    const ids = new Set([...localById.keys(), ...remoteById.keys()]);
    const live = [];

    for (const id of ids) {
      const localRecord = localById.get(id);
      const remoteRecord = remoteById.get(id);
      const recordKey = `${entityType}:${id}`;
      const tombstone = authoritativeTombstone(localRecord, remoteRecord);
      if (tombstone) {
        tombstones.push({ ...tombstone, entity: entityType });
        nextBaseRevisions[recordKey] = Math.max(localRecord?.revision || 0, remoteRecord?.revision || 0);
        if (tombstone === localRecord && !remoteRecord?.deletedAt) {
          uploads.push(toCloudRow({ userId, entityType, record: tombstone }));
        }
        continue;
      }

      const baseRevision = baseRevisions[recordKey];
      const isConcurrentCriticalEdit = CRITICAL_ENTITY_TYPES.has(entityType)
        && localRecord
        && remoteRecord
        && Number.isInteger(baseRevision)
        && localRecord.revision > baseRevision
        && remoteRecord.revision > baseRevision
        && payloadsDiffer(localRecord, remoteRecord);
      if (isConcurrentCriticalEdit) {
        conflicts.push({
          id: recordKey,
          entityType,
          recordId: id,
          baseRevision,
          local: localRecord,
          remote: remoteRecord,
        });
        live.push(localRecord);
        continue;
      }

      const winner = !remoteRecord ? localRecord : !localRecord ? remoteRecord : selectLatestRecord(localRecord, remoteRecord);
      if (winner === localRecord && (!remoteRecord || winner !== remoteRecord)) {
        uploads.push(toCloudRow({ userId, entityType, record: winner }));
      }
      live.push(winner);
      nextBaseRevisions[recordKey] = Math.max(localRecord?.revision || 0, remoteRecord?.revision || 0);
    }
    collections[entityType] = live;
  }

  return { collections, tombstones, uploads, conflicts, baseRevisions: nextBaseRevisions };
}

export const mergeRemoteSnapshot = applyRemoteSnapshot;

export function resolveConflict(conflict, choice, options = {}) {
  if (!['local', 'remote', 'merge'].includes(choice)) throw new Error('choice must be local, remote or merge');
  const now = required(options.now, 'now');
  const deviceId = required(options.deviceId, 'deviceId');
  let selected = conflict?.[choice];
  if (choice === 'merge') {
    const merged = options.merged;
    if (!merged || typeof merged !== 'object' || Array.isArray(merged)) throw new Error('merged fields are required');
    const protectedKeys = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'revision', 'deviceId', 'entity']);
    const businessFields = sanitizeSensitiveFields(Object.fromEntries(Object.entries(merged).filter(([key]) => !protectedKeys.has(key))));
    selected = { ...conflict.local, ...businessFields };
  }
  if (!selected) throw new Error(`conflict.${choice} is required`);
  return sanitizeSensitiveFields({
    ...selected,
    updatedAt: now,
    revision: Math.max(conflict.local?.revision || 0, conflict.remote?.revision || 0) + 1,
    deviceId,
  });
}
