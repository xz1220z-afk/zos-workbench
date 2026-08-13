import { escapeHtml } from './view-utils.mjs?v=2.8.3';

const STATE_LABELS = {
  no_schedule_evidence: '当前日期没有可核验排期，不能据此判断团队空闲',
  insufficient_roster_evidence: '存在未分配人员的项目，请先补齐排期',
  conflict_detected: '发现人员时间冲突',
  partial_schedule_evidence: '有项目缺少开始或结束时间',
  scheduled_no_conflict: '已有排期中未发现人员冲突',
};

export function render(container, viewModel = {}) {
  if (!container) return;
  const result = viewModel.availability || { assignments: [], conflicts: [], gaps: [], availabilityState: 'no_schedule_evidence' };
  const queryDate = viewModel.availabilityDate || new Date().toISOString().slice(0, 10);
  container.innerHTML = `<section class="availability-shell"><div class="v14-section-head"><div><span class="v14-kicker">HUAHUO AVAILABILITY · 只读</span><h3>花火档期查询</h3><p>查询当天项目、人员与冲突；不会自动分配人员或回写飞书。</p></div><form data-availability-form><input type="date" name="date" value="${escapeHtml(queryDate)}"><button class="v13-action v13-action-primary">查询档期</button></form></div><div class="availability-state" data-state="${escapeHtml(result.availabilityState)}">${escapeHtml(STATE_LABELS[result.availabilityState] || result.availabilityState)}</div>${result.conflicts.length ? `<div class="availability-conflicts">${result.conflicts.map((item) => `<p>⚠ ${escapeHtml(item.person)}：${item.projectIds.map(escapeHtml).join(' / ')}</p>`).join('')}</div>` : ''}<div class="availability-grid">${result.assignments.map((item) => `<article><time>${escapeHtml(item.startAt?.slice(11, 16) || '时间待补')}–${escapeHtml(item.endAt?.slice(11, 16) || '待补')}</time><h4>${escapeHtml(item.projectName)}</h4><p>${escapeHtml(item.clientName || '客户待补')} · ${escapeHtml(item.location || '地点待补')}</p><strong>${item.members.length ? item.members.map(escapeHtml).join('、') : '人员未分配'}</strong><span>${item.roles.length ? item.roles.map(escapeHtml).join('、') : '角色待补'}</span></article>`).join('') || '<div class="v13-state" data-state="empty">所选日期暂无排期记录。</div>'}</div></section>`;
}
