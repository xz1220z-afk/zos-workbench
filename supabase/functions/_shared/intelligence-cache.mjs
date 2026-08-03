const REVIEW_STATES = new Set(['candidate', 'read', 'actioned', 'ignored', 'knowledge_pending']);

export function prepareIntelligenceRows(userId, rows = [], currentStatuses = []) {
  const statusById = new Map(currentStatuses.map((item) => [String(item.external_id || ''), item.status]));
  const unique = new Map();
  for (const item of rows) {
    const externalId = String(item?.external_id || '').trim();
    if (!externalId || unique.has(externalId)) continue;
    const currentStatus = statusById.get(externalId);
    unique.set(externalId, {
      ...item,
      external_id: externalId,
      status: REVIEW_STATES.has(currentStatus) ? currentStatus : 'candidate',
      user_id: userId,
    });
  }
  return [...unique.values()];
}

export function chunkIntelligenceRows(rows = [], size = 50) {
  const safeSize = Math.max(1, Math.min(100, Number(size) || 50));
  const chunks = [];
  for (let index = 0; index < rows.length; index += safeSize) chunks.push(rows.slice(index, index + safeSize));
  return chunks;
}
