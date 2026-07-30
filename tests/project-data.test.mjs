import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractProjectMetadata,
  normalizeRiskLevel,
  deriveRiskFromStatus,
  buildProjectIndex,
  validateProjectIndex,
  createProjectCacheClient,
  summarizeProjects,
} from '../src/project-data.mjs';

test('extractProjectMetadata builds clean metadata without body fields', () => {
  const meta = extractProjectMetadata({
    id: 'p1',
    name: '万嘉商家运营',
    type: '万嘉商家运营',
    status: '进行中',
    owner: '朱帅',
    updatedAt: '2026-07-30T08:00:00.000Z',
    riskLevel: '低',
    source: 'wanjia',
  });
  assert.equal(meta.name, '万嘉商家运营');
  assert.equal(meta.owner, '朱帅');
  assert.equal(meta.riskLevel, '低');
  assert.equal(meta.source, 'wanjia');
  assert.ok(!('content' in meta));
  assert.ok(!('description' in meta));
});

test('normalizeRiskLevel maps source strings', () => {
  assert.equal(normalizeRiskLevel('高'), '高');
  assert.equal(normalizeRiskLevel('高风险'), '高');
  assert.equal(normalizeRiskLevel('medium'), '中');
  assert.equal(normalizeRiskLevel(''), '低');
  assert.equal(normalizeRiskLevel('unknown'), '中');
});

test('deriveRiskFromStatus maps overdue/risk to high', () => {
  assert.equal(deriveRiskFromStatus('已延期'), '高');
  assert.equal(deriveRiskFromStatus('风险'), '高');
  assert.equal(deriveRiskFromStatus('待启动'), '低');
  assert.equal(deriveRiskFromStatus('进行中'), '中');
});

test('buildProjectIndex drops invalid entries and forces read_only', () => {
  const index = buildProjectIndex([
    { id: 'p1', name: 'A', type: 't', status: '进行中', owner: 'x', updatedAt: '2026-01-01', riskLevel: '低', source: 'wanjia' },
    { id: 'p2', name: 'B', type: 't', status: '风险', owner: 'y', updatedAt: '2026-01-02', source: 'huahuo' },
    { name: 'no-id', type: 't' }, // dropped
  ]);
  assert.equal(index.mode, 'read_only');
  assert.equal(index.source, 'projects');
  assert.equal(index.projects.length, 2);
  const b = index.projects.find((p) => p.id === 'p2');
  assert.equal(b.riskLevel, '高'); // derived from 风险 status
});

test('validateProjectIndex rejects non-read-only payloads', () => {
  assert.throws(() => validateProjectIndex({ mode: 'write', source: 'projects', projects: [] }), /read_only/);
  assert.throws(() => validateProjectIndex({ mode: 'read_only', source: 'wanjia', projects: [] }), /projects/);
  assert.throws(() => validateProjectIndex({ mode: 'read_only', source: 'projects', projects: 'x' }), /array/);
});

test('validateProjectIndex rejects body-field leaks', () => {
  const bad = {
    mode: 'read_only',
    source: 'projects',
    projects: [{ id: 'p1', name: 'A', type: 't', status: '进行中', owner: 'x', updatedAt: '2026-01-01', riskLevel: '低', source: 'wanjia', description: 'secret narrative' }],
  };
  assert.throws(() => validateProjectIndex(bad), /description/);
});

test('validateProjectIndex rejects missing required key', () => {
  const bad = {
    mode: 'read_only',
    source: 'projects',
    projects: [{ id: 'p1', name: 'A', type: 't', status: '进行中', owner: 'x', updatedAt: '2026-01-01', riskLevel: '低' }],
  };
  assert.throws(() => validateProjectIndex(bad), /source/);
});

test('validateProjectIndex accepts a clean index', () => {
  const index = buildProjectIndex([
    { id: 'p1', name: 'A', type: 't', status: '进行中', owner: 'x', updatedAt: '2026-01-01', riskLevel: '低', source: 'wanjia' },
  ]);
  assert.equal(validateProjectIndex(index), true);
});

test('project cache client refuses a non-read-only response', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ([{ payload: { mode: 'write', source: 'projects', projects: [] } }]),
  });
  const client = createProjectCacheClient({ url: 'https://x.supabase.co', anonKey: 'k', getAccessToken: async () => 'tok', fetchImpl: fakeFetch });
  await assert.rejects(() => client.fetchIndex(), /read_only/);
});

test('project cache client returns validated read_only payload', async () => {
  const payload = buildProjectIndex([
    { id: 'p1', name: 'A', type: 't', status: '进行中', owner: 'x', updatedAt: '2026-01-01', riskLevel: '低', source: 'wanjia' },
  ]);
  const fakeFetch = async () => ({ ok: true, json: async () => ([{ payload }]) });
  const client = createProjectCacheClient({ url: 'https://x.supabase.co', anonKey: 'k', getAccessToken: async () => 'tok', fetchImpl: fakeFetch });
  const result = await client.fetchIndex();
  assert.equal(result.mode, 'read_only');
  assert.equal(result.projects.length, 1);
});

test('summarizeProjects derives cockpit counters', () => {
  const index = buildProjectIndex([
    { id: 'p1', name: 'A', type: '万嘉商家运营', status: '进行中', owner: 'x', updatedAt: '2026-01-01', riskLevel: '低', source: 'wanjia' },
    { id: 'p2', name: 'B', type: '花火拍摄', status: '风险', owner: 'y', updatedAt: '2026-01-02', riskLevel: '高', source: 'huahuo' },
    { id: 'p3', name: 'C', type: '政府项目', status: '待启动', owner: 'z', updatedAt: '2026-01-03', riskLevel: '低', source: 'gov' },
  ]);
  const summary = summarizeProjects(index);
  assert.equal(summary.total, 3);
  assert.equal(summary.active, 1); // only 进行中
  assert.equal(summary.atRisk, 1); // p2 风险+高
  assert.equal(summary.byType['花火拍摄'], 1);
});

test('summarizeProjects handles empty index', () => {
  assert.deepEqual(summarizeProjects(null), { total: 0, active: 0, atRisk: 0, byType: {} });
});
