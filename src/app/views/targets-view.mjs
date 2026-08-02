import { displayValue, escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs';

export { VIEW_STATES };

export function render(container, viewModel = {}) {
  if (!container) return;
  if (VIEW_STATES.includes(viewModel.state)) {
    container.innerHTML = renderState(viewModel.state, '经营目标');
    return;
  }
  const gaps = Array.isArray(viewModel.gaps) ? viewModel.gaps : [];
  container.innerHTML = gaps.length ? `<div class="v13-grid">${gaps.map((item) => `<article class="v13-panel">
    <h3>${escapeHtml(item.label || item.metricKey)}</h3>
    <div class="v13-row"><span>目标</span><span class="v13-value">${displayValue(item.target)}</span></div>
    <div class="v13-row"><span>实际</span><span class="v13-value">${displayValue(item.actual)}</span></div>
    <div class="v13-row"><span>差距</span><span class="v13-value">${displayValue(item.gap)}</span></div>
  </article>`).join('')}</div>` : renderState('empty', '已确认目标');
}
