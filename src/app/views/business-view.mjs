import { displayValue, escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs?v=2.12.1';

export { VIEW_STATES };

export function render(container, viewModel = {}) {
  if (!container) return;
  if (VIEW_STATES.includes(viewModel.state)) {
    container.innerHTML = renderState(viewModel.state, viewModel.label || '业务数据');
    return;
  }
  const metrics = Array.isArray(viewModel.metrics) ? viewModel.metrics : [];
  container.innerHTML = `<article class="v13-panel">
    <h3>${escapeHtml(viewModel.label || '业务事实')}</h3>
    ${metrics.map((metric) => `<div class="v13-row"><span>${escapeHtml(metric.label)}</span><span class="v13-value">${displayValue(metric.value)}</span></div>`).join('') || renderState('empty', '业务指标')}
    ${viewModel.writeAvailable ? '<button class="v13-action" data-business-preview>预览更新</button>' : '<p>当前为只读汇总。</p>'}
  </article>`;
}
