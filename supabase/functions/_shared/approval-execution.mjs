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

function equalValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export async function executeApproval({
  approval,
  currentRecord,
  computeSnapshotHash,
  updateRecord,
  readRecord,
}) {
  if (!approval || !currentRecord?.fields || !Object.hasOwn(currentRecord.fields, approval.fieldName)) {
    return { status: 'failed', verified: false, safeCode: 'field_unavailable' };
  }
  const currentHash = await computeSnapshotHash(approval, currentRecord);
  if (currentHash !== approval.snapshotHash) {
    return { status: 'failed', verified: false, safeCode: 'source_changed' };
  }

  try {
    await updateRecord(approval.fieldName, approval.after);
  } catch {
    return { status: 'failed', verified: false, safeCode: 'feishu_write_failed' };
  }

  let readback;
  try {
    readback = await readRecord();
  } catch {
    return { status: 'failed', verified: false, safeCode: 'feishu_readback_failed' };
  }
  if (!readback?.fields || !equalValue(readback.fields[approval.fieldName], approval.after)) {
    return { status: 'failed', verified: false, safeCode: 'feishu_readback_failed' };
  }
  return {
    status: 'executed',
    verified: true,
    safeCode: null,
    readback: { fieldName: approval.fieldName, value: readback.fields[approval.fieldName] },
  };
}
