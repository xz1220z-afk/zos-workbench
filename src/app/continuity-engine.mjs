const CLOSED_STATES = new Set(['done', 'completed', 'cancelled', 'archived']);
const PRIVATE_AGENT_IDS = new Set(['REL-001']);

function text(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function day(value) {
  return text(value).slice(0, 10);
}

function openTasks(tasks = []) {
  return (Array.isArray(tasks) ? tasks : []).filter((item) => !CLOSED_STATES.has(text(item?.status).toLowerCase()));
}

function overduePrompts(tasks, today) {
  return openTasks(tasks)
    .filter((item) => day(item.dueDate || item.dueAt) && day(item.dueDate || item.dueAt) < today)
    .map((item) => {
      const dueDate = day(item.dueDate || item.dueAt);
      const overdueDays = Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000));
      return {
        id: `overdue:${text(item.id)}`, kind: 'overdue_task', title: text(item.title) || '未命名逾期任务',
        detail: `已逾期 ${overdueDays} 天`, action: 'open_task', sourceId: text(item.id), priority: 300 + overdueDays,
        private: item.privacy === 'private',
      };
    });
}

function targetPrompts(targets, gaps, tasks) {
  const activeTasks = openTasks(tasks);
  const byMetric = new Map((Array.isArray(targets) ? targets : []).map((target) => [text(target.metricKey), target]));
  return (Array.isArray(gaps) ? gaps : [])
    .filter((gap) => text(gap.state) === 'behind' && text(gap.metricKey))
    .filter((gap) => !activeTasks.some((task) => text(task.metricKey) === text(gap.metricKey)))
    .map((gap) => {
      const target = byMetric.get(text(gap.metricKey)) || {};
      const label = text(target.label || target.title || gap.metricKey);
      return {
        id: `target:${text(target.id || gap.metricKey)}`, kind: 'target_gap', title: `${label}仍有差距`,
        detail: '尚未发现对应的进行中任务', action: 'draft_task', sourceId: text(target.id || gap.metricKey),
        priority: 200, private: false,
      };
    });
}

function agentPrompts(agentRuns, tasks) {
  const activeTasks = openTasks(tasks);
  return (Array.isArray(agentRuns) ? agentRuns : [])
    .filter((run) => text(run.status || run.phase).toLowerCase() === 'completed' && text(run.id))
    .filter((run) => !activeTasks.some((task) => text(task.sourceId || task.agentRunId) === text(run.id)))
    .map((run) => {
      const agentId = text(run.agentId).toUpperCase();
      const privateItem = PRIVATE_AGENT_IDS.has(agentId) || run.privacy === 'private';
      return {
        id: `agent:${text(run.id)}`, kind: 'agent_follow_up',
        title: privateItem ? '私密 Agent 结果待确认下一步' : `${text(run.objective || run.title) || 'Agent 任务'}待确认下一步`,
        detail: 'Agent 已完成分析，但尚未发现后续任务', action: 'draft_task', sourceId: text(run.id),
        priority: 150, private: privateItem,
        at: text(run.completedAt || run.updatedAt),
      };
    });
}

function aiPrompts(aiCommand, tasks) {
  if (!aiCommand || text(aiCommand.state) !== 'completed' || !text(aiCommand.id)) return [];
  if (openTasks(tasks).some((task) => text(task.sourceId) === text(aiCommand.id))) return [];
  const next = Array.isArray(aiCommand.result?.sections?.next) ? aiCommand.result.sections.next.map(text).filter(Boolean) : [];
  return next.slice(0, 1).map((title) => ({
    id: `ai:${text(aiCommand.id)}`, kind: 'ai_next_step', title,
    detail: 'AI 已给出下一步，但尚未保存为任务', action: 'draft_task', sourceId: text(aiCommand.id),
    priority: 180, private: false,
  }));
}

export function buildContinuityPrompts(input = {}, options = {}) {
  const today = day(input.now || new Date().toISOString());
  const limit = Math.max(1, Math.min(Number(options.limit) || 4, 12));
  const candidates = [
    ...overduePrompts(input.tasks, today),
    ...targetPrompts(input.targets, input.gaps, input.tasks),
    ...agentPrompts(input.agentRuns, input.tasks),
    ...aiPrompts(input.aiCommand, input.tasks),
  ].sort((left, right) => right.priority - left.priority || text(right.at).localeCompare(text(left.at)) || left.id.localeCompare(right.id));

  const seen = new Set();
  return candidates.filter((item) => {
    const key = text(item.title).toLocaleLowerCase('zh-CN');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit).map(({ priority, at, ...item }) => item);
}
