// Obsidian Enterprise Brain — read-only metadata index
//
// Security contract (see docs/data-source-map.md):
//   - The PWA never reads or writes Obsidian file contents.
//   - This module only ever carries METADATA: path, title, tags, mtime,
//     folder and review status. Note bodies are explicitly forbidden.
//   - The cross-device index is stored in Supabase `zos_business_cache`
//     with source = 'brain'. The client is SELECT-only and asserts the
//     payload is marked read_only before trusting it.
//   - Formal knowledge is written only through the Inbox draft + manual
//     review pipeline. This module never writes to the vault.

const REQUIRED_NOTE_KEYS = ['path', 'title', 'tags', 'mtime', 'folder', 'reviewStatus'];

// Fragments that indicate a path must NOT enter the published metadata index.
// Mirrors docs/data-source-map.md "不接入" list: 迁移暂存、恢复快照、
// 未审核 AI 草稿、密码或身份信息，以及所有 agent / system 元数据目录。
const EXCLUDED_FRAGMENTS = [
  '/.git/',
  '/.obsidian/',
  '/.venv/',
  '/.pytest_cache/',
  '/.serena/',
  '/.space/',
  '/.claudian/',
  '/.superpowers/',
  '/.zos-feishu-bridge/',
  '/.worktrees/',
  '/backups/',
  '/outputs/',
  '/scripts/',
  '/work/',
  '/docs/',
  '/tests/',
  '/Tags/',
  '/ReWrite/',
  '/90 📦 归档',
  '/99 ⚙️ 系统管理',
  '归档｜Archive',
  '系统管理｜System',
  '暂存',
  'staging',
  '未审核',
  '恢复快照',
  'backup-',
];

// Agent / meta Markdown files that live at the vault root, not knowledge notes.
const EXCLUDED_ROOT_FILES = new Set([
  'AGENTS.md',
  'CHATGPT.md',
  'CLAUDE.md',
  'COZE.md',
  'DOUBAO.md',
  'GEMINI.md',
  'KIMI.md',
  'README.md',
]);

export function isPathIncluded(relativePath) {
  if (!relativePath) return false;
  const normalized = '/' + relativePath.replace(/\\/g, '/');
  if (EXCLUDED_FRAGMENTS.some((frag) => normalized.includes(frag))) return false;
  const baseName = normalized.split('/').pop();
  if (EXCLUDED_ROOT_FILES.has(baseName)) return false;
  return true;
}

export function extractNoteMetadata({ relativePath, title, tags = [], mtime, folder, reviewStatus }) {
  if (!relativePath) throw new Error('relativePath is required');
  if (!title) throw new Error('title is required');
  if (typeof mtime !== 'number' || Number.isNaN(mtime)) throw new Error('mtime must be a number');
  return {
    path: relativePath,
    title: String(title),
    tags: Array.isArray(tags) ? tags.map(String) : [],
    mtime: mtime,
    folder: folder || topFolder(relativePath),
    reviewStatus: reviewStatus || deriveReviewStatus(relativePath),
  };
}

export function topFolder(relativePath) {
  const parts = relativePath.replace(/\\/g, '/').split('/');
  return parts.length > 1 ? parts[0] : '(root)';
}

// reviewStatus for a note derived from its location in the vault.
// Notes inside the Inbox are drafts; everything else reviewed unless flagged.
export function deriveReviewStatus(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.includes('00 📥 收集箱') || normalized.toLowerCase().includes('inbox')) {
    return 'inbox-draft';
  }
  if (EXCLUDED_FRAGMENTS.some((frag) => normalized.includes(frag))) return 'excluded';
  return 'published';
}

export function buildMetadataIndex(notes, { scannedAt = new Date().toISOString() } = {}) {
  if (!Array.isArray(notes)) throw new Error('notes must be an array');
  const clean = notes
    .filter((n) => n && isPathIncluded(n.path || n.relativePath))
    .map((n) => extractNoteMetadata({
      relativePath: n.path || n.relativePath,
      title: n.title,
      tags: n.tags,
      mtime: n.mtime,
      folder: n.folder,
      reviewStatus: n.reviewStatus || deriveReviewStatus(n.path || n.relativePath),
    }));
  return {
    source: 'brain',
    mode: 'read_only',
    scannedAt,
    notes: clean,
  };
}

// Hard guard: reject any payload that smuggles note content into the index.
export function validateMetadataIndex(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('metadata index must be an object');
  if (obj.mode !== 'read_only') throw new Error('metadata index must be read_only');
  if (obj.source !== 'brain') throw new Error('metadata index source must be brain');
  if (!Array.isArray(obj.notes)) throw new Error('notes must be an array');
  for (const note of obj.notes) {
    for (const key of REQUIRED_NOTE_KEYS) {
      if (!(key in note)) throw new Error(`note missing required key: ${key}`);
    }
    // Content fields are forbidden in the metadata index.
    for (const forbidden of ['content', 'body', 'text', 'markdown']) {
      if (forbidden in note) throw new Error(`metadata note must not contain ${forbidden}`);
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

// SELECT-only client for the brain metadata cache. Mirrors
// business-data-client.mjs: it refuses to trust a payload that is not
// explicitly read_only.
export function createBrainCacheClient({ url, anonKey, getAccessToken = async () => anonKey, fetchImpl = fetch }) {
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
      requestUrl.searchParams.set('source', 'eq.brain');
      requestUrl.searchParams.set('select', 'payload');
      const response = await fetchImpl(requestUrl.toString(), { headers: await authHeaders() });
      if (!response.ok) throw new Error(`Brain cache request failed (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const payload = rows[0] && rows[0].payload;
      if (!payload || payload.mode !== 'read_only') {
        throw new Error('Brain metadata response is not read_only');
      }
      validateMetadataIndex(payload);
      return payload;
    },
  };
}
