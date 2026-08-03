import { displayValue, escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs';

export { VIEW_STATES };

export function render(container, viewModel = {}) {
  if (!container) return;
  if (VIEW_STATES.includes(viewModel.state)) {
    container.innerHTML = renderState(viewModel.state, '数据健康');
    return;
  }
  const health = Array.isArray(viewModel.health) ? viewModel.health : [];
  const automatic = viewModel.autoRefresh || {};
  const summary = automatic.phase === 'partial'
    ? `部分失败 ${automatic.failed?.length || 0} 个来源`
    : automatic.phase === 'refreshing' ? '后台更新中' : automatic.phase === 'offline' ? '离线使用缓存' : '自动更新已开启';
  container.innerHTML = `<article class="v13-panel v15-health-summary"><div class="v13-row"><h3>自动更新</h3><span class="v13-chip">${escapeHtml(summary)}</span></div>
    <p>工作台打开时每 15 分钟检查；回到前台或网络恢复会自动补刷新。</p><button class="v13-action" data-refresh-all>立即全部刷新</button></article>` + (health.length ? `<div class="v13-grid">${health.map((item) => `<article class="v13-panel">
    <div class="v13-row"><h3>${escapeHtml(item.label || item.source)}</h3><span class="v13-chip">${escapeHtml(item.state)}</span></div>
    <div class="v13-row"><span>记录数</span><span class="v13-value">${displayValue(item.recordCount)}</span></div>
    <p>最近成功：${displayValue(item.lastSuccessAt)}</p>
    ${['wanjia', 'huahuo', 'lingli'].includes(item.source) ? `<button class="v13-action" data-refresh-source="${escapeHtml(item.source)}">重新读取</button>` : ''}
  </article>`).join('')}</div>` : renderState('empty', '来源状态'));
}
