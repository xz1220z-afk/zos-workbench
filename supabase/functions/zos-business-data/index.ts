import { createClient } from 'npm:@supabase/supabase-js@2';

type FeishuRecord = { fields?: Record<string, unknown> };
type FeishuPayload = { code?: number; tenant_access_token?: unknown; data?: { items?: unknown } };
type FeishuFailureReason = 'feishu_auth_failed' | 'feishu_read_failed' | 'feishu_request_failed';

class FeishuRequestError extends Error {
  constructor(readonly reason: FeishuFailureReason) {
    super(reason);
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

function feishuFetch(url: string, init: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
}

const FEISHU = {
  wanjia: {
    appToken: 'AWFUwAbItiI4TjkPMErcpv5Onab',
    merchantTable: 'tblrI2MjVtlOgpe7',
  },
  huahuo: {
    appToken: 'EqzkwDOMEigNflkDoJdcw7FSn4d',
    projectTable: 'tblZ2QIcA2ESJx4W',
    deliveryTable: 'tbl3FeKyg3Tvrm0j',
    receiptTable: 'tblllwWwvrEFgfJM',
  },
} as const;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function configuredPublishableKey() {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacyKey) return legacyKey;

  const rawKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (!rawKeys) return null;
  try {
    const keys = JSON.parse(rawKeys);
    if (typeof keys?.default === 'string') return keys.default;
    const firstKey = Object.values(keys || {}).find((value) => typeof value === 'string');
    return typeof firstKey === 'string' ? firstKey : null;
  } catch {
    return null;
  }
}

function fieldsOf(record: FeishuRecord) {
  return record.fields || {};
}

// Try multiple candidate column names for a field, returning the first
// non-empty value. Keeps the index resilient to minor Feishu schema drift.
function pick(record: FeishuRecord, ...names: string[]): unknown {
  const f = fieldsOf(record);
  for (const name of names) {
    const v = f[name];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function numberOf(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(records: FeishuRecord[], field: string) {
  return records.reduce((total, record) => total + numberOf(fieldsOf(record)[field]), 0);
}

function summarizeWanjia(records: FeishuRecord[]) {
  return {
    totalMerchants: records.length,
    activeMerchants: records.filter((record) => {
      const value = fieldsOf(record)['是否动销'];
      return value === true || value === '是' || value === '已动销';
    }).length,
    paymentGmv: sum(records, '支付GMV'),
    redeemedGmv: sum(records, '核销GMV'),
    videoPosts: sum(records, '视频投稿数'),
    liveSessions: sum(records, '直播场次数'),
    estimatedCommission: sum(records, '总预估佣金'),
  };
}

function summarizeHuahuo(projects: FeishuRecord[], deliveries: FeishuRecord[], receipts: FeishuRecord[]) {
  const contractAmount = sum(projects, '合同金额');
  const receivedAmount = receipts
    .filter((record) => fieldsOf(record)['收款状态'] === '已收款')
    .reduce((total, record) => total + numberOf(fieldsOf(record)['收款金额']), 0);
  return {
    activeProjects: projects.filter((record) => fieldsOf(record)['项目状态'] === '进行中').length,
    pendingDeliveries: deliveries.filter((record) => fieldsOf(record)['交付状态'] === '待交付').length,
    contractAmount,
    receivedAmount,
    outstandingAmount: Math.max(0, contractAmount - receivedAmount),
  };
}

// Build a read-only WanJia merchant-operations record index from the Feishu
// merchant table. Only METADATA is carried — never merchant narratives. The
// payload is always flagged mode: 'read_only' and is meant to be cached into
// `zos_business_cache` (source = 'wanjia') for the PWA to SELECT.
function buildWanjiaRecords(records: FeishuRecord[]): unknown {
  return {
    source: 'wanjia',
    mode: 'read_only',
    scannedAt: new Date().toISOString(),
    records: records.map((record, idx) => {
      const f = fieldsOf(record);
      return {
        id: String(pick(f, '商家ID', '记录ID', 'RecordId') || `wanjia-${idx}`),
        merchantName: String(f['商家名称'] || '未知商家'),
        cooperationType: String(pick(f, '合作类型', '业务类型') || '其他'),
        stage: String(pick(f, '当前阶段', '阶段', '合作阶段') || '执行中'),
        owner: String(pick(f, '项目负责人', '负责人', '对接人') || '未指定'),
        updatedAt: String(pick(f, '最近更新时间', '更新时间', '修改时间') || new Date().toISOString()),
        nextAction: String(pick(f, '下一步动作', '待办事项', '后续动作') || ''),
        riskLevel: String(pick(f, '风险等级', '风险') || '低'),
        revenueStatus: String(pick(f, '收入状态', '收款状态', '回款状态') || '待收款'),
      };
    }),
  };
}

// Build a read-only HuaHuo shooting-project record index from the Feishu
// project table. Only METADATA is carried — never project narratives/bodies.
// The payload is always flagged mode: 'read_only' and is meant to be cached
// into `zos_business_cache` (source = 'huahuo') for the PWA to SELECT.
function buildHuahuoRecords(records: FeishuRecord[]): unknown {
  return {
    source: 'huahuo',
    mode: 'read_only',
    scannedAt: new Date().toISOString(),
    records: records.map((record, idx) => {
      const f = fieldsOf(record);
      const shootingDate = String(pick(f, '拍摄日期', '外拍日期') || new Date().toISOString());
      // P1 hotfix (v1.2.1): huahuo records must carry updatedAt so the risk
      // detector can compute stale/stuck days without producing Infinity.
      // Prefer the Feishu project update-time field; fall back to shootingDate.
      const updatedAt = String(pick(f, '最近更新时间', '更新时间') || shootingDate);
      return {
        id: String(pick(f, '项目ID', 'RecordId') || `huahuo-${idx}`),
        clientName: String(pick(f, '客户名称', '客户') || '未指定'),
        projectName: String(f['项目名称'] || '花火项目'),
        projectType: String(pick(f, '项目类型') || '其他'),
        shootingDate,
        updatedAt,
        stage: String(pick(f, '项目状态', '当前阶段', '阶段') || '筹备中'),
        deliveryStatus: String(pick(f, '交付状态', '交付进度') || '待交付'),
        revenueStatus: String(pick(f, '回款状态', '收款状态') || '待回款'),
        profitStatus: String(pick(f, '利润状态', '利润') || '待核算'),
      };
    }),
  };
}

// Build a read-only project metadata index from the (fact-source) Feishu tables.
// Only METADATA is carried — never project narratives/bodies. The payload is
// always flagged mode: 'read_only' and is meant to be cached into
// `zos_business_cache` (source = 'projects') for the PWA to SELECT.
function buildProjectsSource(huahuoProjects: FeishuRecord[], merchants: FeishuRecord[]): unknown {
  const projects = huahuoProjects.map((record, idx) => {
    const f = fieldsOf(record);
    const status = String(f['项目状态'] || '进行中');
    const riskFromStatus = status.includes('延期') || status.includes('风险') ? '高' : '中';
    return {
      id: `huahuo-${idx}`,
      name: String(f['项目名称'] || '花火项目'),
      type: '花火拍摄',
      status,
      owner: f['负责人'] ? String(f['负责人']) : '花火团队',
      updatedAt: f['拍摄日期'] ? String(f['拍摄日期']) : new Date().toISOString(),
      riskLevel: riskFromStatus,
      source: 'huahuo',
    };
  });
  const activeMerchants = merchants.filter((record) => {
    const v = fieldsOf(record)['是否动销'];
    return v === true || v === '是' || v === '已动销';
  }).length;
  projects.push({
    id: 'wanjia-ops',
    name: '万嘉商家运营',
    type: '万嘉商家运营',
    status: '进行中',
    owner: '运营组',
    updatedAt: new Date().toISOString(),
    riskLevel: activeMerchants > 0 ? '低' : '中',
    source: 'wanjia',
  });
  return {
    source: 'projects',
    mode: 'read_only',
    scannedAt: new Date().toISOString(),
    projects,
  };
}

async function getTenantAccessToken(appId: string, appSecret: string) {
  const result = await feishuFetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  let payload: FeishuPayload | null = null;
  try { payload = await result.json() as FeishuPayload; } catch { /* Safely classify the failed auth response below. */ }
  if (!result.ok || payload?.code !== 0 || !payload.tenant_access_token) {
    throw new FeishuRequestError('feishu_auth_failed');
  }
  return payload?.tenant_access_token as string;
}

async function searchRecords(token: string, appToken: string, tableId: string, fieldNames: string[]) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search?page_size=500`;
  const result = await feishuFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ field_names: fieldNames }),
  });
  let payload: FeishuPayload | null = null;
  try { payload = await result.json() as FeishuPayload; } catch { /* Safely classify the failed table-read response below. */ }
  if (!result.ok || payload?.code !== 0 || !Array.isArray(payload?.data?.items)) {
    throw new FeishuRequestError('feishu_read_failed');
  }
  return payload?.data?.items as FeishuRecord[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);

  const requestedSource = new URL(req.url).searchParams.get('source') || 'all';
  if (!['all', 'wanjia', 'huahuo', 'projects'].includes(requestedSource)) {
    return response({ error: 'invalid_source' }, 400);
  }

  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return response({ error: 'authentication_required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = configuredPublishableKey();
  if (!supabaseUrl || !publishableKey) return response({ error: 'service_not_configured' }, 503);

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return response({ error: 'authentication_invalid' }, 401);

  const appId = Deno.env.get('FEISHU_APP_ID');
  const appSecret = Deno.env.get('FEISHU_APP_SECRET');
  if (!appId || !appSecret) return response({ error: 'source_not_configured' }, 503);

  try {
    const accessToken = await getTenantAccessToken(appId, appSecret);
    const needsWanjia = requestedSource === 'all' || requestedSource === 'wanjia' || requestedSource === 'projects';
    const needsHuahuo = requestedSource === 'all' || requestedSource === 'huahuo' || requestedSource === 'projects';
    const merchants = needsWanjia
      ? await searchRecords(accessToken, FEISHU.wanjia.appToken, FEISHU.wanjia.merchantTable,
        ['商家名称', '是否动销', '支付GMV', '核销GMV', '视频投稿数', '直播场次数', '总预估佣金',
         '合作类型', '当前阶段', '项目负责人', '最近更新时间', '下一步动作', '风险等级', '收入状态'])
      : [];
    const [projects, deliveries, receipts] = needsHuahuo ? await Promise.all([
      searchRecords(accessToken, FEISHU.huahuo.appToken, FEISHU.huahuo.projectTable,
        ['项目名称', '项目状态', '拍摄日期', '合同金额', '已收金额', '负责人',
         '项目类型', '回款状态', '利润状态', '最近更新时间', '更新时间']),
      searchRecords(accessToken, FEISHU.huahuo.appToken, FEISHU.huahuo.deliveryTable,
        ['项目', '计划交付日期', '交付状态', '客户确认状态']),
      searchRecords(accessToken, FEISHU.huahuo.appToken, FEISHU.huahuo.receiptTable,
        ['项目', '收款金额', '收款日期', '收款状态']),
    ]) : [[], [], []];

    return response({
      wanjia: { summary: summarizeWanjia(merchants), records: buildWanjiaRecords(merchants) },
      huahuo: { summary: summarizeHuahuo(projects, deliveries, receipts), records: buildHuahuoRecords(projects) },
      projects: buildProjectsSource(projects, merchants),
      brain: { state: 'not_configured', note: 'Obsidian bridge not configured' },
      meta: { fetchedAt: new Date().toISOString(), mode: 'read_only' },
    });
  } catch (error) {
    const reason: FeishuFailureReason = error instanceof FeishuRequestError
      ? error.reason
      : 'feishu_request_failed';
    console.error(JSON.stringify({ event: 'zos_business_data_failed', reason }));
    return response({ error: 'source_read_failed', reason }, 502);
  }
});
