import { displayValue, escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs?v=2.8.2';

export { VIEW_STATES };

export function render(container, viewModel = {}) {
  if (!container) return;
  if (VIEW_STATES.includes(viewModel.state)) {
    container.innerHTML = renderState(viewModel.state, '经营目标');
    return;
  }
  const gaps = Array.isArray(viewModel.gaps) ? viewModel.gaps : [];
  const targetForm = `<form id="confirmedTargetForm" class="v13-panel v13-target-form">
    <h3>设置已确认目标</h3>
    <label>指标<select name="metricKey" required>
      <option value="wanjia.paymentGmv">万嘉 · 支付 GMV</option>
      <option value="wanjia.redeemedGmv">万嘉 · 核销 GMV</option>
      <option value="wanjia.activeMerchants">万嘉 · 动销商家</option>
      <option value="huahuo.contractAmount">花火 · 合同金额</option>
      <option value="huahuo.receivedAmount">花火 · 已回款</option>
      <option value="huahuo.outstandingAmount">花火 · 待回款</option>
      <option value="huahuo.activeProjects">花火 · 在制项目</option>
      <option value="huahuo.pendingDeliveries">花火 · 待交付</option>
    </select></label>
    <label>目标值<input name="value" type="number" min="0" step="any" required></label>
    <label>周期<input name="period" type="month" required></label>
    <p>保存代表你已人工确认；系统不会根据历史数据自动推断。</p>
    <button class="v13-action v13-action-primary" type="submit">确认目标</button>
  </form>`;
  container.innerHTML = `${targetForm}${gaps.length ? `<div class="v13-grid">${gaps.map((item) => `<article class="v13-panel">
    <h3>${escapeHtml(item.label || item.metricKey)}</h3>
    <div class="v13-row"><span>目标</span><span class="v13-value">${displayValue(item.target)}</span></div>
    <div class="v13-row"><span>实际</span><span class="v13-value">${displayValue(item.actual)}</span></div>
    <div class="v13-row"><span>差距</span><span class="v13-value">${displayValue(item.gap)}</span></div>
  </article>`).join('')}</div>` : renderState('empty', '已确认目标')}`;
}
