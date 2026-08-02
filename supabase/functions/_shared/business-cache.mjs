const SOURCES = ['wanjia', 'huahuo', 'projects'];

export function buildCachedBusinessPayload(rows, requestedSource = 'all', nowMs = Date.now()) {
  const required = requestedSource === 'all' ? SOURCES : [requestedSource];
  const bySource = new Map((Array.isArray(rows) ? rows : []).map((row) => [row?.source, row]));
  const selected = required.map((source) => bySource.get(source));
  if (selected.some((row) => !row || Date.parse(row.expires_at) <= nowMs || row.payload?.mode !== 'read_only')) return null;
  const payload = {};
  for (const row of selected) payload[row.source] = structuredClone(row.payload);
  const fetchedAt = selected.map((row) => row.fetched_at).filter(Boolean).sort().at(0) || null;
  payload.meta = { mode: 'read_only', contractVersion: '1.3', fetchedAt, cache: 'cloud' };
  return payload;
}
