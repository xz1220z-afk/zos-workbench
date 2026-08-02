import test from 'node:test';
import assert from 'node:assert/strict';
import { mapIntelligenceRecord } from '../supabase/functions/_shared/intelligence-values.mjs';

test('cloud intelligence mapping stores evidence summaries without article bodies', () => {
  const row = mapIntelligenceRecord({
    record_id: 'rec_001',
    last_modified_time: '1785643200',
    fields: {
      标题: '本地生活平台调整商家经营规则',
      摘要: '平台更新结算与流量规则。',
      影响分析: '万嘉需复核商家结算节奏。',
      建议动作: '今天核对重点商家的结算异常。',
      来源链接: 'https://example.com/evidence',
      可信度: '高',
      价值评分: 92,
      建议归属: '万嘉网络',
      建议知识类型: '行业情报',
      关联知识关键词: '结算，平台规则',
    },
  });

  assert.equal(row.external_id, 'rec_001');
  assert.equal(row.credibility, 'high');
  assert.equal(row.score, 92);
  assert.deepEqual(row.relevant_companies, ['wanjia']);
  assert.deepEqual(row.tags, ['结算', '平台规则']);
  assert.equal(row.fact_summary, '平台更新结算与流量规则。');
  assert.equal(row.suggested_action, '今天核对重点商家的结算异常。');
  assert.ok(!('raw_body' in row));
  assert.ok(!('article_body' in row));
});

test('incomplete intelligence records are ignored instead of fabricating content', () => {
  assert.equal(mapIntelligenceRecord({ record_id: 'rec_002', fields: { 标题: '只有标题' } }), null);
  assert.equal(mapIntelligenceRecord({ fields: { 标题: '无真实记录标识', 摘要: '摘要' } }), null);
});
