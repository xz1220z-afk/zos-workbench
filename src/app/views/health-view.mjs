import { displayValue, escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs';

export { VIEW_STATES };

export function render(container, viewModel = {}) {
  if (!container) return;
  if (VIEW_STATES.includes(viewModel.state)) {
    container.innerHTML = renderState(viewModel.state, '数据健康');
    return;
  }
  const health = Array.isArray(viewModel.health) ? viewModel.health : [];
  container.innerHTML = health.length ? `<div class="v13-grid">${health.map((item) => `<article class="v13-panel">
    <div class="v13-row"><h3>${escapeHtml(item.label || item.source)}</h3><span class="v13-chip">${escapeHtml(item.state)}</span></div>
    <div class="v13-row"><span>记录数</span><span class="v13-value">${displayValue(item.recordCount)}</span></div>
    <p>最近成功：${displayValue(item.lastSuccessAt)}</p>
  </article>`).join('')}</div>` : renderState('empty', '来源状态');
}
