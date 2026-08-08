import { escapeHtml, renderState } from './view-utils.mjs?v=2.6.0';

const COMPANY = { wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', ceo: 'CEO' };

export function render(container, viewModel = {}) {
  if (!container) return;
  const items = viewModel.relations || [];
  container.innerHTML = items.length ? `<div class="relation-list">${items.map((item) => `<article class="relation-card"><div><span class="source-pill">${escapeHtml(COMPANY[item.company] || item.company)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.nextAction || '尚未设置下一次行动')}</p></div><div><strong>${escapeHtml(item.owner || '负责人待确认')}</strong><time>${escapeHtml(item.dueAt?.slice(0, 10) || '日期待确认')}</time></div></article>`).join('')}</div>` : renderState('empty', '真实客户与联系人');
}
