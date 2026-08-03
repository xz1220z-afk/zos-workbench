import { displayValue, renderState } from './view-utils.mjs';
import { formatCurrency } from '../value-utils.mjs';

export function render(container, viewModel = {}) {
  if (!container) return;
  const source = viewModel.sources?.lingli;
  const company = viewModel.companyOperating?.lingli;
  container.innerHTML = `<div class="company-cockpit" data-company="lingli">
    <article><span>招生线索</span><strong>${displayValue(company?.operations?.leads?.value)}</strong><small>飞书 ERP 事实</small></article>
    <article><span>在读学员</span><strong>${displayValue(company?.operations?.students?.value)}</strong><small>学员主表</small></article>
    <article><span>本月实收</span><strong>${formatCurrency(company?.finance?.cashIn?.value)}</strong><small>收入成本管理</small></article>
    <article><span>课消完成</span><strong>${displayValue(company?.operations?.consumed?.value)}</strong><small>排课课时管理</small></article>
  </div><div class="v14-section">${source ? '' : renderState('empty', '玲丽教育实时数据')}<p class="truth-note">统一经营口径已启用；未被飞书真实记录证明的指标保持“—”，不会用示例数或 0 代替。</p></div>`;
}
