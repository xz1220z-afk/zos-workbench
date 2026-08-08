import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKnowledgeContextIndex } from '../src/knowledge-context-index.mjs';

test('knowledge context index keeps only approved short excerpts and excludes private material', () => {
  const index = normalizeKnowledgeContextIndex({ chunks: [
    { chunkId: 'work-1', title: '运营复盘', sourceRef: 'ops/weekly.md', scope: 'work', excerpt: '本周经营复盘的已确认结论。', tags: ['运营'], contentHash: 'abc123', updatedAt: '2026-08-08T00:00:00Z' },
  ] });
  assert.equal(index.chunks.length, 1);
  assert.throws(() => normalizeKnowledgeContextIndex({ chunks: [
    { chunkId: 'private-1', title: '关系记录', sourceRef: 'private.md', scope: 'private', excerpt: '不导出', contentHash: 'abc' },
  ] }), /knowledge_scope_not_allowed/);
});
