import { escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs?v=1.11.0';
import { humanText } from '../value-utils.mjs?v=1.11.0';

export { VIEW_STATES };

export function render(container, viewModel = {}) {
  if (!container) return;
  if (VIEW_STATES.includes(viewModel.state)) {
    container.innerHTML = renderState(viewModel.state, '决策中心');
    return;
  }
  const decisions = Array.isArray(viewModel.decisions) ? viewModel.decisions : [];
  const preview = viewModel.preview;
  container.innerHTML = `
    <div class="v13-grid">
      ${decisions.length ? decisions.map((item) => `<article class="v13-panel">
        <span class="v13-chip v13-severity-${escapeHtml(humanText(item.severity, 'medium'))}">${escapeHtml(humanText(item.severity, '待判断'))}</span>
        <h3>${escapeHtml(item.status === 'pending_resolution' ? humanText(item.decisionNote, '来源风险已消失，待确认解除') : humanText(item.factSummary || item.title, '待核对事项'))}</h3>
        <p>AI 建议：${escapeHtml(humanText(item.recommendedAction, '暂无建议'))}</p>
        ${item.writeAvailable === false ? '<p>此记录没有真实飞书身份，只能查看。</p>' : `<button class="v13-action" data-preview-decision="${escapeHtml(item.id)}">预览更新</button>`}
      </article>`).join('') : renderState('empty', '决策中心')}
    </div>
    ${preview ? `<aside class="v13-panel v13-approval-preview" role="dialog" aria-modal="true" aria-label="飞书更新预览">
      <h3>飞书更新预览</h3><p>${escapeHtml(humanText(preview.fieldName, '待确认字段'))}</p>
      <div class="v13-before-after"><span>${escapeHtml(humanText(preview.before, '—'))}</span><span class="v13-before-after-arrow">→</span><strong>${escapeHtml(humanText(preview.after, '—'))}</strong></div>
      <p>确认后只修改这个字段，并立即回读核验。</p>
      <button class="v13-action v13-action-primary" data-execute-approval="${escapeHtml(preview.approvalId)}">确认执行</button>
    </aside>` : ''}`;
}
