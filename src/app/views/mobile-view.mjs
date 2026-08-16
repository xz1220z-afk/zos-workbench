import { escapeHtml } from './view-utils.mjs?v=2.12.0';
import { partitionDecisions } from '../decision-center.mjs?v=2.12.0';
import { humanText } from '../value-utils.mjs?v=2.12.0';
import { buildMobileDashboard } from '../mobile-dashboard.mjs?v=2.12.0';

function count(items) { return Array.isArray(items) ? items.length : 0; }

const METRIC_LABELS = Object.freeze({ total: 'Agent 总数', running: '运行中', completed: '已完成', failed: '需处理' });
const SECTION_LABELS = Object.freeze({ companies: '公司经营', calendar: '今日日程', intelligence: '行业情报', health: '数据健康' });
const LEGACY_SECTION_IDS = Object.freeze({ companies: 'mobile-business-exceptions', calendar: 'mobile-quick-capture', intelligence: 'mobile-target-gaps', health: 'mobile-health' });

function renderTopActions(actions) {
  const items = actions.length
    ? actions.map((item, index) => `<li><strong>0${index + 1} · ${escapeHtml(humanText(item.title || item.factSummary || item.id, '待确认行动'))}</strong><small>${escapeHtml(humanText(item.reason, '今日优先行动'))}</small></li>`).join('')
    : '<li><strong>暂未生成行动</strong><small>刷新来源后会显示今日优先事项。</small></li>';
  return `<section id="mobile-today" class="mobile-ceo-panel mobile-ceo-actions"><header><h3>今日 Top 3</h3><button class="v13-action" data-page="today">查看行动</button></header><ol>${items}</ol></section>`;
}

function renderMobileSections(sections) {
  return `<section class="mobile-ceo-sections" aria-label="行动摘要">${sections.map((section) => `<details id="${LEGACY_SECTION_IDS[section.id]}" class="mobile-ceo-summary"><summary><span>${SECTION_LABELS[section.id]}</span><strong>${section.count}</strong></summary><p>${section.count ? `有 ${section.count} 项需要查看。` : '当前没有需要处理的事项。'}</p><button class="v13-action" data-page="${section.pageId}">查看${SECTION_LABELS[section.id]}</button></details>`).join('')}</section>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const decisions = partitionDecisions(viewModel.decisions).ceo;
  const mobile = buildMobileDashboard(viewModel);
  container.innerHTML = `<section id="mobile-decisions" class="mobile-ceo-head"><small>CEO ACTION COCKPIT</small><h2>${escapeHtml(mobile.headline.title)}</h2><p>${escapeHtml(mobile.headline.summary)}</p><span>${count(decisions)} 项需要确认</span></section>
    <section class="mobile-agent-metrics" aria-label="Agent 运行状态">${Object.entries(mobile.agentMetrics).map(([key, value]) => `<article data-agent-metric="${key}"><strong>${value}</strong><span>${METRIC_LABELS[key]}</span></article>`).join('')}</section>
    ${renderTopActions(mobile.topActions)}${renderMobileSections(mobile.sections)}`;
}
