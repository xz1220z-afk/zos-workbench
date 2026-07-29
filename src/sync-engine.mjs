import { selectLatestRecord } from './data-model.mjs';

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
  const metadata = canonicalMetadata(record);
  return {
    user_id: userId,
    entity_type: entityType,
    record_id: metadata.id,
    payload: { ...record },
    created_at: metadata.createdAt,
    updated_at: metadata.updatedAt,
    deleted_at: metadata.deletedAt,
    revision: metadata.revision,
    device_id: metadata.deviceId,
  };
}

export function fromCloudRow(row) {
  return {
    ...(row.payload || {}),
    id: required(row.record_id, 'row.record_id'),
    createdAt: required(row.created_at, 'row.created_at'),
    updatedAt: required(row.updated_at, 'row.updated_at'),
    deletedAt: row.deleted_at || null,
    revision: required(row.revision, 'row.revision'),
    deviceId: required(row.device_id, 'row.device_id'),
  };
}

function indexRecords(records) {
  return new Map(records.map((record) => [record.id, record]));
}

export function applyRemoteSnapshot({ local, remoteRows, userId = 'sync-user' }) {
  const remoteByEntity = new Map();
  for (const row of remoteRows) {
    const records = remoteByEntity.get(row.entity_type) || [];
    records.push(fromCloudRow(row));
    remoteByEntity.set(row.entity_type, records);
  }

  const collections = {};
  const tombstones = [];
  const uploads = [];
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
      const winner = !remoteRecord ? localRecord : !localRecord ? remoteRecord : selectLatestRecord(localRecord, remoteRecord);
      if (winner === localRecord && (!remoteRecord || winner !== remoteRecord)) {
        uploads.push(toCloudRow({ userId, entityType, record: winner }));
      }
      if (winner.deletedAt) tombstones.push({ ...winner, entity: entityType });
      else live.push(winner);
    }
    collections[entityType] = live;
  }

  return { collections, tombstones, uploads };
}
