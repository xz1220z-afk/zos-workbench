function scalar(value) {
  if (Array.isArray(value)) return scalar(value[0] ?? null);
  if (value && typeof value === 'object') {
    return value.text ?? value.link ?? value.url ?? value.name ?? null;
  }
  return value;
}

function text(fields, ...names) {
  for (const name of names) {
    const value = scalar(fields[name]);
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return '';
}

function normalizeCredibility(value) {
  return ({ 高: 'high', 中: 'medium', 低: 'low', high: 'high', medium: 'medium', low: 'low' })[value] || 'medium';
}

function relevantCompanies(value) {
  const result = new Set();
  if (/万嘉|本地生活|商家|抖音/.test(value)) result.add('wanjia');
  if (/花火|影像|摄影|视频|婚礼/.test(value)) result.add('huahuo');
  if (/玲丽|教育|培训|招生|课程/.test(value)) result.add('lingli');
  if (/管理|战略|AI|效率|财务/.test(value) || !result.size) result.add('ceo');
  return [...result];
}

function timestamp(value) {
  if (!value) return null;
  const numeric = Number(value);
  const milliseconds = Number.isFinite(numeric) ? (numeric < 10_000_000_000 ? numeric * 1000 : numeric) : NaN;
  const date = Number.isFinite(milliseconds) ? new Date(milliseconds) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function mapIntelligenceRecord(record, now = () => new Date().toISOString()) {
  const fields = record.fields || {};
  const title = text(fields, '标题');
  const summary = text(fields, '摘要', '影响分析');
  if (!record.record_id || !title || !summary) return null;
  const score = Number(scalar(fields['价值评分']));
  const suggestion = text(fields, '建议归属');
  const type = text(fields, '建议知识类型', '分类标签');
  return {
    external_id: record.record_id,
    title,
    source_name: text(fields, '来源名称', '来源平台') || '飞书情报候选池',
    source_url: text(fields, '来源链接'),
    published_at: timestamp(text(fields, '发布时间')),
    captured_at: timestamp(text(fields, '抓取时间')) || now(),
    credibility: normalizeCredibility(text(fields, '可信度')),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
    relevant_companies: relevantCompanies(`${suggestion} ${type} ${title}`),
    tags: text(fields, '关联知识关键词', '分类标签').split(/[,，、]/).map((item) => item.trim()).filter(Boolean),
    fact_summary: summary,
    impact_analysis: text(fields, '影响分析'),
    suggested_action: text(fields, '建议动作', '摘要'),
    source_updated_at: timestamp(record.last_modified_time),
  };
}
