import { fetchBusinessData } from '../business-data-client.mjs';
import { createSupabaseAuth } from '../supabase-auth.mjs';
import { createSupabaseTransport } from '../supabase-transport.mjs';
import { createFeishuApprovalClient } from './feishu-approvals.mjs';
import { createOperatingLoop } from './operating-loop.mjs';
import { createSyncController } from './sync-controller.mjs';

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

export async function createBrowserOperatingRuntime({
  storage, store, deviceId, now = () => new Date().toISOString(), fetchImpl = globalThis.fetch,
  eventTarget = globalThis, document = globalThis.document,
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
    writeState: (next) => {
      const current = store.load();
      store.replaceSnapshot({
        ...current,
        collections: Object.fromEntries(Object.entries(next).filter(([key]) => key !== 'tombstones')),
        tombstones: next.tombstones || current.tombstones,
      });
    },
    loadBaseRevisions: () => store.loadBaseRevisions(),
    saveBaseRevisions: (revisions) => store.saveBaseRevisions(revisions),
    eventTarget, visibility: document,
  });

  return { operatingLoop, syncController, session };
}
