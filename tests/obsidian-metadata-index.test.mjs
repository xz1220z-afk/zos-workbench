import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPathIncluded,
  extractNoteMetadata,
  deriveReviewStatus,
  buildMetadataIndex,
  validateMetadataIndex,
  createBrainCacheClient,
} from '../src/obsidian-metadata-index.mjs';

test('isPathIncluded excludes archive and system folders', () => {
  assert.equal(isPathIncluded('05 💼 工作与商业｜Work/05 01 万嘉网络 Wanjia Network/商家运营.md'), true);
  assert.equal(isPathIncluded('90 📦 归档｜Archive/old.md'), false);
  assert.equal(isPathIncluded('99 ⚙️ 系统管理｜System/secret.md'), false);
  assert.equal(isPathIncluded('.obsidian/workspace.json'), false);
  assert.equal(isPathIncluded('backups/snapshot.json'), false);
  assert.equal(isPathIncluded('00 📥 收集箱｜Inbox/draft.md'), true); // inbox is included but flagged as draft
});

test('isPathIncluded excludes agent meta root files', () => {
  assert.equal(isPathIncluded('AGENTS.md'), false);
  assert.equal(isPathIncluded('CLAUDE.md'), false);
  assert.equal(isPathIncluded('README.md'), false);
});

test('extractNoteMetadata builds clean metadata without content', () => {
  const meta = extractNoteMetadata({
    relativePath: '05 💼 工作与商业｜Work/05 03 花火影像 Huahuo Imaging/项目A.md',
    title: '项目A',
    tags: ['花火', '项目'],
    mtime: 1700000000000,
  });
  assert.equal(meta.title, '项目A');
  assert.deepEqual(meta.tags, ['花火', '项目']);
  assert.equal(meta.folder, '05 💼 工作与商业｜Work');
  assert.equal(meta.reviewStatus, 'published');
  assert.ok(!('content' in meta));
});

test('deriveReviewStatus flags inbox notes as drafts', () => {
  assert.equal(deriveReviewStatus('00 📥 收集箱｜Inbox/idea.md'), 'inbox-draft');
  assert.equal(deriveReviewStatus('03 📚 知识库｜Knowledge Base/note.md'), 'published');
});

test('buildMetadataIndex drops excluded paths and marks drafts', () => {
  const index = buildMetadataIndex([
    { path: '05 💼 工作与商业｜Work/05 01 万嘉网络 Wanjia Network/x.md', title: 'x', tags: [], mtime: 1 },
    { path: '90 📦 归档｜Archive/old.md', title: 'old', tags: [], mtime: 1 },
    { path: '00 📥 收集箱｜Inbox/idea.md', title: 'idea', tags: [], mtime: 2 },
    { path: 'AGENTS.md', title: 'agents', tags: [], mtime: 3 },
  ]);
  assert.equal(index.mode, 'read_only');
  assert.equal(index.source, 'brain');
  assert.equal(index.notes.length, 2); // archive + AGENTS.md dropped
  const idea = index.notes.find((n) => n.path.includes('Inbox'));
  assert.equal(idea.reviewStatus, 'inbox-draft');
});

test('validateMetadataIndex rejects non-read-only payloads', () => {
  assert.throws(() => validateMetadataIndex({ mode: 'write', source: 'brain', notes: [] }), /read_only/);
  assert.throws(() => validateMetadataIndex({ mode: 'read_only', source: 'wanjia', notes: [] }), /brain/);
  assert.throws(() => validateMetadataIndex({ mode: 'read_only', source: 'brain', notes: 'x' }), /array/);
});

test('validateMetadataIndex rejects note bodies (content leak guard)', () => {
  const bad = {
    mode: 'read_only',
    source: 'brain',
    notes: [{ path: 'a.md', title: 'a', tags: [], mtime: 1, folder: 'f', reviewStatus: 'published', content: 'secret' }],
  };
  assert.throws(() => validateMetadataIndex(bad), /content/);
});

test('validateMetadataIndex accepts a clean index', () => {
  const index = buildMetadataIndex([
    { path: '03 📚 知识库｜Knowledge Base/n.md', title: 'n', tags: ['t'], mtime: 1 },
  ]);
  assert.equal(validateMetadataIndex(index), true);
});

test('brain cache client refuses a non-read-only response', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ([{ payload: { mode: 'write', source: 'brain', notes: [] } }]),
  });
  const client = createBrainCacheClient({ url: 'https://x.supabase.co', anonKey: 'k', getAccessToken: async () => 'tok', fetchImpl: fakeFetch });
  await assert.rejects(() => client.fetchIndex(), /read_only/);
});

test('brain cache client returns validated read_only payload', async () => {
  const payload = buildMetadataIndex([
    { path: '03 📚 知识库｜Knowledge Base/n.md', title: 'n', tags: [], mtime: 1 },
  ]);
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ([{ payload }]),
  });
  const client = createBrainCacheClient({ url: 'https://x.supabase.co', anonKey: 'k', getAccessToken: async () => 'tok', fetchImpl: fakeFetch });
  const result = await client.fetchIndex();
  assert.equal(result.mode, 'read_only');
  assert.equal(result.notes.length, 1);
});
