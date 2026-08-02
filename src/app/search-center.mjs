function text(value) { return String(value || '').trim(); }

function entry(item, authority, source, fallbackId) {
  return {
    id: text(item.id || item.path || fallbackId),
    title: text(item.title || item.name || item.path || '未命名'),
    subtitle: text(item.company || item.folder || item.sourceName || item.status),
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    authority, source, updatedAt: item.updatedAt || item.sourceUpdatedAt || item.mtime || null,
    privacy: item.privacy || 'work',
  };
}

export function buildSearchIndex({ business = [], knowledge = [], intelligence = [], actions = [], life = [] } = {}) {
  return [
    ...business.map((item, index) => entry(item, 'business_fact', item.source || 'feishu', `business-${index}`)),
    ...knowledge.map((item, index) => entry(item, 'knowledge_metadata', 'obsidian', `knowledge-${index}`)),
    ...intelligence.map((item, index) => entry(item, 'intelligence_candidate', item.sourceName || 'intelligence', `intel-${index}`)),
    ...actions.map((item, index) => entry(item, 'user_action', 'zos', `action-${index}`)),
    ...life.map((item, index) => entry(item, 'private_life', 'life', `life-${index}`)),
  ];
}

export function searchWorkspace(index = [], query = '', { includePrivate = true, limit = 30 } = {}) {
  const needle = text(query).toLocaleLowerCase('zh-CN');
  if (!needle) return [];
  const authorityWeight = { business_fact: 30, user_action: 20, intelligence_candidate: 15, knowledge_metadata: 10, private_life: 0 };
  return index.filter((item) => includePrivate || item.authority !== 'private_life').map((item) => {
    const haystack = [item.title, item.subtitle, ...item.tags].join(' ').toLocaleLowerCase('zh-CN');
    const titleIndex = item.title.toLocaleLowerCase('zh-CN').indexOf(needle);
    const matchScore = titleIndex === 0 ? 100 : titleIndex > 0 ? 80 : haystack.includes(needle) ? 50 : 0;
    const score = matchScore ? matchScore + (authorityWeight[item.authority] || 0) : 0;
    return { ...item, score };
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score
    || String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))).slice(0, limit);
}
