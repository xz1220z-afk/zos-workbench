// ZOS Project Center — read-only metadata index
//
// Security contract (see docs/data-source-map.md):
//   - The PWA never reads or writes project KNOWLEDGE bodies.
//   - This module only ever carries METADATA: id, name, type, status,
//     owner, updatedAt, riskLevel and source. Project narratives / docs are
//     explicitly forbidden.
//   - The cross-device index is stored in Supabase `zos_business_cache`
//     with source = 'projects'. The client is SELECT-only and asserts the
//     payload is marked read_only before trusting it.
//   - Source systems (Feishu ERP / local exports) are facts; this module
//     never writes back to them.

export const REQUIRED_PROJECT_KEYS = ['id', 'name', 'type', 'status', 'owner', 'updatedAt', 'riskLevel', 'source'];

// Free-text / body fields that must never enter the read-only project index.
export const FORBIDDEN_PROJECT_FIELDS = ['content', 'body', 'text', 'markdown', 'description', 'detail', 'memo', 'note', 'remark'];

// Canonical status vocabulary used across the cockpit.
export const PROJECT_STATUSES = ['进行中', '已完成', '待启动', '已延期', '风险', '已暂停'];

// Canonical risk levels, ordered for sorting/coloring.
export const RISK_LEVELS = ['低', '中', '高'];

export function normalizeRiskLevel(value) {
  if (!value) return '低';
  const v = String(value).trim();
  if (RISK_LEVELS.includes(v)) return v;
  // Heuristic fallbacks for source-system strings.
  if (/高|high|critical|严重|紧急/.test(v)) return '高';
  if (/中|medium|warn|警示|关注/.test(v)) return '中';
  if (/低|low|ok|正常|安全/.test(v)) return '低';
  return '中';
}

export function deriveRiskFromStatus(status) {
  const s = String(status || '');
  if (s.includes('延期')) return '高';
  if (s.includes('风险')) return '高';
  if (s.includes('暂停')) return '中';
  if (s.includes('待启动')) return '低';
  return '中';
}

export function extractProjectMetadata({
  id,
  name,
  type,
  status,
  owner,
  updatedAt,
  riskLevel,
  source,
}) {
  if (!id) throw new Error('id is required');
  if (!name) throw new Error('name is required');
  if (!type) throw new Error('type is required');
  if (!source) throw new Error('source is required');

  const normalizedStatus = PROJECT_STATUSES.includes(status) ? status : '进行中';
  const derivedRisk = riskLevel ? normalizeRiskLevel(riskLevel) : deriveRiskFromStatus(normalizedStatus);

  let normalizedUpdatedAt = updatedAt;
  if (typeof updatedAt === 'number') {
    normalizedUpdatedAt = new Date(updatedAt).toISOString();
  } else if (typeof updatedAt === 'string' && updatedAt && !/^\d{4}-\d{2}-\d{2}/.test(updatedAt)) {
    const parsed = new Date(updatedAt).toISOString();
    if (parsed !== 'Invalid Date') normalizedUpdatedAt = parsed;
  }

  return {
    id: String(id),
    name: String(name),
    type: String(type),
    status: normalizedStatus,
    owner: owner ? String(owner) : '未指定',
    updatedAt: normalizedUpdatedAt || new Date(0).toISOString(),
    riskLevel: derivedRisk,
    source: String(source),
  };
}

export function buildProjectIndex(projects, { scannedAt = new Date().toISOString() } = {}) {
  if (!Array.isArray(projects)) throw new Error('projects must be an array');
  const clean = projects
    .filter((p) => p && p.id)
    .map((p) => extractProjectMetadata(p));
  return {
    source: 'projects',
    mode: 'read_only',
    scannedAt,
    projects: clean,
  };
}

// Hard guard: reject any payload that smuggles free-text bodies or breaks
// the read-only contract.
export function validateProjectIndex(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('project index must be an object');
  if (obj.mode !== 'read_only') throw new Error('project index must be read_only');
  if (obj.source !== 'projects') throw new Error('project index source must be projects');
  if (!Array.isArray(obj.projects)) throw new Error('projects must be an array');
  for (const project of obj.projects) {
    for (const key of REQUIRED_PROJECT_KEYS) {
      if (!(key in project)) throw new Error(`project missing required key: ${key}`);
    }
    for (const forbidden of FORBIDDEN_PROJECT_FIELDS) {
      if (forbidden in project) throw new Error(`project must not contain ${forbidden}`);
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

// SELECT-only client for the projects metadata cache. Mirrors
// business-data-client.mjs: it refuses to trust a payload that is not
// explicitly read_only.
export function createProjectCacheClient({ url, anonKey, getAccessToken = async () => anonKey, fetchImpl = fetch }) {
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
      requestUrl.searchParams.set('source', 'eq.projects');
      requestUrl.searchParams.set('select', 'payload');
      const response = await fetchImpl(requestUrl.toString(), { headers: await authHeaders() });
      if (!response.ok) throw new Error(`Projects cache request failed (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const payload = rows[0] && rows[0].payload;
      if (!payload || payload.mode !== 'read_only') {
        throw new Error('Projects metadata response is not read_only');
      }
      validateProjectIndex(payload);
      return payload;
    },
  };
}

// Derive cockpit counters from a validated project index. Pure & deterministic
// so it is trivially testable and safe to call on any device.
export function summarizeProjects(index) {
  const projects = (index && index.projects) || [];
  const active = projects.filter((p) => p.status === '进行中');
  const atRisk = projects.filter((p) => p.riskLevel === '高' || p.status === '风险' || p.status === '已延期');
  return {
    total: projects.length,
    active: active.length,
    atRisk: atRisk.length,
    byType: projects.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {}),
  };
}
