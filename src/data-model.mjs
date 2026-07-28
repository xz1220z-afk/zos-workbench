function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function createRecord(fields, options) {
  const timestamp = required(options.now, 'now');
  const deviceId = required(options.deviceId, 'deviceId');
  const id = required(options.id, 'id');

  return {
    id,
    ...fields,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    revision: 1,
    deviceId,
  };
}

export function normalizeRecord(record, options) {
  const timestamp = required(options.now, 'now');
  const deviceId = required(options.deviceId, 'deviceId');
  const id = record.id || required(options.createId, 'createId')();

  return {
    ...record,
    id,
    createdAt: record.createdAt || timestamp,
    updatedAt: record.updatedAt || timestamp,
    deletedAt: record.deletedAt || null,
    revision: Number.isInteger(record.revision) && record.revision > 0 ? record.revision : 1,
    deviceId: record.deviceId || deviceId,
  };
}

export function normalizeCollection(records, options) {
  return records.map((record) => normalizeRecord(record, options));
}

export function touchRecord(record, options) {
  const timestamp = required(options.now, 'now');
  const deviceId = required(options.deviceId, 'deviceId');

  return {
    ...record,
    updatedAt: timestamp,
    revision: (Number.isInteger(record.revision) && record.revision > 0 ? record.revision : 0) + 1,
    deviceId,
  };
}

export function markDeleted(record, options) {
  return {
    ...touchRecord(record, options),
    deletedAt: required(options.now, 'now'),
  };
}

export function selectLatestRecord(left, right) {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt > right.updatedAt ? left : right;
  }
  if (left.revision !== right.revision) {
    return left.revision > right.revision ? left : right;
  }
  return left.deviceId >= right.deviceId ? left : right;
}
