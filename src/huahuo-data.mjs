// ZOS HuaHuo (花火) shooting-projects — read-only metadata index
//
// Security contract (mirrors docs/data-source-map.md):
//   - The PWA NEVER reads or writes project KNOWLEDGE / narrative bodies.
//   - This module only ever carries METADATA: client name, project name,
//     type, shooting date, stage, delivery status, revenue status and
//     profit status. Free-text bodies are explicitly forbidden.
//   - Source system (Feishu 花火 ERP) is a FACT. This module never writes back.
//   - The cross-device index is stored in Supabase `zos_business_cache`
//     with source = 'huahuo'. The client is SELECT-only and asserts the
//     payload is marked read_only before trusting it.

export const REQUIRED_HUAHUO_KEYS = [
  'id', 'clientName', 'projectName', 'projectType', 'shootingDate',
  'stage', 'deliveryStatus', 'revenueStatus', 'profitStatus', 'source',
];

// Free-text / body fields that must never enter the read-only index.
export const FORBIDDEN_HUAHUO_FIELDS = [
  'content', 'body', 'text', 'markdown', 'description', 'detail', 'memo',
  'note', 'remark', '备注', '详情', '正文', 'summary', 'contractText',
  'script', '脚本', '拍摄方案',
];

// Canonical project types (loose, for grouping/coloring only).
export const HUAHUO_TYPES = ['宣传片', '短视频', '电商', '活动', '婚礼', '其他'];

// Canonical stages. "Done" stages are used by the risk detector.
export const HUAHUO_STAGES = ['洽谈中', '筹备中', '拍摄中', '后期中', '交付中', '已结项'];
export const HUAHUO_DONE_STAGES = ['已结项', '已结案', '已完成', '已结束'];

// Canonical delivery / revenue / profit statuses.
export const DELIVERY_STATUSES = ['待交付', '交付中', '已交付', '已验收'];
export const REVENUE_STATUSES = ['已回款', '部分回款', '待回款', '未开始'];
export const PROFIT_STATUSES = ['盈利', '持平', '亏损', '待核算'];

export function normalizeRiskLevel(value) {
  if (!value) return '低';
  const v = String(value).trim();
  if (['低', '中', '高'].includes(v)) return v;
  if (/高|high|critical|严重|紧急|预警|亏/.test(v)) return '高';
  if (/中|medium|warn|警示|关注/.test(v)) return '中';
  if (/低|low|ok|正常|安全|盈/.test(v)) return '低';
  return '中';
}

export function normalizeProjectType(value) {
  if (!value) return '其他';
  const v = String(value).trim();
  if (HUAHUO_TYPES.includes(v)) return v;
  if (/宣传|品牌片|形象片/.test(v)) return '宣传片';
  if (/短/.test(v)) return '短视频';
  if (/电商|带货|商品/.test(v)) return '电商';
  if (/活动|典礼|发布会/.test(v)) return '活动';
  if (/婚礼|婚庆/.test(v)) return '婚礼';
  return '其他';
}

export function normalizeStage(value) {
  if (!value) return '筹备中';
  const v = String(value).trim();
  if (HUAHUO_STAGES.includes(v)) return v;
  if (/谈|初|立项|接洽/.test(v)) return '洽谈中';
  if (/筹备|准备|前期|筹备中/.test(v)) return '筹备中';
  if (/拍摄|外拍/.test(v)) return '拍摄中';
  if (/后期|剪辑|调色/.test(v)) return '后期中';
  if (/交付|提交|送审/.test(v)) return '交付中';
  if (/结项|结案|结束|完/.test(v)) return '已结项';
  return '筹备中';
}

export function normalizeDeliveryStatus(value) {
  if (!value) return '待交付';
  const v = String(value).trim();
  if (DELIVERY_STATUSES.includes(v)) return v;
  if (/已交|已验|完成/.test(v)) return '已交付';
  if (/中|进行/.test(v)) return '交付中';
  if (/未|还没|待/.test(v)) return '待交付';
  return '待交付';
}

export function normalizeRevenueStatus(value) {
  if (!value) return '待回款';
  const v = String(value).trim();
  if (REVENUE_STATUSES.includes(v)) return v;
  if (/已收|回款完成|结清|全款/.test(v)) return '已回款';
  if (/部分|进度|分期|预收/.test(v)) return '部分回款';
  if (/未开始|未启动|还没|无/.test(v)) return '未开始';
  return '待回款';
}

export function normalizeProfitStatus(value) {
  if (!value) return '待核算';
  const v = String(value).trim();
  if (PROFIT_STATUSES.includes(v)) return v;
  if (/盈|赚|正/.test(v)) return '盈利';
  if (/亏|损/.test(v)) return '亏损';
  if (/持|平/.test(v)) return '持平';
  return '待核算';
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

// Extract + normalize a single shooting-project record. Throws on missing id/name.
export function extractHuahuoRecord(raw = {}) {
  if (raw == null || typeof raw !== 'object') throw new Error('huahuo record must be an object');
  const id = raw.id ?? raw.projectId ?? raw.项目ID;
  const projectName = raw.projectName ?? raw.name ?? raw.项目名称;
  if (!id) throw new Error('huahuo record id is required');
  if (!projectName) throw new Error('huahuo record projectName is required');

  return {
    id: String(id),
    clientName: raw.clientName ? String(raw.clientName) : (raw.客户名称 ? String(raw.客户名称) : '未指定'),
    projectName: String(projectName),
    projectType: normalizeProjectType(raw.projectType ?? raw.项目类型),
    shootingDate: normalizeDate(raw.shootingDate ?? raw.拍摄日期),
    stage: normalizeStage(raw.stage ?? raw.当前阶段 ?? raw.项目状态 ?? raw.阶段),
    deliveryStatus: normalizeDeliveryStatus(raw.deliveryStatus ?? raw.交付状态),
    revenueStatus: normalizeRevenueStatus(raw.revenueStatus ?? raw.回款状态 ?? raw.收款状态),
    profitStatus: normalizeProfitStatus(raw.profitStatus ?? raw.利润状态),
    source: 'huahuo',
  };
}

// Build a validated, read_only index payload from a raw record array.
export function buildHuahuoIndex(records = [], { scannedAt = new Date().toISOString() } = {}) {
  if (!Array.isArray(records)) throw new Error('records must be an array');
  const clean = records
    .filter((r) => r && (r.id || r.projectId || r.项目ID))
    .map((r) => extractHuahuoRecord(r));
  return {
    source: 'huahuo',
    mode: 'read_only',
    scannedAt,
    records: clean,
  };
}

// Hard guard: reject any payload that smuggles free-text bodies or breaks
// the read-only contract.
export function validateHuahuoIndex(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('huahuo index must be an object');
  if (obj.mode !== 'read_only') throw new Error('huahuo index must be read_only');
  if (obj.source !== 'huahuo') throw new Error('huahuo index source must be huahuo');
  if (!Array.isArray(obj.records)) throw new Error('records must be an array');
  for (const record of obj.records) {
    for (const key of REQUIRED_HUAHUO_KEYS) {
      if (!(key in record)) throw new Error(`huahuo record missing required key: ${key}`);
    }
    for (const forbidden of FORBIDDEN_HUAHUO_FIELDS) {
      if (forbidden in record) throw new Error(`huahuo record must not contain ${forbidden}`);
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

// SELECT-only client for the huahuo metadata cache. Mirrors wanjia-data.mjs:
// refuses to trust a payload that is not read_only.
export function createHuahuoCacheClient({ url, anonKey, getAccessToken = async () => anonKey, fetchImpl = fetch }) {
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
      requestUrl.searchParams.set('source', 'eq.huahuo');
      requestUrl.searchParams.set('select', 'payload');
      const response = await fetchImpl(requestUrl.toString(), { headers: await authHeaders() });
      if (!response.ok) throw new Error(`HuaHuo cache request failed (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const payload = rows[0] && rows[0].payload;
      if (!payload || payload.mode !== 'read_only' || payload.source !== 'huahuo') {
        throw new Error('HuaHuo metadata response is not read_only');
      }
      validateHuahuoIndex(payload);
      return payload;
    },
  };
}

// Derive cockpit counters from a validated huahuo index. Pure & deterministic.
export function summarizeHuahuoRecords(index) {
  const records = (index && index.records) || [];
  const active = records.filter((r) => !HUAHUO_DONE_STAGES.includes(r.stage));
  const pendingDelivery = records.filter((r) => r.deliveryStatus === '待交付' || r.deliveryStatus === '交付中');
  const revenuePending = records.filter((r) => r.revenueStatus === '待回款' || r.revenueStatus === '未开始');
  const atRisk = records.filter(
    (r) => r.profitStatus === '亏损' || r.revenueStatus === '待回款' || r.deliveryStatus === '待交付',
  );
  const byType = records.reduce((acc, r) => {
    acc[r.projectType] = (acc[r.projectType] || 0) + 1;
    return acc;
  }, {});
  return {
    total: records.length,
    active: active.length,
    pendingDelivery: pendingDelivery.length,
    revenuePending: revenuePending.length,
    atRisk: atRisk.length,
    byType,
  };
}
