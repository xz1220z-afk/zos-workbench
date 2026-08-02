import { displayValue, escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs';

export { VIEW_STATES };

function decisionRows(decisions = []) {
  if (!decisions.length) return renderState('empty', '待我决策');
  return `<div class="v13-list">${decisions.slice(0, 4).map((item) => `
    <div class="v13-row"><div><strong>${escapeHtml(item.factSummary || item.title)}</strong><div class="v13-meta">${escapeHtml(item.recommendedAction || '等待人工判断')}</div></div><span class="v13-chip">${escapeHtml(item.severity || '关注')}</span></div>
  `).join('')}</div>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const state = viewModel.state;
  if (VIEW_STATES.includes(state)) {
    container.innerHTML = renderState(state, 'CEO 总览');
    return;
  }
  const health = Array.isArray(viewModel.health) ? viewModel.health : [];
  const synced = health.filter((item) => item.state === 'synced').length;
  const mustRead = viewModel.mustRead || [];
  const activeDecisions = (viewModel.decisions || []).filter((item) => ['open', 'pending_resolution'].includes(item.status));
  container.innerHTML = `<div class="v14-dashboard">
    <section class="v14-hero"><div><span class="v14-kicker">CEO COMMAND CENTER · ${escapeHtml(viewModel.today || '')}</span><h2>今天，先处理最重要的事</h2><p>事实来自飞书与 Supabase；AI 只做建议，所有正式写入须确认。</p><div class="v14-hero-actions"><button class="v13-action v13-action-primary" data-quick-capture>＋ 快速收集</button><button class="v13-action" data-page="tasks">新建任务</button><button class="v13-action" data-page="enterprise">查看项目</button></div></div><blockquote>战略决定方向，<br>系统决定效率，<br>执行决定结果。</blockquote></section>
    <div class="v14-kpi-grid">
      <article><span>待我决策</span><strong>${displayValue(activeDecisions.length)}</strong><small>需本人判断</small></article>
      <article><span>目标差距</span><strong>${displayValue(viewModel.gaps?.length)}</strong><small>仅确认目标</small></article>
      <article><span>今日行动</span><strong>${displayValue(viewModel.todayTop3?.length)}</strong><small>最多三项</small></article>
      <article><span>行业情报</span><strong>${displayValue(mustRead.length)}</strong><small>今日必看</small></article>
      <article><span>日历冲突</span><strong>${displayValue(viewModel.calendarConflicts?.length)}</strong><small>工作/生活占位</small></article>
      <article><span>数据健康</span><strong>${synced}/${health.length || '—'}</strong><small>正常来源</small></article>
    </div>
    <div class="v14-main-grid">
      <article class="v13-panel v14-span-2"><div class="v14-section-head"><h3>◎ 今日 Top 3</h3><button class="v13-action" data-page="today">查看行动</button></div>${(viewModel.todayTop3 || []).length ? `<div class="v13-list">${viewModel.todayTop3.slice(0, 3).map((item, index) => `<div class="v13-row"><span><b>0${index + 1}</b> ${escapeHtml(item.title || item.factSummary || item.id)}</span><span class="v13-chip">今日</span></div>`).join('')}</div>` : renderState('empty', '今日行动')}</article>
      <article class="v13-panel"><div class="v14-section-head"><h3>◎ 待我决策</h3><button class="v13-action" data-page="decisions">全部</button></div>${decisionRows(activeDecisions)}</article>
      <article class="v13-panel v14-span-2"><div class="v14-section-head"><h3>◫ 三家公司经营全景</h3><span>真实来源</span></div><div class="company-overview">
        <button data-page="local-life"><span>万嘉网络</span><strong>${displayValue(viewModel.sources?.wanjia?.summary?.paymentGmv)}</strong><small>支付 GMV</small></button>
        <button data-page="spark-media"><span>花火影像</span><strong>${displayValue(viewModel.sources?.huahuo?.summary?.outstandingAmount)}</strong><small>待回款</small></button>
        <button data-page="lingli"><span>玲丽教育</span><strong>—</strong><small>事实源待接入</small></button>
      </div></article>
      <article class="v13-panel"><div class="v14-section-head"><h3>◌ 今日行业情报</h3><button class="v13-action" data-page="intelligence">情报中心</button></div>${mustRead.length ? `<div class="v13-list">${mustRead.slice(0, 5).map((item) => `<div class="v13-row"><div><strong>${escapeHtml(item.title)}</strong><div class="v13-meta">${escapeHtml(item.sourceName)} · ${escapeHtml((item.relevantCompanies || []).join('/'))}</div></div><span class="v13-chip">${escapeHtml(item.score ?? '—')}</span></div>`).join('')}</div>` : renderState(viewModel.intelligenceState || 'empty', '每日行业情报')}</article>
      <article class="v13-panel"><div class="v14-section-head"><h3>▦ 我的日程</h3><button class="v13-action" data-page="calendar">完整日历</button></div>${(viewModel.calendar || []).length ? `<div class="v13-list">${viewModel.calendar.slice(0, 5).map((event) => `<div class="v13-row"><div><strong>${escapeHtml(event.title)}</strong><div class="v13-meta">${escapeHtml(event.startAt.slice(5, 16).replace('T', ' '))}</div></div><span class="v13-chip">${escapeHtml(event.company)}</span></div>`).join('')}</div>` : renderState('empty', '今日日程')}</article>
      <article class="v13-panel"><h3>📓 CEO 每日简报</h3><div class="v13-value">${viewModel.brief ? '待审核' : '—'}</div><p>简报只进入收集箱，不会自动外发。</p></article>
      <article class="v13-panel"><h3>◉ 系统健康</h3><div class="v13-value">${synced}/${health.length || '—'}</div><p>${escapeHtml(viewModel.syncStatus || '等待同步')}</p></article>
    </div></div><div id="mobileDashboardRoot" class="v13-mobile-dashboard"></div>`;
}
