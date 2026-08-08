function rows(value) {
  return Array.isArray(value) ? value : [];
}

function count(value) {
  return rows(value).length;
}

export function buildWorkHomepagePresence(model = {}) {
  const decisions = rows(model.decisions);
  const dates = rows(model.importantDates?.work);
  const actions = rows(model.todayTop3);
  const risks = rows(model.businessExceptions).length + rows(model.calendarConflicts).length;
  if (decisions.length) return {
    kicker: 'TODAY · DECISION', title: `今天有 ${decisions.length} 件事需要你拍板`,
    summary: actions.length ? `${actions.length} 项行动已进入今日清单` : '先处理待确认事项，再安排今日执行。',
    primaryAction: { label: '查看待我决策', target: 'decisions' }, secondaryAction: { label: '快速收集', event: 'quick-capture' }, tone: 'decision',
  };
  if (dates.length || risks) return {
    kicker: 'TODAY · PRIORITY', title: `今天有 ${dates.length + risks} 个节点值得优先处理`,
    summary: actions.length ? `${actions.length} 项行动已进入今日清单` : '查看风险、期限与日程后决定下一步。',
    primaryAction: { label: '查看今日行动', target: 'today' }, secondaryAction: { label: '快速收集', event: 'quick-capture' }, tone: 'priority',
  };
  const opportunities = rows(model.mustRead).length;
  if (opportunities) return {
    kicker: 'TODAY · OPPORTUNITY', title: `今天有 ${opportunities} 个可转行动的机会`,
    summary: actions.length ? `${actions.length} 项行动已进入今日清单` : '从已验证的信息里选择一个可推进动作。',
    primaryAction: { label: '查看今日情报', target: 'intelligence' }, secondaryAction: { label: '快速收集', event: 'quick-capture' }, tone: 'opportunity',
  };
  return {
    kicker: 'TODAY · OPERATING RHYTHM', title: '今天的节奏已排好',
    summary: actions.length ? `${actions.length} 项行动已进入今日清单` : '暂未发现需要立即处理的事项。',
    primaryAction: { label: '查看今日行动', target: 'today' }, secondaryAction: { label: '快速收集', event: 'quick-capture' }, tone: 'calm',
  };
}

export function buildLifeHomepagePresence(model = {}) {
  const items = rows(model.life);
  const dates = rows(model.importantDates?.life);
  const agenda = rows(model.lifeNextSevenDays);
  const rituals = rows(model.rituals);
  if (items.length) return {
    kicker: 'LIFE · TODAY', title: `今天留给自己的时间还有 ${items.length} 段`,
    summary: '仅显示你已授权的本地生活安排；工作区不会显示标题或备注。',
    primaryAction: { label: '查看生活安排', target: 'calendar' }, secondaryAction: { label: '记录生活事项', event: 'life-capture' }, tone: 'today',
  };
  if (dates.length || agenda.length) return {
    kicker: 'LIFE · PREPARE', title: `未来 7 天有 ${dates.length + agenda.length} 个值得提前准备的日子`,
    summary: '提前留出时间与心意，不在这里暴露私人事项标题。',
    primaryAction: { label: '查看重要日子', target: 'important-dates' }, secondaryAction: { label: '记录生活事项', event: 'life-capture' }, tone: 'prepare',
  };
  if (rituals.length) return {
    kicker: 'LIFE · CARE', title: '今天有一件关怀小事可以完成',
    summary: '提醒仅在本地显示，任何外发或预约仍需你确认。',
    primaryAction: { label: '查看仪式提醒', target: 'life' }, secondaryAction: { label: '记录生活事项', event: 'life-capture' }, tone: 'care',
  };
  return {
    kicker: 'LIFE · RHYTHM', title: '今天可以给自己留一点空间',
    summary: '生活区仅自己可见；没有自动外发、自动日历或隐私读取。',
    primaryAction: { label: '记录生活事项', target: 'life-capture' }, secondaryAction: { label: '导入私人日期', event: 'private-date-import' }, tone: 'calm',
  };
}
