const SOURCE_TYPES = new Set(['web', 'video', 'pdf', 'feishu', 'book', 'course', 'note']);

function text(value) {
  return String(value ?? '').trim();
}

export function normalizeReadingItem(input = {}) {
  const progress = Math.max(0, Math.min(100, Number(input.progress) || 0));
  return {
    ...input,
    title: text(input.title) || '未命名阅读',
    sourceType: SOURCE_TYPES.has(input.sourceType) ? input.sourceType : 'web',
    sourceUrl: text(input.sourceUrl),
    status: input.status || 'inbox',
    progress,
    bodyStored: false,
    highlights: Array.isArray(input.highlights) ? input.highlights : [],
    actionConclusion: text(input.actionConclusion),
  };
}

export function readingProgress(item = {}) {
  return Math.max(0, Math.min(100, Number(item.progress) || 0));
}

export function createKnowledgeCard(input = {}) {
  const sourceId = text(input.sourceId);
  const sourceUrl = text(input.sourceUrl);
  if (!sourceId && !sourceUrl) throw new Error('source_required');
  return {
    ...input,
    title: text(input.title) || text(input.insight) || text(input.quote).slice(0, 42) || '知识卡片',
    sourceId,
    sourceUrl,
    quote: text(input.quote),
    insight: text(input.insight),
    company: text(input.company) || 'personal',
    tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : [],
    reviewStatus: input.reviewStatus || 'pending',
    bodyStored: false,
  };
}

export function knowledgeReviewQueue(cards = []) {
  return cards.map(createKnowledgeCard).filter((card) => card.reviewStatus === 'pending');
}

export function createBrainstorm(input = {}) {
  return {
    ...input,
    title: text(input.title) || '未命名头脑风暴',
    nodes: Array.isArray(input.nodes) ? input.nodes.map((node, index) => ({ id: node.id || `node-${index + 1}`, ...node })) : [],
    selectedNodeId: input.selectedNodeId || null,
    mobileView: 'outline',
    status: input.status || 'exploring',
  };
}

export function selectBrainstormDirection(input, nodeId) {
  const board = createBrainstorm(input);
  if (!board.nodes.some((node) => node.id === nodeId)) throw new Error('brainstorm_node_not_found');
  return { ...board, selectedNodeId: nodeId, status: 'direction_selected' };
}
