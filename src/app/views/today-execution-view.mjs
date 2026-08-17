import { escapeHtml } from './view-utils.mjs?v=2.12.1';

const GROUPS = [
  ['overdue', '已逾期'], ['allDay', '全天'], ['morning', '上午'],
  ['afternoon', '下午'], ['evening', '晚上'], ['unscheduled', '待安排'],
];

function taskRow(task) {
  const time = task.startAt ? task.startAt.slice(11, 16) : task.dueAt ? `截止 ${task.dueAt.slice(11, 16)}` : '未排时间';
  return `<article class="agenda-task" data-task-id="${escapeHtml(task.id || '')}"><button aria-label="完成任务" data-task-toggle="${escapeHtml(task.id || '')}"></button><div><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(time)} · ${escapeHtml(task.company || 'ceo')}</span></div><button data-task-edit="${escapeHtml(task.id || '')}">编辑</button></article>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const agenda = viewModel.agenda || {};
  const date = viewModel.agendaDate || new Date().toISOString().slice(0, 10);
  container.innerHTML = `<div class="today-execution-hero"><div><span class="v14-kicker">TODAY EXECUTION · ${escapeHtml(date)}</span><h2>今天按时间推进，不在页面间来回找</h2><p>任务、日程、逾期事项和待安排项集中在一张执行表。</p></div><button class="v13-action v13-action-primary" data-task-capture>＋ 快速添加</button></div><div class="agenda-groups">${GROUPS.map(([key, label]) => `<section class="agenda-group" data-agenda-group="${key}"><header><h3>${label}</h3><span>${(agenda[key] || []).length}</span></header>${(agenda[key] || []).map(taskRow).join('') || '<p class="agenda-empty">暂无</p>'}</section>`).join('')}</div>`;
}
