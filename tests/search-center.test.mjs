import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, searchWorkspace } from '../src/app/search-center.mjs';

test('search distinguishes business facts, knowledge metadata and private life', () => {
  const index = buildSearchIndex({
    business: [{ id: 'b1', title: '万嘉商家项目', company: '万嘉', updatedAt: '2026-08-02' }],
    knowledge: [{ path: 'SOP/商家跟进.md', title: '商家跟进 SOP', tags: ['运营'] }],
    life: [{ id: 'l1', title: '家庭聚会', privacy: 'private' }],
  });
  assert.deepEqual(new Set(index.map((item) => item.authority)), new Set(['business_fact', 'knowledge_metadata', 'private_life']));
  assert.equal(searchWorkspace(index, '商家')[0].authority, 'business_fact');
  assert.equal(searchWorkspace(index, '家庭', { includePrivate: false }).length, 0);
});

