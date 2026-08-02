export const SOURCE_HEALTH_STATES = Object.freeze([
  'synced',
  'stale',
  'pending',
  'confirm',
  'conflict',
  'failed',
]);

function safeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function safeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function classifySourceHealth(sample = {}, options = {}) {
  const now = safeText(options.now) || new Date().toISOString();
  const staleAfterMs = Number.isFinite(options.staleAfterMs) && options.staleAfterMs >= 0
    ? options.staleAfterMs
    : 24 * 60 * 60 * 1000;
  const lastSuccessAt = safeText(sample.lastSuccessAt);
  const lastSuccessTime = lastSuccessAt ? new Date(lastSuccessAt).getTime() : Number.NaN;
  const nowTime = new Date(now).getTime();

  let state = 'pending';
  if (sample.conflict === true || sample.state === 'conflict') state = 'conflict';
  else if (sample.requiresConfirmation === true || sample.state === 'confirm') state = 'confirm';
  else if (sample.failed === true || sample.state === 'failed') state = 'failed';
  else if (lastSuccessAt && Number.isFinite(lastSuccessTime) && Number.isFinite(nowTime)) {
    state = nowTime - lastSuccessTime > staleAfterMs ? 'stale' : 'synced';
  }

  return {
    source: safeText(sample.source),
    state,
    recordCount: safeCount(sample.recordCount),
    lastSuccessAt: Number.isFinite(lastSuccessTime) ? lastSuccessAt : null,
    safeCode: safeText(sample.safeCode),
    checkedAt: now,
  };
}

export function healthRecommendation(health = {}) {
  return {
    synced: '数据已同步',
    stale: '数据已过期，请刷新来源',
    pending: '等待首次同步',
    confirm: '存在待确认操作，请人工核对',
    conflict: '发现跨端冲突，请选择保留版本',
    failed: '数据读取失败，请按安全错误码排查',
  }[health.state] || '数据状态未知，请重新检查';
}
