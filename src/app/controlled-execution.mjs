const L1_TYPES = new Set(['save_task_draft', 'save_inbox_draft', 'save_reminder_draft']);
const L2_TYPES = new Set([
  'feishu_write', 'send_message', 'publish', 'external_calendar', 'delete',
  'batch_move', 'archive', 'rename', 'payment', 'booking', 'contract',
  'price_change', 'permission', 'credential', 'automation',
]);

export function classifyControlledAction(action = {}) {
  if (L2_TYPES.has(action.type) || action.mutates === true) return 'L2';
  if (L1_TYPES.has(action.type)) return 'L1';
  return 'L0';
}

export function buildExecutionPreview(action = {}) {
  return {
    type: String(action.type || 'unknown'),
    target: String(action.target || ''),
    changes: action.changes && typeof action.changes === 'object' ? { ...action.changes } : {},
    impact: String(action.impact || '将影响工作台外部数据或人员'),
    testPlan: String(action.testPlan || '执行后回读受影响对象并核对结果'),
    rollback: String(action.rollback || '停止执行并保留当前数据'),
  };
}

export async function executeControlledAction(action = {}, adapters = {}) {
  const level = classifyControlledAction(action);
  if (level === 'L2') {
    return { level, status: 'preview_required', preview: buildExecutionPreview(action) };
  }
  if (action.type === 'save_task_draft') {
    if (typeof adapters.saveTaskDraft !== 'function') throw new Error('draft_executor_unavailable');
    const record = await adapters.saveTaskDraft(action);
    if (!record?.id) throw new Error('draft_save_failed');
    return { level, status: 'completed', record, undo: { entityType: 'tasks', recordId: record.id } };
  }
  if (action.type === 'save_inbox_draft' || action.type === 'save_reminder_draft') {
    if (typeof adapters.saveInboxDraft !== 'function') throw new Error('draft_executor_unavailable');
    const record = await adapters.saveInboxDraft(action);
    if (!record?.id) throw new Error('draft_save_failed');
    return { level, status: 'completed', record, undo: { entityType: 'inbox', recordId: record.id } };
  }
  const value = action.type === 'navigate' && typeof adapters.navigate === 'function'
    ? await adapters.navigate(action.target) : null;
  return { level, status: 'completed', value };
}
