const QUESTION_FILLERS = /(?:请问|帮我|解释一下|介绍一下|我想知道|我不懂|什么是|是什么|什么意思|为什么|怎么回事|为何|请解释|模型|这篇|这条|情报|资讯|新闻|发布|延期|延缓|的|了|呢|吗|？|\?|，|,|。)/gi;

function text(value) {
  return String(value || '').trim();
}

function searchable(item = {}) {
  return [item.title, item.factSummary, item.impactAnalysis, item.suggestedAction, ...(item.tags || [])]
    .map(text).filter(Boolean).join(' ');
}

function queryTerms(question) {
  const original = text(question);
  const latin = original.match(/[A-Za-z][A-Za-z0-9._+-]{1,}/g) || [];
  const cleaned = original.replace(QUESTION_FILLERS, ' ').replace(/\s+/g, ' ').trim();
  const chinese = cleaned.match(/[\u3400-\u9fff]{2,}/g) || [];
  return [...new Set([...latin, ...chinese].map((value) => value.toLowerCase()))];
}

function uniqueSources(items) {
  const seen = new Set();
  return items.flatMap((item) => {
    const url = text(item.sourceUrl);
    const name = text(item.sourceName) || '待核对来源';
    const key = `${name}|${url}`;
    if (!url || seen.has(key)) return [];
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return [];
      seen.add(key);
      return [{ name, url: parsed.toString() }];
    } catch { return []; }
  });
}

function relevance(item, terms) {
  const haystack = searchable(item).toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? Math.max(2, term.length) : 0), 0);
}

export function buildIntelligenceAnswer({ item = {}, allItems = [], question = '' } = {}) {
  const asked = text(question);
  const terms = queryTerms(asked);
  const selectedText = searchable(item).toLowerCase();
  const selectedMatches = terms.filter((term) => selectedText.includes(term));
  const relatedEvidence = (allItems || [])
    .filter((candidate) => candidate && candidate.externalId !== item.externalId)
    .map((candidate) => ({ candidate, score: relevance(candidate, terms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ candidate }) => ({
      externalId: text(candidate.externalId), title: text(candidate.title),
      factSummary: text(candidate.factSummary), sourceName: text(candidate.sourceName), sourceUrl: text(candidate.sourceUrl),
    }));
  const hasEvidence = asked && (selectedMatches.length > 0 || relatedEvidence.length > 0);
  const termLabel = selectedMatches[0] || terms[0] || '这个问题';
  const facts = [text(item.factSummary), ...relatedEvidence.map((entry) => entry.factSummary)].filter(Boolean);
  const sources = uniqueSources([item, ...relatedEvidence]);

  if (!hasEvidence) {
    return {
      state: 'insufficient', question: asked,
      directAnswer: '当前卡片和已载入情报里没有足够证据回答这个问题。',
      knownFacts: text(item.factSummary) ? [text(item.factSummary)] : [], relatedEvidence: [], sources,
      uncertainty: '工作台不会根据标题补写事实，也不会把推测当成已证实结论。',
      nextStep: '建议打开原始来源核对，或把它转成一条待确认的调研任务。',
    };
  }

  return {
    state: 'answered', question: asked,
    directAnswer: `根据现有情报，可确认 ${termLabel} 与这条信息描述的事件有关：${text(item.factSummary) || '卡片尚无事实摘要。'}`,
    knownFacts: facts.slice(0, 4), relatedEvidence, sources,
    uncertainty: `现有情报没有给出 ${termLabel} 的完整官方定义，相关原因与能力边界仍需以官方来源交叉验证。`,
    nextStep: text(item.suggestedAction) || '查看来源并等待官方信息补充后再判断。',
  };
}
