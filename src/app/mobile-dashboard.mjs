function countStatus(runs, values) {
  return runs.filter((run) => values.includes(run.status)).length;
}

export function buildMobileDashboard(viewModel = {}) {
  const runs = Array.isArray(viewModel.agentRuns) ? viewModel.agentRuns : [];
  return {
    headline: viewModel.homePresence || { title: '等待当前事实', summary: '刷新来源后生成今日行动摘要。' },
    agentMetrics: {
      total: Number(viewModel.agentOsOverview?.summary?.total) || 0,
      running: countStatus(runs, ['running', 'executing']),
      completed: countStatus(runs, ['completed']),
      failed: countStatus(runs, ['failed', 'error']),
    },
    topActions: (viewModel.todayTop3 || []).slice(0, 3),
    sections: [
      { id: 'companies', pageId: 'local-life', count: Object.keys(viewModel.companyOperating || {}).length },
      { id: 'calendar', pageId: 'calendar', count: (viewModel.calendar || []).length },
      { id: 'intelligence', pageId: 'intelligence', count: (viewModel.mustRead || []).length },
      { id: 'health', pageId: 'health', count: (viewModel.health || []).filter((item) => item.state !== 'synced').length },
    ],
  };
}
