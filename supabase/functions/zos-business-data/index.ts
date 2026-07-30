import { createClient } from 'npm:@supabase/supabase-js@2';

type FeishuRecord = { fields?: Record<string, unknown> };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

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

function fieldsOf(record: FeishuRecord) {
  return record.fields || {};
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

async function getTenantAccessToken(appId: string, appSecret: string) {
  const result = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const payload = await result.json();
  if (!result.ok || payload.code !== 0 || !payload.tenant_access_token) {
    throw new Error('feishu_auth_failed');
  }
  return payload.tenant_access_token as string;
}

async function searchRecords(token: string, appToken: string, tableId: string, fieldNames: string[]) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search?page_size=500`;
  const result = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ field_names: fieldNames }),
  });
  const payload = await result.json();
  if (!result.ok || payload.code !== 0 || !Array.isArray(payload.data?.items)) {
    throw new Error('feishu_read_failed');
  }
  return payload.data.items as FeishuRecord[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return response({ error: 'authentication_required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
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
    const [merchants, projects, deliveries, receipts] = await Promise.all([
      searchRecords(accessToken, FEISHU.wanjia.appToken, FEISHU.wanjia.merchantTable,
        ['商家名称', '是否动销', '支付GMV', '核销GMV', '视频投稿数', '直播场次数', '总预估佣金']),
      searchRecords(accessToken, FEISHU.huahuo.appToken, FEISHU.huahuo.projectTable,
        ['项目名称', '项目状态', '拍摄日期', '合同金额', '已收金额']),
      searchRecords(accessToken, FEISHU.huahuo.appToken, FEISHU.huahuo.deliveryTable,
        ['项目', '计划交付日期', '交付状态', '客户确认状态']),
      searchRecords(accessToken, FEISHU.huahuo.appToken, FEISHU.huahuo.receiptTable,
        ['项目', '收款金额', '收款日期', '收款状态']),
    ]);

    return response({
      wanjia: { summary: summarizeWanjia(merchants) },
      huahuo: { summary: summarizeHuahuo(projects, deliveries, receipts) },
      brain: { state: 'not_configured', note: 'Obsidian bridge not configured' },
      meta: { fetchedAt: new Date().toISOString(), mode: 'read_only' },
    });
  } catch (error) {
    return response({ error: 'source_read_failed' }, 502);
  }
});
