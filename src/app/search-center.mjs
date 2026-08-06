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

export function buildSearchIndex({
  business = [], knowledge = [], intelligence = [], actions = [], life = [],
  content = [], reading = [], cards = [], social = [], agentRuns = [], assets = [], brainstorms = [],
} = {}) {
  return [
    ...business.map((item, index) => entry(item, 'business_fact', item.source || 'feishu', `business-${index}`)),
    ...knowledge.map((item, index) => entry(item, 'knowledge_metadata', 'obsidian', `knowledge-${index}`)),
    ...intelligence.map((item, index) => entry(item, 'intelligence_candidate', item.sourceName || 'intelligence', `intel-${index}`)),
    ...actions.map((item, index) => entry(item, 'user_action', 'zos', `action-${index}`)),
    ...life.map((item, index) => entry(item, 'private_life', 'life', `life-${index}`)),
    ...content.map((item, index) => entry(item, 'content_work', 'content_growth', `content-${index}`)),
    ...reading.map((item, index) => entry(item, 'knowledge_metadata', 'reading', `reading-${index}`)),
    ...cards.map((item, index) => entry(item, 'knowledge_metadata', 'knowledge_card', `card-${index}`)),
    ...social.map((item, index) => entry({ ...item, title: item.claim, name: item.claim }, 'intelligence_candidate', 'social_insight', `social-${index}`)),
    ...agentRuns.map((item, index) => entry({ ...item, title: item.objective, name: item.objective }, 'agent_record', 'agent_run', `agent-${index}`)),
    ...assets.map((item, index) => entry(item, 'content_asset', 'content_asset', `asset-${index}`)),
    ...brainstorms.map((item, index) => entry(item, 'knowledge_metadata', 'brainstorm', `brainstorm-${index}`)),
  ];
}

export function searchWorkspace(index = [], query = '', { includePrivate = true, limit = 30 } = {}) {
  const needle = text(query).toLocaleLowerCase('zh-CN');
  if (!needle) return [];
  const authorityWeight = {
    business_fact: 30, user_action: 20, content_work: 18, agent_record: 16,
    intelligence_candidate: 15, knowledge_metadata: 10, content_asset: 8, private_life: 0,
  };
  return index.filter((item) => includePrivate || item.authority !== 'private_life').map((item) => {
    const haystack = [item.title, item.subtitle, ...item.tags].join(' ').toLocaleLowerCase('zh-CN');
    const titleIndex = item.title.toLocaleLowerCase('zh-CN').indexOf(needle);
    const matchScore = titleIndex === 0 ? 100 : titleIndex > 0 ? 80 : haystack.includes(needle) ? 50 : 0;
    const score = matchScore ? matchScore + (authorityWeight[item.authority] || 0) : 0;
    return { ...item, score };
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score
    || String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))).slice(0, limit);
}
