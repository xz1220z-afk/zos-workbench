import { displayValue, escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs?v=2.7.0';
import { isSensitiveFieldName } from '../sensitive-fields.mjs?v=2.7.0';

export { VIEW_STATES };

const META_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'revision', 'deviceId', 'entity']);
const ACTION_LABELS = {
  create: '新增', update: '编辑', complete: '完成', reopen: '重新打开',
  delete: '删除', restore: '恢复', snooze: '稍后提醒', conflict_resolved: '处理冲突',
};
const NOTIFICATION_LABELS = {
  enabled: '提醒已开启', permission_required: '等待你授权', pending_configuration: '等待云端配置',
  denied: '通知已关闭', unsupported: '此设备不支持', default: '提醒未开启',
};
const SCHEDULE_LABELS = {
  synced: '排程已同步', disabled: '排程未开启', pending: '等待同步', error: '排程异常',
};

function safeJson(value) {
  try { return JSON.stringify(value ?? null); } catch { return String(value ?? ''); }
}
function renderConflict(conflict) {
  const fields = [...new Set([...Object.keys(conflict.local || {}), ...Object.keys(conflict.remote || {})])]
    .filter((key) => !META_FIELDS.has(key))
    .filter((key) => !isSensitiveFieldName(key))
    .filter((key) => safeJson(conflict.local?.[key]) !== safeJson(conflict.remote?.[key]));
  return `<article class="v13-panel v111-conflict-card">
    <div class="v13-row"><div><h3>需要你处理的冲突</h3><p>${escapeHtml(conflict.entityType)} · ${escapeHtml(conflict.recordId || conflict.id)}</p></div><span class="v13-chip">两边都已修改</span></div>
    <div class="v111-conflict-actions">
      <button class="v13-action" data-sync-resolution="local" data-sync-conflict="${escapeHtml(conflict.id)}">保留本机</button>
      <button class="v13-action" data-sync-resolution="remote" data-sync-conflict="${escapeHtml(conflict.id)}">使用云端</button>
    </div>
    <form class="v111-merge-form" data-sync-merge-form="${escapeHtml(conflict.id)}">
      <p class="v111-muted">逐字段选择后合并；系统会生成一个新版本。</p>
      ${fields.map((field) => `<label class="v111-merge-row"><span>${escapeHtml(field)}</span>
        <select name="field:${escapeHtml(field)}"><option value="local">本机：${escapeHtml(safeJson(conflict.local?.[field]))}</option><option value="remote">云端：${escapeHtml(safeJson(conflict.remote?.[field]))}</option></select>
      </label>`).join('') || '<p>两边业务字段一致，可任选一个版本。</p>'}
      <button class="v13-action primary" type="submit">确认合并</button>
    </form>
  </article>`;
}

function renderReminderQueue(items = []) {
  return items.slice(0, 5).map((item) => `<div class="v111-list-row">
    <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.reason || '待处理')}</small></div>
    ${item.snoozable === false ? '' : `<div class="v111-inline-actions">
      <button data-reminder-snooze="10m" data-reminder-entity="tasks" data-reminder-id="${escapeHtml(item.actionId || item.sourceId || '')}">10 分钟</button>
      <button data-reminder-snooze="1h" data-reminder-entity="tasks" data-reminder-id="${escapeHtml(item.actionId || item.sourceId || '')}">1 小时</button>
      <button data-reminder-snooze="tomorrow" data-reminder-entity="tasks" data-reminder-id="${escapeHtml(item.actionId || item.sourceId || '')}">明天</button>
    </div>`}
  </div>`).join('') || '<p class="v111-muted">目前没有需要稍后提醒的事项。</p>';
}

export function render(container, viewModel = {}) {
  if (!container) return;
  if (VIEW_STATES.includes(viewModel.state)) {
    container.innerHTML = renderState(viewModel.state, '数据健康');
    return;
  }
  const health = Array.isArray(viewModel.health) ? viewModel.health : [];
  const automatic = viewModel.autoRefresh || {};
  const reliability = viewModel.reliability || {};
  const conflicts = Array.isArray(viewModel.syncConflicts) ? viewModel.syncConflicts : [];
  const restorable = Array.isArray(viewModel.restorableItems) ? viewModel.restorableItems : [];
  const auditLog = Array.isArray(viewModel.auditLog) ? viewModel.auditLog : [];
  const notificationLabel = NOTIFICATION_LABELS[viewModel.notificationState] || '提醒未开启';
  const scheduleLabel = SCHEDULE_LABELS[viewModel.reminderScheduleState] || '排程未开启';
  const summary = automatic.phase === 'partial'
    ? `部分失败 ${automatic.failed?.length || 0} 个来源`
    : automatic.phase === 'refreshing' ? '后台更新中' : automatic.phase === 'offline' ? '离线使用缓存' : '自动更新已开启';

  container.innerHTML = `<section class="v111-sync-center">
    <article class="v13-panel v111-sync-hero">
      <div class="v13-row"><div><span class="v111-kicker">SYNC RELIABILITY</span><h3>同步中心</h3><p>所有公司、任务与日历统一自动更新，失败会自动补同步。</p></div><span class="v13-chip">${escapeHtml(reliability.label || '等待首次同步')}</span></div>
      <div class="v111-metric-grid">
        <div><span>当前设备</span><strong>${escapeHtml(reliability.deviceId || '当前设备')}</strong></div>
        <div><span>待同步</span><strong>${displayValue(reliability.pendingUploads, '0')}</strong></div>
        <div><span>需处理冲突</span><strong>${displayValue(reliability.conflicts, '0')}</strong></div>
        <div><span>可恢复</span><strong>${displayValue(reliability.restorable, '0')}</strong></div>
        <div><span>数据保护</span><strong>${escapeHtml(reliability.protectionState || '本机数据已保护')}</strong></div>
        <div><span>安全快照</span><strong>${displayValue(reliability.snapshotCount, '0')}</strong></div>
      </div>
      <div class="v111-toolbar"><button class="v13-action primary" data-sync-now>立即同步</button><button class="v13-action" data-refresh-all>刷新全部来源</button><button class="v13-action" data-export-backup>下载完整备份</button><button class="v13-action" data-import-backup>安全合并恢复</button><button class="v13-action" data-undo-backup>撤销上次恢复</button></div>
      <p class="v111-muted">最近成功：${displayValue(reliability.lastSuccessAt)}${reliability.nextRetryAt ? ` · 下次自动重试：${displayValue(reliability.nextRetryAt)}` : ''}</p>
    </article>

    ${conflicts.map(renderConflict).join('')}

    <div class="v111-reliability-grid">
      <article class="v13-panel"><div class="v13-row"><h3>提醒自检</h3><span class="v13-chip">${escapeHtml(notificationLabel)}</span></div>
        <p>权限、设备订阅与云端排程：${escapeHtml(scheduleLabel)} · ${displayValue(viewModel.reminderScheduleCount, '0')} 条</p>
        ${viewModel.notificationState === 'enabled' ? '<button class="v13-action" data-reminder-test>发送测试提醒</button>' : '<button class="v13-action" data-enable-reminders>开启通知并自检</button>'}
        <p class="v111-muted">${escapeHtml(viewModel.reminderTestState === 'sent' ? '测试提醒已发送到当前启用设备' : viewModel.reminderTestState === 'failed' ? '测试失败，请先开启通知' : '不会包含任务正文或私人标题')}</p>
        <div class="v111-list">${renderReminderQueue(viewModel.reminderQueue)}</div>
      </article>
      <article class="v13-panel"><div class="v13-row"><h3>30 天回收站</h3><span class="v13-chip">${restorable.length} 项</span></div>
        ${restorable.slice(0, 8).map((item) => `<div class="v111-list-row"><div><strong>${escapeHtml(item.title || item.name || '已删除项目')}</strong><small>剩余 ${item.daysRemaining} 天可恢复</small></div><button data-reliability-restore="${escapeHtml(item.id)}" data-reliability-entity="${escapeHtml(item.entity)}">恢复</button></div>`).join('') || '<p class="v111-muted">回收站为空。</p>'}
      </article>
      <article class="v13-panel"><div class="v13-row"><h3>最近操作</h3><span class="v13-chip">本机记录</span></div>
        ${auditLog.slice(0, 10).map((item) => `<div class="v111-list-row"><div><strong>${escapeHtml(ACTION_LABELS[item.action] || item.action)}</strong><small>${escapeHtml(item.label || item.entityType)} · ${displayValue(item.at)}</small></div></div>`).join('') || '<p class="v111-muted">暂无操作记录。</p>'}
      </article>
    </div>

    <article class="v13-panel v15-health-summary"><div class="v13-row"><h3>数据来源</h3><span class="v13-chip">${escapeHtml(summary)}</span></div><p>工作台打开时每 15 分钟检查；回到前台或网络恢复会自动补刷新。</p></article>
    ${health.length ? `<div class="v13-grid">${health.map((item) => `<article class="v13-panel"><div class="v13-row"><h3>${escapeHtml(item.label || item.source)}</h3><span class="v13-chip">${escapeHtml(item.state)}</span></div><div class="v13-row"><span>记录数</span><span class="v13-value">${displayValue(item.recordCount)}</span></div><p>最近成功：${displayValue(item.lastSuccessAt)}</p>${['wanjia', 'huahuo', 'lingli'].includes(item.source) ? `<button class="v13-action" data-refresh-source="${escapeHtml(item.source)}">重新读取</button>` : ''}</article>`).join('')}</div>` : renderState('empty', '来源状态')}
  </section>`;
}
