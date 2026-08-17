import { escapeHtml, renderState } from './view-utils.mjs?v=2.12.1';
import { formatCurrency } from '../value-utils.mjs?v=2.12.1';

function valueOf(item) {
  if (!item.available) return '—';
  return item.format === 'currency' ? formatCurrency(item.value) : new Intl.NumberFormat('zh-CN').format(item.value);
}

function sourceText(source = {}) {
  if (source.state === 'synced') return `已连接 · ${source.recordCount ?? '—'} 条真实记录`;
  if (source.state === 'failed') return `读取失败 · ${source.safeCode || '待检查'}`;
  return '等待真实数据连接';
}

export function render(container, viewModel = {}, company) {
  if (!container) return;
  const cockpit = viewModel.companyCockpits?.[company];
  if (!cockpit) { container.innerHTML = renderState('empty', '公司经营驾驶舱'); return; }
  const updated = cockpit.source.updatedAt ? new Date(cockpit.source.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '尚未成功读取';
  container.innerHTML = `<div class="company-operating-stack" data-company-cockpit="${escapeHtml(company)}">
    <section class="company-tier company-tier-summary"><header><div><span class="v13-eyebrow">CEO OVERVIEW</span><h2>CEO 总览</h2></div><span class="source-pill">${escapeHtml(sourceText(cockpit.source))}</span></header><div class="company-summary-grid">${cockpit.summary.map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(valueOf(item))}</strong><small>${item.available ? '飞书 ERP 事实' : '真实字段暂不可用'}</small></article>`).join('')}</div></section>
    <section class="company-tier"><header><div><span class="v13-eyebrow">OPERATING ANALYSIS</span><h2>经营分析</h2></div></header><div class="company-analysis-grid">${cockpit.analysis.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><small>${cockpit.source.state === 'synced' ? '基于当前事实源分析' : '连接后自动生成经营判断'}</small></article>`).join('')}</div></section>
    <section class="company-tier company-risk-intel-grid"><div><header><h2>当前风险</h2><span>${cockpit.risks.length} 条</span></header>${cockpit.risks.length ? `<div class="v13-list">${cockpit.risks.map((item) => `<div class="v13-row"><strong>${escapeHtml(item.factSummary || item.title || '待核对事项')}</strong></div>`).join('')}</div>` : renderState('empty', '当前风险')}</div><div><header><h2>相关情报</h2><span>${cockpit.intelligence.length} 条</span></header>${cockpit.intelligence.length ? `<div class="v13-list">${cockpit.intelligence.map((item) => `<div class="v13-row"><strong>${escapeHtml(item.title)}</strong></div>`).join('')}</div>` : renderState('empty', '相关情报')}</div></section>
    <section class="company-tier company-tier-evidence"><header><div><span class="v13-eyebrow">SOURCE EVIDENCE</span><h2>原始明细与专业工具</h2><p>更新于 ${escapeHtml(updated)} · 不虚构空缺指标。</p></div><button class="v13-action v13-action-primary" data-company-specialist="${escapeHtml(cockpit.specialistAction.targetId)}">${escapeHtml(cockpit.specialistAction.label)}</button></header></section>
  </div>`;
}
