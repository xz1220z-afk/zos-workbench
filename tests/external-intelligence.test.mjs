import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ExternalIntelligenceError,
  buildAihotUrl,
  mapAihotItem,
  readAihotSource,
} from '../supabase/functions/_shared/external-intelligence.mjs';

test('AI HOT request is limited to a rolling 24 hour selected window', () => {
  const url = new URL(buildAihotUrl('2026-08-03T08:00:00.000Z', { limit: 20 }));
  assert.equal(url.origin, 'https://aihot.virxact.com');
  assert.equal(url.pathname, '/api/public/items');
  assert.equal(url.searchParams.get('mode'), 'selected');
  assert.equal(url.searchParams.get('since'), '2026-08-02T08:00:00.000Z');
  assert.equal(url.searchParams.get('take'), '20');
});

test('AI HOT mapping keeps summary evidence and never stores article bodies', () => {
  const mapped = mapAihotItem({
    id: 'cms-1',
    title: 'AI 视频剪辑工具更新',
    permalink: 'https://aihot.virxact.com/items/cms-1',
    url: 'https://vendor.example/release',
    source: 'Vendor Blog',
    publishedAt: '2026-08-03T06:00:00.000Z',
    discoveredAt: '2026-08-03T06:05:00.000Z',
    summary: '支持批量生成短视频并改进剪辑效率。',
    contentText: 'this raw article body must not survive',
    category: 'ai-products',
    score: 82,
    selected: true,
  }, { capturedAt: '2026-08-03T08:00:00.000Z' });

  assert.equal(mapped.external_id, 'aihot:cms-1');
  assert.equal(mapped.source_url, 'https://aihot.virxact.com/items/cms-1');
  assert.equal(mapped.fact_summary, '支持批量生成短视频并改进剪辑效率。');
  assert.deepEqual(mapped.relevant_companies, ['ceo', 'huahuo']);
  assert.deepEqual(mapped.tags, ['ai-products', 'AI HOT']);
  assert.equal(mapped.status, 'candidate');
  assert.doesNotMatch(JSON.stringify(mapped), /raw article body|contentText/);
});

test('incomplete external items are ignored and duplicate ids collapse', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ items: [
    { id: 'same', title: '本地生活 AI 营销更新', permalink: 'https://aihot.virxact.com/items/same', source: 'AI HOT', summary: '面向门店营销。', publishedAt: '2026-08-03T05:00:00.000Z', selected: true },
    { id: 'same', title: 'duplicate', permalink: 'https://aihot.virxact.com/items/same', source: 'AI HOT', summary: 'duplicate', publishedAt: '2026-08-03T05:00:00.000Z', selected: true },
    { id: 'missing-summary', title: '无摘要', permalink: 'https://aihot.virxact.com/items/missing-summary', source: 'AI HOT', selected: true },
  ] }), { status: 200 });

  const rows = await readAihotSource({ fetchImpl, now: '2026-08-03T08:00:00.000Z' });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].relevant_companies, ['ceo', 'wanjia']);
});

test('external source failures are classified without leaking response bodies', async () => {
  const fetchImpl = async () => new Response('upstream secret details', { status: 503 });
  await assert.rejects(
    () => readAihotSource({ fetchImpl, now: '2026-08-03T08:00:00.000Z' }),
    (error) => error instanceof ExternalIntelligenceError
      && error.code === 'aihot_read_failed'
      && !String(error.message).includes('secret details'),
  );
});
