import { fetchBusinessData, fetchWanjiaSchema } from '../business-data-client.mjs?v=2.7.2';
import { createSupabaseAuth } from '../supabase-auth.mjs?v=2.7.2';
import { createSupabaseTransport } from '../supabase-transport.mjs?v=2.7.2';
import { createFeishuApprovalClient } from './feishu-approvals.mjs?v=2.7.2';
import { createOperatingLoop } from './operating-loop.mjs?v=2.7.2';
import { createSyncController } from './sync-controller.mjs?v=2.7.2';
import { createPushClient } from './push-notifications.mjs?v=2.7.2';
import { createAiAssistantClient } from './ai-assistant-client.mjs?v=2.7.2';
import { buildLocalSyncInput, LOCAL_ONLY_ENTITY_TYPES } from '../sync-engine.mjs?v=2.7.2';

const DEFAULT_CONFIG = Object.freeze({
  url: 'https://dtwvyramgbwtlyhmkhkd.supabase.co',
  anonKey: 'sb_publishable_a9d0ekZtcMn6oce51UdV0g_j7_BmVjg',
});

function readJson(storage, key, fallback = {}) {
  try { return JSON.parse(storage.getItem(key) || '') || fallback; } catch { return fallback; }
}

async function upsert(fetchImpl, url, anonKey, token, table, conflict, rows) {
  if (!rows.length) return;
  const endpoint = new URL(`/rest/v1/${table}`, `${url.replace(/\/$/, '')}/`);
  endpoint.searchParams.set('on_conflict', conflict);
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`${table}_persist_failed`);
}

async function loadIntelligenceRows(fetchImpl, config, token, { refresh = false } = {}) {
  const endpoint = new URL('/functions/v1/zos-intelligence-data', `${config.url.replace(/\/$/, '')}/`);
  if (refresh) endpoint.searchParams.set('refresh', 'feishu');
  const response = await fetchImpl(endpoint, { headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('intelligence_read_failed');
  const payload = await response.json();
  if (!Array.isArray(payload.items)) throw new Error('intelligence_contract_invalid');
  return {
    items: payload.items,
    state: payload.state || 'cached',
    sources: payload.sources || {},
    fetchedAt: payload.fetchedAt || null,
  };
}

async function loadExternalCalendar(fetchImpl, config, token, { start, end } = {}) {
  const endpoint = new URL('/functions/v1/zos-calendar-data', `${config.url.replace(/\/$/, '')}/`);
  if (start) endpoint.searchParams.set('start', start);
  if (end) endpoint.searchParams.set('end', end);
  const response = await fetchImpl(endpoint, { headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    let safeCode = 'calendar_read_failed';
    try {
      const payload = await response.json();
      const allowed = new Set([
        'calendar_feishu_auth_failed', 'calendar_feishu_permission_denied',
        'calendar_feishu_failed_stage', 'calendar_configuration_invalid',
        'calendar_read_failed', 'calendar_too_large', 'range_invalid',
      ]);
      if (allowed.has(payload?.error)) safeCode = payload.error;
    } catch { /* Keep the generic safe code. */ }
    throw new Error(safeCode);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.items)) throw new Error('calendar_contract_invalid');
  return {
    items: payload.items,
    state: payload.state || 'synced',
    fetchedAt: payload.fetchedAt || null,
    range: payload.range || null,
  };
}

async function loadKnowledgeContextStatus(fetchImpl, config, token) {
  const endpoint = new URL('/functions/v1/zos-knowledge-context', `${config.url.replace(/\/$/, '')}/`);
  const response = await fetchImpl(endpoint, { headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('knowledge_context_status_failed');
  return response.json();
}

async function saveKnowledgeContext(fetchImpl, config, token, index) {
  const endpoint = new URL('/functions/v1/zos-knowledge-context', `${config.url.replace(/\/$/, '')}/`);
  const response = await fetchImpl(endpoint, {
    method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(index),
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* Safe generic error below. */ }
  if (!response.ok) throw new Error(payload?.error || 'knowledge_context_write_failed');
  return payload;
}

export async function createBrowserOperatingRuntime({
  storage, store, deviceId, now = () => new Date().toISOString(), fetchImpl = globalThis.fetch,
  eventTarget = globalThis, document = globalThis.document, onSyncStatus = () => {}, onSyncConflict = () => {},
} = {}) {
  if (!storage || !store || typeof fetchImpl !== 'function') return null;
  const config = { ...DEFAULT_CONFIG, ...readJson(storage, 'zos_supabase_config') };
  let session = readJson(storage, 'zos_supabase_session');
  if (!session.userId || !session.accessToken) return null;

  if (session.refreshToken) {
    try {
      const refreshed = await createSupabaseAuth({ ...config, fetchImpl }).refreshSession(session.refreshToken);
      session = { ...session, ...refreshed };
      storage.setItem('zos_supabase_session', JSON.stringify(session));
    } catch { /* The existing access token may still be valid; protected calls decide safely. */ }
  }
  const getAccessToken = async () => session.accessToken;
  const transport = createSupabaseTransport({ ...config, getAccessToken, fetchImpl });
  const snapshot = store.load();
  const initialBriefs = (snapshot.collections.inbox || []).filter((item) => item.kind === 'daily_brief');

  const operatingLoop = createOperatingLoop({
    userId: session.userId, deviceId, now,
    refreshBusiness: (source) => fetchBusinessData({
      ...config, accessToken: session.accessToken, source, fetchImpl,
    }),
    approvalClient: createFeishuApprovalClient({ ...config, getAccessToken, fetchImpl }),
    initialState: {
      decisions: snapshot.collections.decisions || [],
      targets: snapshot.collections.targets || [],
      briefs: initialBriefs,
    },
    getTasks: () => store.load().collections.tasks || [],
    saveSnapshots: (rows) => upsert(fetchImpl, config.url, config.anonKey, session.accessToken,
      'zos_business_snapshots', 'user_id,source,metric_key,captured_on', rows.map((row) => ({
        user_id: session.userId, source: row.source, metric_key: row.metricKey,
        metric_value: row.value, source_updated_at: row.sourceUpdatedAt,
        captured_on: row.capturedOn, contract_version: row.contractVersion,
      }))),
    saveHealth: (row) => upsert(fetchImpl, config.url, config.anonKey, session.accessToken,
      'zos_source_health', 'user_id,source', [{
        user_id: session.userId, source: row.source, state: row.state,
        last_success_at: row.lastSuccessAt, last_attempt_at: row.checkedAt,
        record_count: row.recordCount, safe_code: row.safeCode, contract_version: '1.3',
      }]),
  });

  const syncController = createSyncController({
    userId: session.userId, deviceId, transport,
    readState: () => store.load().collections,
    readSyncState: () => buildLocalSyncInput(store.load()),
    writeState: (next) => {
      const current = store.load();
      const remoteCollections = Object.fromEntries(Object.entries(next).filter(([key]) => key !== 'tombstones'));
      for (const entityType of LOCAL_ONLY_ENTITY_TYPES) {
        remoteCollections[entityType] = current.collections[entityType] || [];
      }
      store.replaceSnapshot({
        ...current,
        collections: remoteCollections,
        tombstones: next.tombstones || current.tombstones,
      });
    },
    loadBaseRevisions: () => store.loadBaseRevisions(),
    saveBaseRevisions: (revisions) => store.saveBaseRevisions(revisions),
    eventTarget, visibility: document,
    onStatus: onSyncStatus,
    onConflict: onSyncConflict,
  });

  return {
    operatingLoop, syncController, session,
    pushClient: createPushClient({ ...config, accessToken: session.accessToken, fetchImpl }),
    loadIntelligence: (options) => loadIntelligenceRows(fetchImpl, config, session.accessToken, options),
    loadExternalCalendar: (options) => loadExternalCalendar(fetchImpl, config, session.accessToken, options),
    loadKnowledgeContextStatus: () => loadKnowledgeContextStatus(fetchImpl, config, session.accessToken),
    saveKnowledgeContext: (index) => saveKnowledgeContext(fetchImpl, config, session.accessToken, index),
    aiAssistant: createAiAssistantClient({ ...config, getAccessToken, fetchImpl }),
    diagnoseWanjiaSchema: () => fetchWanjiaSchema({ ...config, accessToken: session.accessToken, fetchImpl }),
  };
}
