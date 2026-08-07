import { escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs?v=2.0.3';
import { humanText } from '../value-utils.mjs?v=2.0.3';
import { partitionDecisions } from '../decision-center.mjs?v=2.0.3';

export { VIEW_STATES };

function decisionTitle(item) {
  return item.status === 'pending_resolution'
    ? humanText(item.decisionNote, '来源风险已消失，待确认解除')
    : humanText(item.factSummary || item.title, '待核对事项');
}

function decisionCards(items, options = {}) {
  if (!items.length) return renderState('empty', options.emptyLabel || '当前分组');
  return `<div class="v13-grid">${items.map((item) => `<article class="v13-panel">
    <span class="v13-chip v13-severity-${escapeHtml(humanText(item.severity, 'medium'))}">${escapeHtml(humanText(item.severity, '待判断'))}</span>
    <h3>${escapeHtml(decisionTitle(item))}</h3>
    <p>${options.history ? '处理记录' : '下一步'}：${escapeHtml(humanText(options.history ? item.decisionNote : item.recommendedAction, options.history ? '已保留历史记录' : '暂无建议'))}</p>
    ${options.allowPreview && item.writeAvailable !== false ? `<button class="v13-action" data-preview-decision="${escapeHtml(item.id)}">预览更新</button>` : ''}
  </article>`).join('')}</div>`;
}

function decisionSection(title, count, items, options = {}) {
  return `<section class="decision-center-section ${options.history ? 'is-history' : ''}">
    <header class="v14-section-head"><div><h2>${escapeHtml(title)} <span class="v13-chip">${count}</span></h2><p>${escapeHtml(options.description || '')}</p></div></header>
    ${decisionCards(items, options)}
  </section>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  if (VIEW_STATES.includes(viewModel.state)) {
    container.innerHTML = renderState(viewModel.state, '决策中心');
    return;
  }
  const decisions = Array.isArray(viewModel.decisions) ? viewModel.decisions : [];
  const queues = partitionDecisions(decisions);
  const preview = viewModel.preview;
  container.innerHTML = `
    <div class="decision-center-stack">
      <section class="decision-center-summary v14-kpi-grid">
        <article><span>需要你决定</span><strong>${queues.ceo.length}</strong><small>价格、回款、资源与重大交付</small></article>
        <article><span>负责人跟进</span><strong>${queues.followUp.length}</strong><small>不占用 CEO 决策提醒</small></article>
        <article><span>已解除历史</span><strong>${queues.history.length}</strong><small>保留记录，可随时追溯</small></article>
      </section>
      ${decisionSection('需要你决定', queues.ceo.length, queues.ceo, { allowPreview: true, emptyLabel: 'CEO 决策', description: '只保留真正需要你拍板的事项。' })}
      ${decisionSection('负责人跟进', queues.followUp.length, queues.followUp, { emptyLabel: '负责人跟进', description: '由业务负责人推进，不再占用你的决策角标。' })}
      ${decisionSection('已解除历史', queues.history.length, queues.history, { history: true, emptyLabel: '决策历史', description: '历史完整保留，不删除原始数据。' })}
    </div>
    ${preview ? `<aside class="v13-panel v13-approval-preview" role="dialog" aria-modal="true" aria-label="飞书更新预览">
      <h3>飞书更新预览</h3><p>${escapeHtml(humanText(preview.fieldName, '待确认字段'))}</p>
      <div class="v13-before-after"><span>${escapeHtml(humanText(preview.before, '—'))}</span><span class="v13-before-after-arrow">→</span><strong>${escapeHtml(humanText(preview.after, '—'))}</strong></div>
      <p>确认后只修改这个字段，并立即回读核验。</p>
      <button class="v13-action v13-action-primary" data-execute-approval="${escapeHtml(preview.approvalId)}">确认执行</button>
    </aside>` : ''}`;
}
