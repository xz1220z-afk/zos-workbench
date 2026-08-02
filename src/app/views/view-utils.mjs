export const VIEW_STATES = Object.freeze(['loading', 'empty', 'stale', 'failed', 'conflict']);

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function stateMessage(state, label = '数据') {
  return {
    loading: `${label}正在读取…`,
    empty: `${label}暂无可展示内容`,
    stale: `${label}已过期，请刷新来源`,
    failed: `${label}读取失败，请查看数据健康页`,
    conflict: `${label}存在跨端冲突，等待你选择版本`,
  }[state] || '';
}

export function renderState(state, label) {
  const normalized = VIEW_STATES.includes(state) ? state : 'empty';
  return `<div class="v13-state" data-state="${normalized}">${escapeHtml(stateMessage(normalized, label))}</div>`;
}

export function displayValue(value, fallback = '—') {
  return value === 0 || (value != null && value !== '') ? escapeHtml(value) : fallback;
}
