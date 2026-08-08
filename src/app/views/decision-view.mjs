import { escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs?v=2.3.0';
import { humanText } from '../value-utils.mjs?v=2.3.0';
import { classifyDecision, partitionDecisions } from '../decision-center.mjs?v=2.3.0';

export { VIEW_STATES };

const ACTION_LABELS = Object.freeze({
  approve: '采纳建议', delegate: '交负责人', defer: '暂缓处理',
  resolve: '确认解除', reopen: '重新打开', escalate: '转回待我决策', source: '查看来源',
});

function decisionTitle(item) {
  return item.status === 'pending_resolution'
    ? humanText(item.decisionNote, '来源风险已消失，待确认解除')
    : humanText(item.factSummary || item.title, '待核对事项');
}

function companyOf(item) {
  return humanText(item.company || item.source, 'other').toLowerCase();
}

function matchesFilters(item, ui) {
  const query = humanText(ui.search, '').toLowerCase();
  if (query && ![decisionTitle(item), item.recommendedAction, item.decisionNote, item.source]
    .some((value) => humanText(value, '').toLowerCase().includes(query))) return false;
  if (ui.company !== 'all' && companyOf(item) !== ui.company) return false;
  if (ui.status !== 'all' && humanText(item.status, '') !== ui.status) return false;
  return true;
}

function actionButton(item, action, label, kind = '') {
  return `<button class="v13-action ${kind}" type="button" data-decision-id="${escapeHtml(item.id)}" data-decision-action="${action}">${label}</button>`;
}

function sourceButton(item) {
  return `<button class="v13-action v13-action-quiet" type="button" data-decision-source="${escapeHtml(item.id)}">查看来源</button>`;
}

function ceoCard(item) {
  return `<article class="v13-panel decision-card decision-card-ceo" data-decision-card="${escapeHtml(item.id)}">
    <div class="decision-card-meta"><span class="v13-chip v13-severity-${escapeHtml(humanText(item.severity, 'medium'))}">${escapeHtml(humanText(item.severity, '待判断'))}</span><span>${escapeHtml(companyOf(item))}</span></div>
    <h3>${escapeHtml(decisionTitle(item))}</h3>
    <p>建议：${escapeHtml(humanText(item.recommendedAction, '暂无建议，请先核对事实来源'))}</p>
    <div class="decision-card-actions">
      ${actionButton(item, 'approve', '采纳建议', 'v13-action-primary')}
      ${actionButton(item, 'delegate', '交负责人')}
      ${actionButton(item, 'defer', '暂缓')}
      ${sourceButton(item)}
    </div>
  </article>`;
}

function ownerCard(item) {
  return `<article class="v13-panel decision-card decision-card-owner" data-decision-card="${escapeHtml(item.id)}">
    <div class="decision-card-meta"><span class="v13-chip">负责人跟进</span><span>${escapeHtml(companyOf(item))}</span></div>
    <h3>${escapeHtml(decisionTitle(item))}</h3>
    <p>${escapeHtml(humanText(item.decisionNote || item.recommendedAction, '等待负责人更新下一步'))}</p>
    <div class="decision-card-actions">${actionButton(item, 'escalate', '转回待我决策')}${sourceButton(item)}</div>
  </article>`;
}

function historyRow(item, selected = false) {
  const pending = item.status === 'pending_resolution';
  const deferred = item.status === 'deferred';
  return `<article class="decision-history-row" data-decision-card="${escapeHtml(item.id)}">
    <label class="decision-select-control"><input type="checkbox" data-decision-select="${escapeHtml(item.id)}" aria-label="选择${escapeHtml(decisionTitle(item))}" ${selected ? 'checked' : ''}><span aria-hidden="true"></span></label>
    <div><span class="v13-chip">${escapeHtml(humanText(item.status, '历史'))}</span><strong>${escapeHtml(decisionTitle(item))}</strong><small>${escapeHtml(humanText(item.decisionNote, '已保留完整处理记录'))}</small></div>
    <div class="decision-history-actions">
      ${pending ? actionButton(item, 'resolve', '确认解除', 'v13-action-primary') : ''}
      ${(pending || deferred) ? actionButton(item, 'reopen', '重新打开') : ''}
      ${sourceButton(item)}
    </div>
  </article>`;
}

function section(title, count, items, kind, description, total, selectedIds = new Set()) {
  const cards = kind === 'history'
    ? `<div class="decision-history-list">${items.map((item) => historyRow(item, selectedIds.has(item.id))).join('')}</div>`
    : `<div class="v13-grid decision-card-grid">${items.map(kind === 'ceo' ? ceoCard : ownerCard).join('')}</div>`;
  const empty = renderState('empty', title);
  return `<section id="decision-${kind}" class="decision-center-section ${kind === 'history' ? 'is-history' : ''}" data-decision-section="${kind}">
    <header class="v14-section-head"><div><h2>${escapeHtml(title)} <span class="v13-chip">${count}</span></h2><p>${escapeHtml(description)}</p></div>${kind === 'history' && items.length ? `<button class="v13-action" type="button" data-decision-select-visible data-decision-visible-ids="${escapeHtml(items.map((item) => item.id).join(','))}">勾选本页</button>` : ''}</header>
    ${items.length ? cards : empty}
    ${items.length < total ? `<button class="v13-action decision-load-more" type="button" data-decision-load-more="${kind === 'owner' ? 'followUp' : kind}">再显示 12 条</button>` : ''}
  </section>`;
}

function drawer(decisions, ui) {
  const action = ui.action;
  if (!action) return '';
  const item = decisions.find((candidate) => candidate.id === action.decisionId);
  if (!item) return '';
  const isSource = action.action === 'source';
  const label = ACTION_LABELS[action.action] || '处理决策';
  const sourceUrl = (() => {
    try {
      const url = new URL(humanText(item.sourceUrl, ''));
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  })();
  const canPreviewWrite = classifyDecision(item) === 'ceo' && item.status === 'open' && item.writeAvailable !== false;
  return `<div class="decision-drawer-backdrop" data-decision-close></div>
    <aside class="decision-action-drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(label)}">
      <header><div><span class="v13-chip">${escapeHtml(companyOf(item))}</span><h2>${escapeHtml(label)}</h2></div><button class="v13-action v13-action-icon" type="button" data-decision-close aria-label="关闭">×</button></header>
      <div class="decision-drawer-fact"><small>事实</small><strong>${escapeHtml(decisionTitle(item))}</strong><p>${escapeHtml(humanText(item.recommendedAction, '暂无系统建议'))}</p></div>
      ${isSource ? `<div class="decision-source-detail"><dl><dt>来源系统</dt><dd>${escapeHtml(humanText(item.source, '未知来源'))}</dd><dt>记录编号</dt><dd>${escapeHtml(humanText(item.sourceRecordId, item.id))}</dd><dt>更新时间</dt><dd>${escapeHtml(humanText(item.sourceUpdatedAt, '未提供'))}</dd></dl>${sourceUrl ? `<a class="v13-action v13-action-primary" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">打开真实来源</a>` : '<p class="decision-inline-note">当前记录没有可验证的网页链接，已展示来源详情。</p>'}${canPreviewWrite ? `<button class="v13-action" type="button" data-preview-decision="${escapeHtml(item.id)}">预览更新</button>` : ''}</div>` : `<label class="decision-note-field"><span>处理备注</span><textarea data-decision-note rows="4" placeholder="写清负责人、时间或暂缓原因">${escapeHtml(humanText(action.note, ''))}</textarea></label>
      ${ui.error ? `<p class="decision-inline-error" role="alert">${escapeHtml(ui.error)}</p>` : ''}
      <footer><button class="v13-action" type="button" data-decision-close>取消</button><button class="v13-action v13-action-primary" type="button" data-decision-confirm ${ui.busy ? 'disabled aria-busy="true"' : ''}>${ui.busy ? '正在保存…' : `确认${escapeHtml(label)}`}</button></footer>`}
    </aside>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  if (VIEW_STATES.includes(viewModel.state)) {
    container.innerHTML = renderState(viewModel.state, '决策中心');
    return;
  }
  const decisions = Array.isArray(viewModel.decisions) ? viewModel.decisions : [];
  const ui = {
    action: null, busy: false, error: null, search: '', company: 'all', status: 'all',
    followUpLimit: 6, historyLimit: 6, undo: null, selectedIds: [], batchBusy: false, batchError: null,
    ...(viewModel.decisionUi || {}),
  };
  const queues = partitionDecisions(decisions);
  const filtered = {
    ceo: queues.ceo.filter((item) => matchesFilters(item, ui)),
    followUp: queues.followUp.filter((item) => matchesFilters(item, ui)),
    history: queues.history.filter((item) => matchesFilters(item, ui)),
  };
  const visibleFollowUp = filtered.followUp.slice(0, ui.followUpLimit);
  const visibleHistory = filtered.history.slice(0, ui.historyLimit);
  const selectedIds = new Set(Array.isArray(ui.selectedIds) ? ui.selectedIds : []);
  container.innerHTML = `
    <div class="decision-center-stack">
      <section class="decision-center-summary v14-kpi-grid">
        <button type="button" data-decision-jump="ceo"><span>需要你决定</span><strong>${queues.ceo.length}</strong><small>价格、回款、资源与重大交付</small></button>
        <button type="button" data-decision-jump="owner"><span>负责人跟进</span><strong>${queues.followUp.length}</strong><small>不占用 CEO 决策提醒</small></button>
        <button type="button" data-decision-jump="history"><span>处理历史</span><strong>${queues.history.length}</strong><small>记录不删除，可重新打开</small></button>
      </section>
      <section class="decision-toolbar" aria-label="决策筛选">
        <input type="search" data-decision-search value="${escapeHtml(ui.search)}" placeholder="搜索事实、建议或来源">
        <select data-decision-filter="company"><option value="all">全部公司</option>${['wanjia', 'huahuo', 'lingli', 'projects'].map((value) => `<option value="${value}" ${ui.company === value ? 'selected' : ''}>${value}</option>`).join('')}</select>
        <select data-decision-filter="status"><option value="all">全部状态</option>${['open', 'pending_resolution', 'deferred', 'approved', 'resolved'].map((value) => `<option value="${value}" ${ui.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select>
      </section>
      ${selectedIds.size ? `<section class="decision-batch-bar" aria-label="批量处理"><strong>已选择 ${selectedIds.size} 条</strong><div><button class="v13-action v13-action-primary" type="button" data-decision-batch="review_history" ${ui.batchBusy ? 'disabled' : ''}>标记已复核</button><button class="v13-action" type="button" data-decision-batch="reopen" ${ui.batchBusy ? 'disabled' : ''}>批量重新打开</button><button class="v13-action v13-action-quiet" type="button" data-decision-selection-clear>取消选择</button></div>${ui.batchError ? `<p role="alert">${escapeHtml(ui.batchError)}</p>` : ''}</section>` : ''}
      ${section('需要你决定', queues.ceo.length, filtered.ceo, 'ceo', '只保留真正需要你拍板的事项。', filtered.ceo.length, selectedIds)}
      ${section('负责人跟进', queues.followUp.length, visibleFollowUp, 'owner', '由负责人推进，可随时转回你拍板。', filtered.followUp.length, selectedIds)}
      ${section('处理历史', queues.history.length, visibleHistory, 'history', '历史完整保留，不删除原始数据。', filtered.history.length, selectedIds)}
    </div>
    ${drawer(decisions, ui)}
    ${ui.undo ? `<div class="decision-undo-toast" role="status"><span>${escapeHtml(humanText(ui.undo.message, '处理已保存'))}</span><button class="v13-action" type="button" data-decision-undo>撤销</button></div>` : ''}
    ${viewModel.preview ? `<aside class="v13-panel v13-approval-preview" role="dialog" aria-modal="true" aria-label="飞书更新预览"><h3>飞书更新预览</h3><p>${escapeHtml(humanText(viewModel.preview.fieldName, '待确认字段'))}</p><div class="v13-before-after"><span>${escapeHtml(humanText(viewModel.preview.before, '—'))}</span><span class="v13-before-after-arrow">→</span><strong>${escapeHtml(humanText(viewModel.preview.after, '—'))}</strong></div><p>确认后只修改这个字段，并立即回读核验。</p><button class="v13-action v13-action-primary" data-execute-approval="${escapeHtml(viewModel.preview.approvalId)}">确认执行</button></aside>` : ''}`;
}
