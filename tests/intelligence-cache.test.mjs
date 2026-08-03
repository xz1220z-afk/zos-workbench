import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkIntelligenceRows,
  prepareIntelligenceRows,
} from '../supabase/functions/_shared/intelligence-cache.mjs';

test('intelligence cache keeps a user review state during automatic source refresh', () => {
  const rows = prepareIntelligenceRows('owner-1', [
    { external_id: 'same', title: '更新后的标题', status: 'candidate' },
    { external_id: 'same', title: '重复项', status: 'candidate' },
    { external_id: 'new', title: '新情报', status: 'candidate' },
  ], [{ external_id: 'same', status: 'actioned' }]);

  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.external_id === 'same').status, 'actioned');
  assert.equal(rows.find((row) => row.external_id === 'new').status, 'candidate');
  assert.ok(rows.every((row) => row.user_id === 'owner-1'));
});

test('intelligence cache chunks independent source batches', () => {
  const chunks = chunkIntelligenceRows(Array.from({ length: 81 }, (_, index) => ({ external_id: String(index) })), 50);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [50, 31]);
});
