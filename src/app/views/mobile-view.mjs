import { escapeHtml } from './view-utils.mjs?v=2.0.2';
import { partitionDecisions } from '../decision-center.mjs?v=2.0.2';

function count(items) { return Array.isArray(items) ? items.length : 0; }

export function render(container, viewModel = {}) {
  if (!container) return;
  const decisions = partitionDecisions(viewModel.decisions).ceo;
  container.innerHTML = `
    <section id="mobile-decisions" class="v13-panel v13-mobile-section"><h3>🔴 待我决策</h3><p>${count(decisions)} 项需要确认</p></section>
    <section id="mobile-today" class="v13-panel v13-mobile-section"><h3>◎ 今日 Top 3</h3><p>${count(viewModel.todayTop3)} 项优先行动</p></section>
    <section id="mobile-business-exceptions" class="v13-panel v13-mobile-section"><h3>经营异常</h3><p>${count(viewModel.businessExceptions)} 项需要关注</p></section>
    <section id="mobile-quick-capture" class="v13-panel v13-mobile-section"><h3>快速收集</h3><button class="v13-action" data-quick-capture>＋ 记录想法或任务</button></section>
    <section id="mobile-target-gaps" class="v13-panel v13-mobile-section"><h3>🎯 目标差距</h3><p>${count(viewModel.gaps)} 项已确认目标</p></section>
    <section id="mobile-health" class="v13-panel v13-mobile-section"><h3>◉ 数据健康</h3><p>${escapeHtml(viewModel.syncStatus || '等待首次同步')}</p></section>`;
}
