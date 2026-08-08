export const WANJIA_OPS_PANES = Object.freeze([
  { id: 'overview', label: '今日总控', question: '今天最应该处理什么？' },
  { id: 'merchant_ops', label: '商家作战', question: '哪些商家需要怎样跟进？' },
  { id: 'growth_review', label: '增长复盘', question: '哪里值得复制或止损？' },
  { id: 'data_analysis', label: '数据分析', question: '数据能证明什么？' },
]);

export function normalizeWanjiaOpsPane(value) {
  return WANJIA_OPS_PANES.some((item) => item.id === value) ? value : 'overview';
}

export function buildWanjiaOpsNavigation(value) {
  const activeId = normalizeWanjiaOpsPane(value);
  return {
    active: WANJIA_OPS_PANES.find((item) => item.id === activeId),
    items: WANJIA_OPS_PANES,
  };
}
