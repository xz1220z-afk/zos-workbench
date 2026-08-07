import { displayValue, escapeHtml, renderState, VIEW_STATES } from './view-utils.mjs?v=2.0.2';
import { formatCurrency, humanText } from '../value-utils.mjs?v=2.0.2';

export { VIEW_STATES };

function decisionRows(decisions = []) {
  if (!decisions.length) return renderState('empty', '待我决策');
  return `<div class="v13-list">${decisions.slice(0, 4).map((item) => `
    <div class="v13-row"><div><strong>${escapeHtml(item.status === 'pending_resolution' ? humanText(item.decisionNote, '来源风险已消失，待确认解除') : humanText(item.factSummary || item.title, '待核对事项'))}</strong><div class="v13-meta">${escapeHtml(humanText(item.recommendedAction, '等待人工判断'))}</div></div><span class="v13-chip">${escapeHtml(humanText(item.severity, '关注'))}</span></div>
  `).join('')}</div>`;
}

function importantDateRows(items = []) {
  if (!items.length) return renderState('empty', '未来 30 天关键期限');
  return `<div class="v13-list">${items.slice(0, 4).map((item) => `<div class="v13-row"><div><strong>${escapeHtml(item.title)}</strong><div class="v13-meta">${escapeHtml(item.occurrence)} · ${escapeHtml(item.company || 'CEO')}</div></div><span class="v13-chip">${item.days === 0 ? '今天' : `${item.days} 天`}</span></div>`).join('')}</div>`;
}

function importantDatesDrawer(viewModel, items) {
  if (viewModel.importantDatesPanel !== 'work') return '';
  return `<aside class="important-dates-drawer" role="dialog" aria-modal="true" aria-label="全部关键期限"><header><div><small>未来 30 天</small><h2>关键期限</h2></div><button data-important-dates-close aria-label="关闭">×</button></header>${importantDateRows(items)}<footer><button class="v13-action v13-action-primary" data-countdown-capture>＋ 新增关键期限</button></footer></aside><div class="task-drawer-backdrop" data-important-dates-close></div>`;
}

const SOURCE_LABELS = Object.freeze({
  sync: '跨端', wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', projects: '项目', intelligence: '情报', calendar: '日历', all: '全部',
});

const SAFE_MESSAGES = Object.freeze({
  authentication_required: '需要重新登录',
  feishu_permission_denied: '飞书读取权限待检查',
  feishu_resource_not_found: '数据表配置待检查',
  feishu_field_mismatch: '字段配置待检查',
  feishu_configuration_missing: '来源尚未配置',
  source_timeout: '连接超时',
  source_refresh_failed: '本轮未更新',
  refresh_failed: '本轮未更新',
});

function syncRail(autoRefresh = {}) {
  const phase = autoRefresh.phase || 'idle';
  const succeeded = new Set(autoRefresh.succeeded || []);
  const failed = new Map((autoRefresh.failed || []).map((item) => [item.source, item.safeCode]));
  const statusText = phase === 'refreshing' ? '后台更新中'
    : phase === 'partial' ? '部分来源未更新'
      : phase === 'offline' ? '离线 · 使用缓存'
        : phase === 'authentication_required' ? '需要登录 Supabase'
          : phase === 'stale' ? '数据超过 30 分钟未更新'
            : '自动更新已开启';
  const sourceItems = ['wanjia', 'huahuo', 'lingli', 'projects', 'intelligence', 'calendar', 'sync'].map((source) => {
    const code = failed.get(source);
    const state = code ? 'failed' : succeeded.has(source) ? 'synced' : 'pending';
    const detail = code ? SAFE_MESSAGES[code] || '本轮未更新' : state === 'synced' ? '已更新' : '等待本轮';
    return `<span class="v15-sync-source is-${state}"><b>${SOURCE_LABELS[source]}</b> ${escapeHtml(detail)}</span>`;
  }).join('');
  const time = autoRefresh.lastSuccessAt ? new Date(autoRefresh.lastSuccessAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '尚无完整时间';
  return `<section class="v15-sync-rail" data-sync-phase="${escapeHtml(phase)}">
    <div><span class="v15-sync-dot"></span><strong>数据自动更新 · ${statusText}</strong><small>最近成功 ${escapeHtml(time)} · 前台每 15 分钟检查</small></div>
    <div class="v15-sync-sources">${sourceItems}</div>
    <button class="v13-action" data-refresh-all ${phase === 'refreshing' ? 'disabled' : ''}>${phase === 'refreshing' ? '更新中…' : '全部刷新'}</button>
  </section>`;
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
  const companies = viewModel.companyOperating || {};
  const workDates = viewModel.importantDates?.work || [];
  container.innerHTML = `<div class="v14-dashboard">
    ${syncRail(viewModel.autoRefresh)}
    <section class="v14-hero"><div><span class="v14-kicker">CEO COMMAND CENTER · ${escapeHtml(viewModel.today || '')}</span><h2>今天，先处理最重要的事</h2><p>事实来自飞书与 Supabase；AI 只做建议，所有正式写入须确认。</p><div class="v14-hero-actions"><button class="v13-action v13-action-primary" data-quick-capture>＋ 快速收集</button><button class="v13-action" data-agent-draft="ceo">生成 CEO 建议</button><button class="v13-action" data-page="tasks">新建任务</button><button class="v13-action" data-page="enterprise">查看项目</button></div></div><blockquote>战略决定方向，<br>系统决定效率，<br>执行决定结果。</blockquote></section>
    <div class="v14-kpi-grid">
      <article><span>待我决策</span><strong>${displayValue(activeDecisions.length)}</strong><small>需本人判断</small></article>
      <article><span>目标差距</span><strong>${displayValue(viewModel.gaps?.length)}</strong><small>仅确认目标</small></article>
      <article><span>今日行动</span><strong>${displayValue(viewModel.todayTop3?.length)}</strong><small>最多三项</small></article>
      <article><span>行业情报</span><strong>${displayValue(mustRead.length)}</strong><small>今日必看</small></article>
      <article><span>日历冲突</span><strong>${displayValue(viewModel.calendarConflicts?.length)}</strong><small>工作/生活占位</small></article>
      <article><span>数据健康</span><strong>${synced}/${health.length || '—'}</strong><small>正常来源</small></article>
    </div>
    <div class="v14-main-grid">
      <article class="v13-panel v14-span-2 v14-today-panel"><div class="v14-section-head"><h3>◎ 今日 Top 3 <span class="v13-chip">${displayValue(viewModel.reminderQueue?.length)} 条提醒</span></h3><button class="v13-action" data-page="today">查看行动</button></div>${(viewModel.todayTop3 || []).length ? `<div class="v13-list">${viewModel.todayTop3.slice(0, 3).map((item, index) => `<div class="v13-row"><div><strong>0${index + 1} · ${escapeHtml(humanText(item.title || item.factSummary || item.id, '待确认行动'))}</strong><div class="v13-meta">${escapeHtml(humanText(item.reason, '待确认优先原因'))}${item.dueAt ? ` · ${escapeHtml(item.dueAt)}` : ''}</div></div><div>${item.sourceType === 'decision' ? `<button class="v13-action" data-preview-decision="${escapeHtml(item.sourceId)}">预览催办</button>` : ''}<span class="v13-chip">${escapeHtml(humanText(item.sourceType, '行动'))}</span></div></div>`).join('')}</div>` : renderState('empty', '今日行动')}</article>
      <article class="v13-panel"><div class="v14-section-head"><h3>◎ 待我决策</h3><button class="v13-action" data-page="decisions">全部</button></div>${decisionRows(activeDecisions)}</article>
      <article class="v13-panel v14-span-2"><div class="v14-section-head"><h3>◫ 三家公司经营全景</h3><span>真实来源</span></div><div class="company-overview">
        <button data-page="local-life"><span>万嘉网络</span><strong>${formatCurrency(companies.wanjia?.businessVolume?.value ?? viewModel.sources?.wanjia?.summary?.paymentGmv)}</strong><small>支付 GMV · 非收入</small></button>
        <button data-page="spark-media"><span>花火影像</span><strong>${formatCurrency(companies.huahuo?.finance?.outstanding?.value ?? viewModel.sources?.huahuo?.summary?.outstandingAmount)}</strong><small>待回款</small></button>
        <button data-page="lingli"><span>玲丽教育</span><strong>${formatCurrency(companies.lingli?.finance?.cashIn?.value ?? viewModel.sources?.lingli?.summary?.received)}</strong><small>本月实收</small></button>
      </div></article>
      <article class="v13-panel"><div class="v14-section-head"><h3>◌ 今日行业情报</h3><button class="v13-action" data-page="intelligence">情报中心</button></div>${mustRead.length ? `<div class="v13-list">${mustRead.slice(0, 5).map((item) => `<div class="v13-row"><div><strong>${escapeHtml(item.title)}</strong><div class="v13-meta">${escapeHtml(item.sourceName)} · ${escapeHtml((item.relevantCompanies || []).join('/'))}</div></div><span class="v13-chip">${escapeHtml(item.score ?? '—')}</span></div>`).join('')}</div>` : renderState(viewModel.intelligenceState || 'empty', '每日行业情报')}</article>
      <article class="v13-panel"><div class="v14-section-head"><h3>▦ 我的日程</h3><button class="v13-action" data-page="calendar">完整日历</button></div>${(viewModel.calendar || []).length ? `<div class="v13-list">${viewModel.calendar.slice(0, 5).map((event) => `<div class="v13-row"><div><strong>${escapeHtml(event.title)}</strong><div class="v13-meta">${escapeHtml(event.startAt.slice(5, 16).replace('T', ' '))}</div></div><span class="v13-chip">${escapeHtml(event.company)}</span></div>`).join('')}</div>` : renderState('empty', '今日日程')}</article>
      <article class="v13-panel"><div class="v14-section-head"><h3>⏳ 关键期限</h3><button class="v13-action" data-important-dates-open="work">查看全部</button></div>${importantDateRows(workDates)}</article>
      <article class="v13-panel"><div class="v14-section-head"><h3>☀ 晨间简报</h3><span>07:30</span></div><p>${escapeHtml(viewModel.morningDigest?.body || '等待今日数据')}</p><div class="v14-section-head"><h3>☾ 晚间简报</h3><span>21:30</span></div><p>${escapeHtml(viewModel.eveningDigest?.body || '等待今日数据')}</p><small>仅在你开启系统提醒后推送，不会自动外发。</small></article>
      <article class="v13-panel"><h3>◉ 系统健康</h3><div class="v13-value">${synced}/${health.length || '—'}</div><p>${escapeHtml(viewModel.syncStatus || '等待同步')}</p></article>
    </div>${importantDatesDrawer(viewModel, workDates)}</div><div id="mobileDashboardRoot" class="v13-mobile-dashboard"></div>`;
}
