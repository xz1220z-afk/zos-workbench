import { displayValue, escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs';

export { VIEW_STATES };

function decisionRows(decisions = []) {
  if (!decisions.length) return renderState('empty', '待我决策');
  return `<div class="v13-list">${decisions.slice(0, 4).map((item) => `
    <div class="v13-row"><div><strong>${escapeHtml(item.factSummary || item.title)}</strong><div class="v13-meta">${escapeHtml(item.recommendedAction || '等待人工判断')}</div></div><span class="v13-chip">${escapeHtml(item.severity || '关注')}</span></div>
  `).join('')}</div>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const state = viewModel.state;
  if (VIEW_STATES.includes(state)) {
    container.innerHTML = renderState(state, 'CEO 总览');
    return;
  }
  const health = Array.isArray(viewModel.health) ? viewModel.health : [];
  const synced = health.filter((item) => item.state === 'synced').length;
  container.innerHTML = `
    <div class="v13-grid v13-desktop-only">
      <article class="v13-panel v13-panel-wide"><h3>◎ 待我决策</h3>${decisionRows(viewModel.decisions)}</article>
      <article class="v13-panel"><h3>🎯 目标差距</h3><div class="v13-value">${displayValue(viewModel.gaps?.length)}</div><p>仅统计已确认目标</p></article>
      <article class="v13-panel"><h3>◉ 数据健康</h3><div class="v13-value">${synced}/${health.length || '—'}</div><p>正常来源 / 全部来源</p></article>
      <article class="v13-panel"><h3>📓 今日简报</h3><div class="v13-value">${viewModel.brief ? '待审核' : '—'}</div><p>不会自动外发</p></article>
    </div>
    <div id="mobileDashboardRoot" class="v13-mobile-dashboard"></div>`;
}
