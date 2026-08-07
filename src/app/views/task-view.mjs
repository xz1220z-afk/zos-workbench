import { escapeHtml } from './view-utils.mjs?v=2.1.0';
import { taskCompletion } from '../task-center.mjs?v=2.1.0';

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function taskCard(task) {
  const completion = taskCompletion(task);
  const due = task.dueAt ? task.dueAt.slice(0, 16).replace('T', ' ') : '待安排';
  return `<article class="task-center-card" data-task-id="${escapeHtml(task.id || '')}">
    <button class="task-check" data-task-toggle="${escapeHtml(task.id || '')}" aria-label="完成任务">${['done', 'completed'].includes(task.status) ? '✓' : ''}</button>
    <div><div class="task-card-meta"><span data-priority="${Number(task.priority) || 0}">P${Number(task.priority) || 0}</span><span>${escapeHtml(task.company || 'ceo')}</span><time>${escapeHtml(due)}</time></div><h3>${escapeHtml(task.title)}</h3>${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}${completion.total ? `<small>子任务 ${completion.completed}/${completion.total} · ${completion.percent}%</small>` : ''}</div>
    <button class="v13-action" data-task-edit="${escapeHtml(task.id || '')}">编辑</button>
  </article>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const tasks = viewModel.tasks || [];
  const draft = viewModel.taskDraft || {};
  const drawer = viewModel.taskDrawerOpen ? `<aside class="task-drawer" role="dialog" aria-modal="true" aria-labelledby="taskEditorTitle">
    <form id="richTaskForm" data-task-form>
      <header><div><span class="v14-kicker">EXECUTION TASK</span><h2 id="taskEditorTitle">${draft.id ? '编辑任务' : '新建任务'}</h2></div><button type="button" data-task-close aria-label="关闭">×</button></header>
      <input type="hidden" name="id" value="${escapeHtml(draft.id || '')}">
      <label class="task-field task-field-wide">标题<input id="task-title" name="title" required maxlength="200" value="${escapeHtml(draft.title || '')}" placeholder="下一步要完成什么？"></label>
      <label class="task-field task-field-wide">说明<textarea id="task-description" name="description" rows="3" placeholder="背景、交付标准或注意事项">${escapeHtml(draft.description || '')}</textarea></label>
      <label class="task-field">开始时间<input id="task-start-at" name="startAt" type="datetime-local" value="${escapeHtml((draft.startAt || '').slice(0, 16))}"></label>
      <label class="task-field">截止时间<input id="task-due-at" name="dueAt" type="datetime-local" value="${escapeHtml((draft.dueAt || '').slice(0, 16))}"></label>
      <label class="task-field task-inline"><input name="allDay" type="checkbox" ${draft.allDay ? 'checked' : ''}>全天任务</label>
      <label class="task-field">优先级<select id="task-priority" name="priority">${[0, 1, 2, 3].map((value) => option(String(value), `P${value}`, String(draft.priority ?? 0))).join('')}</select></label>
      <label class="task-field">公司<select id="task-company" name="company">${[['ceo','CEO'],['wanjia','万嘉'],['huahuo','花火'],['lingli','玲丽'],['life','个人']].map(([value,label]) => option(value,label,draft.company || 'ceo')).join('')}</select></label>
      <label class="task-field">标签<input id="task-tags" name="tags" value="${escapeHtml((draft.tags || []).join('、'))}" placeholder="经营、回款、交付"></label>
      <label class="task-field">项目<input id="task-project" name="projectId" value="${escapeHtml(draft.projectId || '')}" placeholder="项目 ID（可选）"></label>
      <label class="task-field">清单<input name="listId" value="${escapeHtml(draft.listId || '')}" placeholder="清单 ID（可选）"></label>
      <label class="task-field">业务类型<select name="businessEntityType">${[['','不绑定'],['merchant','商家'],['project','项目'],['intelligence','情报'],['client','客户']].map(([value,label]) => option(value,label,draft.businessEntityType || '')).join('')}</select></label>
      <label class="task-field">业务对象<input id="task-business-entity" name="businessEntityId" value="${escapeHtml(draft.businessEntityId || '')}" placeholder="商家/项目/情报 ID"></label>
      <label class="task-field">执行人<input name="assigneeIds" value="${escapeHtml((draft.assigneeIds || []).join('、'))}" placeholder="姓名或成员 ID，顿号分隔"></label>
      <label class="task-field">预计分钟<input id="task-estimate" name="estimateMinutes" type="number" min="1" max="1440" value="${escapeHtml(draft.estimateMinutes || '')}"></label>
      <label class="task-field">提醒时间<input id="task-reminder" name="reminderAt" type="datetime-local" value="${escapeHtml((draft.reminderAt || '').slice(0, 16))}"></label>
      <label class="task-field">重复<select id="task-recurrence" name="recurrence">${[['','不重复'],['daily','每天'],['weekly','每周'],['monthly','每月'],['yearly','每年']].map(([value,label]) => option(value,label,draft.recurrence || '')).join('')}</select></label>
      <label class="task-field task-field-wide">子任务（每行一项）<textarea id="task-subtasks" name="subtasks" rows="4" placeholder="联系负责人&#10;核对数据&#10;提交结果">${escapeHtml((draft.subtasks || []).map((item) => item.title).join('\n'))}</textarea></label>
      <footer>${draft.id ? `<button type="button" class="v13-action task-delete-action" data-task-delete="${escapeHtml(draft.id)}">删除任务</button>` : ''}<button type="button" class="v13-action" data-task-close>取消</button><button class="v13-action v13-action-primary" type="submit">保存任务</button></footer>
    </form>
  </aside><div class="task-drawer-backdrop" data-task-close></div>` : '';
  container.innerHTML = `<section class="task-center-shell"><div class="v14-section-head"><div><span class="v14-kicker">TASK CENTER · 跨端同步</span><h3>执行任务</h3><p>任务可绑定公司、项目、商家、提醒与专注记录。</p></div><button class="v13-action v13-action-primary" data-task-capture>＋ 新建任务</button></div><div class="task-center-list">${tasks.map(taskCard).join('') || '<div class="v13-state" data-state="empty">暂无任务，先建立一个明确的下一步动作。</div>'}</div>${drawer}</section>`;
}
