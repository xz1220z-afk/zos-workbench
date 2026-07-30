// ZOS WanJia (万嘉) merchant-operations — read-only metadata index
//
// Security contract (mirrors docs/data-source-map.md):
//   - The PWA NEVER reads or writes merchant KNOWLEDGE / narrative bodies.
//   - This module only ever carries METADATA: merchant name, cooperation type,
//     stage, owner, updatedAt, nextAction, riskLevel and revenueStatus.
//     Free-text bodies are explicitly forbidden.
//   - Source system (Feishu 万嘉 ERP) is a FACT. This module never writes back.
//   - The cross-device index is stored in Supabase `zos_business_cache`
//     with source = 'wanjia'. The client is SELECT-only and asserts the
//     payload is marked read_only before trusting it.

export const REQUIRED_WANJIA_KEYS = [
  'id', 'merchantName', 'cooperationType', 'stage', 'owner',
  'updatedAt', 'nextAction', 'riskLevel', 'revenueStatus', 'source',
];

// Free-text / body fields that must never enter the read-only index.
export const FORBIDDEN_WANJIA_FIELDS = [
  'content', 'body', 'text', 'markdown', 'description', 'detail', 'memo',
  'note', 'remark', '备注', '详情', '正文', 'summary', 'contractText',
];

// Canonical cooperation types (loose, for grouping/coloring only).
export const COOPERATION_TYPES = ['团购', '直播', '短视频', '门店', '品牌', '其他'];

// Canonical stages. "Done" stages are used by the risk detector.
export const WANJIA_STAGES = ['洽谈中', '执行中', '复盘', '已结束'];
export const WANJIA_DONE_STAGES = ['已结束', '已结案', '已完成'];

// Canonical revenue statuses.
export const REVENUE_STATUSES = ['已收款', '部分收款', '待收款', '未开始'];

export function normalizeRiskLevel(value) {
  if (!value) return '低';
  const v = String(value).trim();
  if (['低', '中', '高'].includes(v)) return v;
  if (/高|high|critical|严重|紧急|预警/.test(v)) return '高';
  if (/中|medium|warn|警示|关注/.test(v)) return '中';
  if (/低|low|ok|正常|安全/.test(v)) return '低';
  return '中';
}

export function normalizeCooperationType(value) {
  if (!value) return '其他';
  const v = String(value).trim();
  if (COOPERATION_TYPES.includes(v)) return v;
  if (/团购|拼团|核销/.test(v)) return '团购';
  if (/直播/.test(v)) return '直播';
  if (/短视频|视频|抖音|快手/.test(v)) return '短视频';
  if (/门店|线下|到店/.test(v)) return '门店';
  if (/品牌/.test(v)) return '品牌';
  return '其他';
}

export function normalizeStage(value) {
  if (!value) return '执行中';
  const v = String(value).trim();
  if (WANJIA_STAGES.includes(v)) return v;
  if (/谈|初|立项|接洽/.test(v)) return '洽谈中';
  if (/执行|进行|运营|推进|交付中/.test(v)) return '执行中';
  if (/复盘|总结|回访/.test(v)) return '复盘';
  if (/结束|完|结案|终止/.test(v)) return '已结束';
  return '执行中';
}

export function normalizeRevenueStatus(value) {
  if (!value) return '待收款';
  const v = String(value).trim();
  if (REVENUE_STATUSES.includes(v)) return v;
  if (/已收|结清|完成|全款/.test(v)) return '已收款';
  if (/部分|进度|分期|预收/.test(v)) return '部分收款';
  if (/未开始|未启动|还没|无/.test(v)) return '未开始';
  return '待收款';
}

function normalizeDate(value) {
  if (!value) return new Date(0).toISOString();
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.length === 10 ? `${s}T00:00:00.000Z` : s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

// Extract + normalize a single merchant-operation record. Throws on missing id/name.
export function extractWanjiaRecord(raw = {}) {
  if (raw == null || typeof raw !== 'object') throw new Error('wanjia record must be an object');
  const id = raw.id ?? raw.merchantId ?? raw.商家ID;
  const merchantName = raw.merchantName ?? raw.name ?? raw.商家名称;
  if (!id) throw new Error('wanjia record id is required');
  if (!merchantName) throw new Error('wanjia record merchantName is required');

  return {
    id: String(id),
    merchantName: String(merchantName),
    cooperationType: normalizeCooperationType(raw.cooperationType ?? raw.合作类型),
    stage: normalizeStage(raw.stage ?? raw.当前阶段 ?? raw.阶段),
    owner: raw.owner ? String(raw.owner) : (raw.项目负责人 ? String(raw.项目负责人) : '未指定'),
    updatedAt: normalizeDate(raw.updatedAt ?? raw.最近更新时间 ?? raw.更新时间),
    nextAction: raw.nextAction ? String(raw.nextAction) : (raw.下一步动作 ? String(raw.下一步动作) : ''),
    riskLevel: normalizeRiskLevel(raw.riskLevel ?? raw.风险等级),
    revenueStatus: normalizeRevenueStatus(raw.revenueStatus ?? raw.收入状态 ?? raw.回款状态),
    source: 'wanjia',
  };
}

// Build a validated, read_only index payload from a raw record array.
export function buildWanjiaIndex(records = [], { scannedAt = new Date().toISOString() } = {}) {
  if (!Array.isArray(records)) throw new Error('records must be an array');
  const clean = records
    .filter((r) => r && (r.id || r.merchantId || r.商家ID))
    .map((r) => extractWanjiaRecord(r));
  return {
    source: 'wanjia',
    mode: 'read_only',
    scannedAt,
    records: clean,
  };
}

// Hard guard: reject any payload that smuggles free-text bodies or breaks
// the read-only contract.
export function validateWanjiaIndex(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('wanjia index must be an object');
  if (obj.mode !== 'read_only') throw new Error('wanjia index must be read_only');
  if (obj.source !== 'wanjia') throw new Error('wanjia index source must be wanjia');
  if (!Array.isArray(obj.records)) throw new Error('records must be an array');
  for (const record of obj.records) {
    for (const key of REQUIRED_WANJIA_KEYS) {
      if (!(key in record)) throw new Error(`wanjia record missing required key: ${key}`);
    }
    for (const forbidden of FORBIDDEN_WANJIA_FIELDS) {
      if (forbidden in record) throw new Error(`wanjia record must not contain ${forbidden}`);
    }
  }
  return true;
}

function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function endpoint(baseUrl, path) {
  return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString();
}

// SELECT-only client for the wanjia metadata cache. Mirrors
// project-data.mjs: refuses to trust a payload that is not read_only.
export function createWanjiaCacheClient({ url, anonKey, getAccessToken = async () => anonKey, fetchImpl = fetch }) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  required(fetchImpl, 'fetchImpl');

  async function authHeaders() {
    const accessToken = await getAccessToken();
    required(accessToken, 'accessToken');
    return { apikey: anonKey, Authorization: `Bearer ${accessToken}` };
  }

  return {
    async fetchIndex() {
      const requestUrl = new URL(endpoint(url, '/rest/v1/zos_business_cache'));
      requestUrl.searchParams.set('source', 'eq.wanjia');
      requestUrl.searchParams.set('select', 'payload');
      const response = await fetchImpl(requestUrl.toString(), { headers: await authHeaders() });
      if (!response.ok) throw new Error(`Wanjia cache request failed (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const payload = rows[0] && rows[0].payload;
      if (!payload || payload.mode !== 'read_only' || payload.source !== 'wanjia') {
        throw new Error('Wanjia metadata response is not read_only');
      }
      validateWanjiaIndex(payload);
      return payload;
    },
  };
}

// Derive cockpit counters from a validated wanjia index. Pure & deterministic.
export function summarizeWanjiaRecords(index) {
  const records = (index && index.records) || [];
  const active = records.filter((r) => !WANJIA_DONE_STAGES.includes(r.stage));
  const atRisk = records.filter((r) => r.riskLevel === '高' || r.revenueStatus === '待收款');
  const revenuePending = records.filter((r) => r.revenueStatus === '待收款' || r.revenueStatus === '未开始');
  const byCooperationType = records.reduce((acc, r) => {
    acc[r.cooperationType] = (acc[r.cooperationType] || 0) + 1;
    return acc;
  }, {});
  return {
    total: records.length,
    active: active.length,
    atRisk: atRisk.length,
    revenuePending: revenuePending.length,
    byCooperationType,
  };
}
