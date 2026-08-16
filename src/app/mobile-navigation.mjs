export const MOBILE_PRIMARY_ITEMS = Object.freeze([
  { id: 'today', label: '今日', pageId: 'dashboard' },
  { id: 'calendar', label: '日历', pageId: 'calendar' },
  { id: 'voice', label: '语音', action: 'open-ai-command' },
  { id: 'agent-workbench', label: 'Agent', pageId: 'agent-workbench' },
  { id: 'more', label: '更多', action: 'open-more' },
]);

export const MOBILE_MORE_GROUPS = Object.freeze([
  { id: 'business', label: '公司经营', items: [['local-life', '万嘉网络'], ['spark-media', '花火影像'], ['lingli', '玲丽教育'], ['enterprise', '企业项目'], ['targets', '经营目标']] },
  { id: 'knowledge-ai', label: '知识与 AI', items: [['intelligence', '情报中心'], ['content-growth', '内容增长'], ['zos-brain', '知识库'], ['search', '全局搜索']] },
  { id: 'personal-system', label: '个人与系统', items: [['life', '生活首页'], ['relations', '关系与跟进'], ['reviews', '复盘中心'], ['inbox', '收集箱'], ['tasks', '任务'], ['risk', '风险中心'], ['privacy', '隐私与数据'], ['settings', '设置'], ['dashboard', '工作首页'], ['decisions', '待我决策'], ['health', '数据健康'], ['today', '今日视图'], ['focus', '专注中心']] },
]);

export function mobilePrimaryPage(pageId) {
  return MOBILE_PRIMARY_ITEMS.some((item) => item.pageId === pageId) ? pageId : 'more';
}

export function buildMobileMoreGroups({ recentPages = [], pinnedPages = [] } = {}) {
  const preferred = [...new Set([...recentPages, ...pinnedPages])];
  return MOBILE_MORE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map(([pageId, label]) => ({ pageId, label, preferred: preferred.includes(pageId) })),
  }));
}
