import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBrainstorm, createKnowledgeCard, knowledgeReviewQueue, normalizeReadingItem,
  readingProgress, selectBrainstormDirection,
} from '../src/app/knowledge-workspace.mjs';

test('reading items support real source types and bounded progress', () => {
  const item = normalizeReadingItem({ title: '访谈', sourceType: 'video', sourceUrl: 'https://example.com/video', progress: 180 });
  assert.equal(item.status, 'inbox');
  assert.equal(readingProgress(item), 100);
  assert.equal(normalizeReadingItem({ title: 'PDF', sourceType: 'pdf' }).bodyStored, false);
});

test('knowledge cards require provenance and enter an explicit review queue', () => {
  assert.throws(() => createKnowledgeCard({ insight: '理解' }), /source_required/);
  const card = createKnowledgeCard({ sourceId: 'read-1', quote: '原文', insight: '我的理解', company: 'huahuo' });
  assert.equal(card.sourceId, 'read-1');
  assert.equal(knowledgeReviewQueue([card])[0].reviewStatus, 'pending');
});

test('brainstorm keeps nodes and records only an explicit selected direction', () => {
  const board = createBrainstorm({ title: '婚礼影像选题', nodes: [{ id: 'n1', title: '纪实' }, { id: 'n2', title: '情绪' }] });
  const selected = selectBrainstormDirection(board, 'n2');
  assert.equal(selected.selectedNodeId, 'n2');
  assert.equal(selected.mobileView, 'outline');
});
