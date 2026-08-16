import { escapeHtml } from './view-utils.mjs?v=2.10.0';

function clock(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const session = viewModel.focusSession || null;
  const snapshot = viewModel.focusSnapshot || { state: 'planned', remainingSeconds: 25 * 60 };
  const tasks = viewModel.focusTasks || [];
  const summary = viewModel.focusSummary || { today: { minutes: 0, sessions: 0 }, week: { minutes: 0, sessions: 0 } };
  const state = snapshot.state || 'planned';
  const controls = state === 'running'
    ? '<button data-focus-action="pause">暂停</button><button data-focus-action="finish">完成</button>'
    : state === 'paused'
      ? '<button data-focus-action="resume">继续</button><button data-focus-action="finish">完成</button>'
      : '<button class="v13-action-primary" data-focus-action="start">开始专注</button>';

  container.innerHTML = `<section class="focus-shell" data-focus-state="${escapeHtml(state)}">
    <div class="focus-hero"><span class="v14-kicker">FOCUS · 本机计时可恢复</span><h2>一次只做一件重要的事</h2><p>计时由开始时间计算，切到其他页面或锁屏后仍可恢复。</p></div>
    <div class="focus-timer" role="timer" aria-live="polite">${clock(snapshot.remainingSeconds)}</div>
    <div class="focus-presets" role="group" aria-label="专注时长"><button data-focus-duration="25">25 / 5</button><button data-focus-duration="50">50 / 10</button><button data-focus-duration="custom">自定义</button></div>
    <label class="focus-task-binding">关联任务<select data-focus-task><option value="">不关联任务</option>${tasks.map((task) => `<option value="${escapeHtml(task.id)}" ${session?.taskId === task.id ? 'selected' : ''}>${escapeHtml(task.title)}</option>`).join('')}</select></label>
    <div class="focus-controls">${controls}${['running', 'paused'].includes(state) ? '<button data-focus-action="cancel">取消</button>' : ''}</div>
    <div class="focus-summary"><article><span>今日专注</span><strong>${summary.today.minutes} 分钟</strong><small>${summary.today.sessions} 次</small></article><article><span>近 7 天</span><strong>${summary.week.minutes} 分钟</strong><small>${summary.week.sessions} 次</small></article></div>
  </section>`;
}
