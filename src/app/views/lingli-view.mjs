import { renderState } from './view-utils.mjs';

export function render(container, viewModel = {}) {
  if (!container) return;
  const source = viewModel.sources?.lingli;
  container.innerHTML = `<div class="company-cockpit" data-company="lingli">
    <article><span>招生线索</span><strong>${source?.summary?.leads ?? '—'}</strong><small>飞书 ERP 事实</small></article>
    <article><span>在读学员</span><strong>${source?.summary?.students ?? '—'}</strong><small>学员主表</small></article>
    <article><span>本月实收</span><strong>${source?.summary?.received ?? '—'}</strong><small>现金日记账/收款</small></article>
    <article><span>课消完成</span><strong>${source?.summary?.consumed ?? '—'}</strong><small>考勤与课消</small></article>
  </div><div class="v14-section">${source ? '' : renderState('empty', '玲丽教育实时数据')}<p class="truth-note">结构已建立；在飞书 ERP 字段、权限和真实记录回读前，不显示示例人数、收入或课消。</p></div>`;
}

