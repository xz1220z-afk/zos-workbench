export const VIEW_STATES = Object.freeze([
  'loading', 'empty', 'stale', 'failed', 'conflict',
  'authentication_required', 'pending_configuration',
]);

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
    authentication_required: `登录 Supabase 后读取${label}`,
    pending_configuration: '情报来源尚未配置；工作台已上线，等待确认候选池目标表',
  }[state] || '';
}

export function renderState(state, label) {
  const normalized = VIEW_STATES.includes(state) ? state : 'empty';
  return `<div class="v13-state" data-state="${normalized}">${escapeHtml(stateMessage(normalized, label))}</div>`;
}

export function displayValue(value, fallback = '—') {
  const text = humanText(value, '');
  return text ? escapeHtml(text) : fallback;
}
import { humanText } from '../value-utils.mjs?v=2.9.0';
