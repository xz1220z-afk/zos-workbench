import { escapeHtml } from './view-utils.mjs?v=2.7.3';

function safe(value, fallback = '待同步') {
  return value === null || value === undefined || value === '' ? fallback : escapeHtml(String(value));
}

function money(value) {
  return value === null || value === undefined ? '待同步' : `¥${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

function percent(value) {
  return value === null || value === undefined ? '待同步' : `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format((Number(value) || 0) * 100)}%`;
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function binaryOptions(selected) {
  return option('all', '全部', selected) + option('yes', '是', selected) + option('no', '否', selected);
}

function statusPanel(status = {}) {
  const tableText = status.sourceTables?.length ? status.sourceTables.join('、') : '尚未声明今日校验表';
  const missingText = status.missingPreferredTables?.length
    ? `<small class="wanjia-source-gap">尚未发现：${escapeHtml(status.missingPreferredTables.join('、'))}；相关指标继续显示待同步。</small>` : '';
  return `<section class="wanjia-status-panel" data-state="${escapeHtml(status.state || 'pending_sync')}">
    <div><span class="v14-kicker">WANJIA DATA TRUST</span><h2>万嘉本地生活运营总控台</h2><p>${escapeHtml(status.message || '今日经营数据待同步。')}</p></div>
    <dl><div><dt>数据来源</dt><dd>${safe(status.sourceLabel)}</dd></div><div><dt>数据日期</dt><dd>${safe(status.dataDate)}</dd></div><div><dt>最后同步</dt><dd>${safe(status.lastSyncedAt)}</dd></div><div><dt>同步状态</dt><dd>${safe(status.label)}</dd></div><div><dt>数据可信</dt><dd>${status.trustworthy ? '可用于运营参考' : '暂不可作为今日事实'}</dd></div></dl>
    <small>本次校验表：${escapeHtml(tableText)}</small>${missingText}
  </section>`;
}

function kpiGrid(kpis = []) {
  return `<section class="wanjia-kpi-grid">${kpis.map((item) => {
    const hint = item.available
      ? item.key === 'completed_tasks_today' ? '点击进入任务中心' : '点击筛选或排序商家列表'
      : '等待今日数据校验';
    return `<button type="button" class="wanjia-kpi-card" data-wanjia-kpi-filter="${escapeHtml(item.key)}" ${item.available ? '' : 'data-unavailable="true"'}><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.display)}</strong><small>${hint}</small></button>`;
  }).join('')}</section>`;
}

function historicalPanel(reference) {
  if (!reference) return '';
  return `<details class="wanjia-history-reference"><summary>查看历史快照（仅供历史参考）</summary><div><span>数据日期：${safe(reference.dataDate, '未知')}</span><span>商家总数：${safe(reference.totalMerchants, '未记录')}</span><span>动销商家：${safe(reference.activeMerchants, '未记录')}</span><span>支付 GMV：${money(reference.paymentGmv)}</span></div></details>`;
}

function historyFilterOptions(rows = []) {
  const unique = (key) => [...new Set(rows.map((item) => item[key]).filter(Boolean))].sort();
  return {
    merchants: [...new Map(rows.filter((item) => item.merchantId).map((item) => [item.merchantId, item])).values()]
      .sort((left, right) => left.merchantName.localeCompare(right.merchantName)),
    industries: unique('industry'), owners: unique('owner'), cooperationTypes: unique('cooperationType'),
  };
}

function historyToolbar(history = {}) {
  const range = history.range || {};
  const current = history.filters || {};
  const options = historyFilterOptions(history.allRows || history.rows || []);
  const selectOptions = (values, selected) => option('all', '全部', selected) + values.map((value) => option(value, value, selected)).join('');
  const presets = [
    ['today', '今天'], ['yesterday', '昨天'], ['this_week', '本周'], ['last_week', '上周'],
    ['this_month', '本月'], ['last_month', '上月'], ['last_7_days', '近 7 天'], ['last_30_days', '近 30 天'], ['custom', '自定义范围'],
  ];
  const feedback = history.queryFeedback
    ? `<p class="wanjia-history-feedback" data-wanjia-history-feedback role="status" aria-live="polite">${escapeHtml(history.queryFeedback)}</p>`
    : '';
  return `<form class="wanjia-history-filter-bar" data-wanjia-history-form>
    <label>时间范围<select name="preset" aria-label="时间范围">${presets.map(([value, label]) => option(value, label, range.preset || 'today')).join('')}</select></label>
    <label>开始日期<input type="date" name="startDate" value="${safe(range.startDate, '')}"></label>
    <label>结束日期<input type="date" name="endDate" value="${safe(range.endDate, '')}"></label>
    <label>商家<select name="merchantId" aria-label="商家"><option value="" ${current.merchantId ? '' : 'selected'}>全部商家</option>${options.merchants.map((item) => option(item.merchantId, `${item.merchantName} · ${item.merchantId}`, current.merchantId)).join('')}</select></label>
    <label>行业<select name="industry" aria-label="行业">${selectOptions(options.industries, current.industry || 'all')}</select></label>
    <label>跟进人<select name="owner" aria-label="跟进人">${selectOptions(options.owners, current.owner || 'all')}</select></label>
    <label>合作模式<select name="cooperationType" aria-label="合作模式">${selectOptions(options.cooperationTypes, current.cooperationType || 'all')}</select></label>
    <label>异常<select name="abnormal" aria-label="是否异常">${binaryOptions(current.abnormal || 'all')}</select></label>
    <div class="wanjia-history-actions"><button class="v13-action v13-action-primary">查询历史</button><button type="button" class="v13-action" data-wanjia-history-reset>恢复今天</button></div>
  </form>${feedback}`;
}

function historyValue(value, format = 'number') {
  if (value === null || value === undefined) return '数据积累中';
  if (format === 'money') return money(value);
  if (format === 'percent') return percent(value);
  return safe(value, '数据积累中');
}

function historySummary(history = {}) {
  const summary = history.rangeSummary || {};
  const availability = history.availability || {};
  const risk = history.metricRisk ? `<span class="wanjia-history-risk">${escapeHtml(history.metricRisk)}</span>` : '';
  return `<section class="wanjia-history-overview">
    <div class="wanjia-history-meta"><div><span class="v14-kicker">LOCAL SQLITE HISTORY</span><h3>时间范围查询与历史经营分析</h3><p>${escapeHtml(history.message || '历史数据积累中。')}</p></div><dl><div><dt>数据仓</dt><dd>本地 SQLite 历史仓</dd></div><div><dt>可用性</dt><dd>${safe(availability.label, '数据缺失')}</dd></div><div><dt>已覆盖日期</dt><dd>${safe(availability.earliestDate, '—')} 至 ${safe(availability.latestDate, '—')}</dd></div><div><dt>导入批次</dt><dd>${historyValue(availability.batchCount)}</dd></div></dl></div>
    ${risk}<div class="wanjia-history-kpi-grid">
      <article><span>区间支付 GMV</span><strong>${historyValue(summary.paymentGmv, 'money')}</strong><small>按字段口径计算</small></article>
      <article><span>区间核销 GMV</span><strong>${historyValue(summary.redeemedGmv, 'money')}</strong><small>按字段口径计算</small></article>
      <article><span>平均核销率</span><strong>${historyValue(summary.redemptionRate, 'percent')}</strong><small>有支付与核销时计算</small></article>
      <article><span>动销商家数</span><strong>${historyValue(summary.activeMerchants)}</strong><small>选定范围内</small></article>
      <article><span>异常商家数</span><strong>${historyValue(summary.exceptionMerchants)}</strong><small>选定范围内</small></article>
    </div></section>`;
}

function historyTrend(history = {}) {
  const isSnapshot = Boolean(history.metricRisk);
  const points = isSnapshot ? (history.snapshotTrend || []) : (history.trend || []);
  const hasData = points.some((item) => item.paymentGmv !== null || item.exceptionMerchants !== null);
  if (!hasData) return `<section class="wanjia-section wanjia-history-chart"><div class="v14-section-head"><div><span class="v14-kicker">DAILY TREND</span><h3>每日 GMV 与异常趋势</h3></div></div><div class="wanjia-empty">${escapeHtml(history.message || '历史数据积累中。')}</div></section>`;
  const maxGmv = Math.max(1, ...points.map((item) => Number(item.paymentGmv) || 0));
  const title = isSnapshot ? '每日经营快照趋势' : '每日 GMV 与异常趋势';
  const description = isSnapshot
    ? '每个数据点是当天全量商家快照，仅用于观察历史状态；禁止跨日期直接求和。'
    : '支付 GMV、核销 GMV 与异常商家按天展示；没有数据的日期不会被填成 0。';
  return `<section class="wanjia-section wanjia-history-chart"><div class="v14-section-head"><div><span class="v14-kicker">DAILY TREND</span><h3>${title}</h3><p>${description}</p></div></div><div class="wanjia-trend-list">${points.map((item) => `<article><header><strong>${escapeHtml(item.date)}</strong><span>异常 ${historyValue(item.exceptionMerchants)}</span></header><div class="wanjia-trend-bar"><i style="width:${Math.max(2, ((Number(item.paymentGmv) || 0) / maxGmv) * 100)}%"></i></div><dl><div><dt>支付</dt><dd>${historyValue(item.paymentGmv, 'money')}</dd></div><div><dt>核销</dt><dd>${historyValue(item.redeemedGmv, 'money')}</dd></div></dl></article>`).join('')}</div></section>`;
}

function rankingList(title, rows = [], format = 'money') {
  return `<article class="wanjia-ranking-card"><h4>${escapeHtml(title)}</h4>${rows.length ? `<ol>${rows.slice(0, 20).map((item, index) => `<li><span>${index + 1}</span><button data-wanjia-diagnose="${escapeHtml(item.merchantId)}">${escapeHtml(item.merchantName)}</button><strong>${historyValue(item.value, format)}</strong></li>`).join('')}</ol>` : '<p>数据积累中或当前口径不支持此排行。</p>'}</article>`;
}

function historyRankings(history = {}) {
  const rankings = history.rankings || {};
  return `<section class="wanjia-section"><div class="v14-section-head"><div><span class="v14-kicker">RANGE RANKINGS</span><h3>商家排行</h3><p>只在数据可累计且已校验时生成；点击商家可进入现有诊断入口。</p></div></div><div class="wanjia-ranking-grid">${rankingList('支付 GMV Top 20', rankings.paymentGmv)}${rankingList('核销 GMV Top 20', rankings.redeemedGmv)}${rankingList('GMV 增长 Top 20', rankings.growth)}${rankingList('GMV 下滑 Top 20', rankings.decline)}${rankingList('高退款商家', rankings.refund)}${rankingList('低核销商家', rankings.lowRedemption)}</div></section>`;
}

function merchantHistory(history = {}) {
  const merchantId = history.filters?.merchantId;
  if (!merchantId) return `<section class="wanjia-section"><div class="v14-section-head"><div><span class="v14-kicker">MERCHANT TIMELINE</span><h3>单商家历史趋势</h3><p>在上方选择商家后，查看其 GMV、核销、异常与可追溯的行动结果。</p></div></div><div class="wanjia-empty">尚未选择商家；不会把全体商家数据冒充为单商家走势。</div></section>`;
  const rows = (history.rows || []).filter((item) => item.merchantId === merchantId).sort((left, right) => left.businessDate.localeCompare(right.businessDate));
  const name = rows[0]?.merchantName || merchantId;
  return `<section class="wanjia-section"><div class="v14-section-head"><div><span class="v14-kicker">MERCHANT TIMELINE</span><h3>单商家历史趋势 · ${escapeHtml(name)}</h3><p>展示所选日期内的历史快照；动作与结果须由任务/项目事实源补齐。</p></div></div>${rows.length ? `<div class="wanjia-history-merchant-list">${rows.map((item) => `<div><strong>${escapeHtml(item.businessDate)}</strong><span>支付 ${historyValue(item.paymentGmv, 'money')}</span><span>核销 ${historyValue(item.redeemedGmv, 'money')}</span><span>${item.exception ? '异常记录' : '无异常标记'}</span></div>`).join('')}</div>` : '<div class="wanjia-empty">该商家在选定范围内没有已校验历史快照。</div>'}</section>`;
}

function historySection(history = {}) {
  return `<section class="wanjia-history-section">${historyToolbar(history)}${historySummary(history)}${historyTrend(history)}${historyRankings(history)}${merchantHistory(history)}</section>`;
}

function urgentCard(item) {
  return `<article class="wanjia-urgent-card" data-priority="${safe(item.priority, 'P2')}"><header><span>${safe(item.priority, 'P2')}</span><h4>${escapeHtml(item.merchantName)}</h4><small>${escapeHtml(item.healthStatus)}</small></header><p>${escapeHtml(item.anomalyTypes.join('、') || '暂无异常')}</p><dl><div><dt>支付 GMV</dt><dd>${money(item.paymentGmv)}</dd></div><div><dt>核销 GMV</dt><dd>${money(item.redeemedGmv)}</dd></div><div><dt>核销率</dt><dd>${percent(item.redemptionRate)}</dd></div><div><dt>负责人</dt><dd>${escapeHtml(item.owner)}</dd></div></dl><div class="wanjia-suggestion"><b>建议动作</b><span>${escapeHtml(item.suggestedAction)}</span></div><footer><button class="v13-action" data-wanjia-diagnose="${escapeHtml(item.id)}">查看诊断</button><button class="v13-action v13-action-primary" data-wanjia-task-draft="${escapeHtml(item.id)}">生成任务草案</button></footer></article>`;
}

function urgentSection(items = []) {
  return `<section class="wanjia-section"><div class="v14-section-head"><div><span class="v14-kicker">TODAY OPERATIONS</span><h3>今日最需要处理的商家</h3><p>P0 先修数据，P1 处理经营异常，P2 安排增长优化；只生成草案，不自动派单。</p></div></div><div class="wanjia-urgent-grid">${items.length ? items.map(urgentCard).join('') : '<div class="wanjia-empty">当前没有可验证的今日异常；等待同步后按规则生成。</div>'}</div></section>`;
}

function filters(model) {
  const current = model.filters || {};
  const selectOptions = (values, selected) => option('all', '全部', selected) + values.map((value) => option(value, value, selected)).join('');
  return `<form class="wanjia-filter-bar" data-wanjia-filter-form><input type="search" name="query" placeholder="搜索商家名称或林客 ID" value="${safe(current.query, '')}"><select name="industry" aria-label="行业">${selectOptions(model.filterOptions?.industries || [], current.industry || 'all')}</select><select name="cooperationType" aria-label="合作模式">${selectOptions(model.filterOptions?.cooperationTypes || [], current.cooperationType || 'all')}</select><select name="owner" aria-label="跟进人">${selectOptions(model.filterOptions?.owners || [], current.owner || 'all')}</select><select name="health" aria-label="健康状态">${selectOptions(['正常','关注','高风险','数据待核验'], current.health || 'all')}</select><select name="abnormal" aria-label="是否异常">${binaryOptions(current.abnormal || 'all')}</select><select name="active" aria-label="是否动销">${binaryOptions(current.active || 'all')}</select><select name="live" aria-label="是否有直播">${binaryOptions(current.live || 'all')}</select><select name="video" aria-label="是否有视频">${binaryOptions(current.video || 'all')}</select><select name="groupbuyGmv" aria-label="是否有团购 GMV">${binaryOptions(current.groupbuyGmv || 'all')}</select><button class="v13-action v13-action-primary">筛选</button><button type="button" class="v13-action" data-wanjia-filter-reset>重置</button></form>`;
}

function merchantRow(item) {
  return `<tr><td><button class="wanjia-table-link" data-wanjia-diagnose="${escapeHtml(item.id)}">${escapeHtml(item.merchantName)}</button><small>${safe(item.merchantId, 'ID 待核验')}</small></td><td>${escapeHtml(item.industry)}</td><td>${escapeHtml(item.owner)}</td><td>${money(item.paymentGmv)}</td><td>${money(item.redeemedGmv)}</td><td>${percent(item.redemptionRate)}</td><td>${money(item.videoDirectPaymentGmv)}</td><td>${money(item.livePaymentGmv)}</td><td>${safe(item.businessScore, '待同步')}</td><td><span class="wanjia-health" data-health="${escapeHtml(item.healthStatus)}">${escapeHtml(item.healthStatus)}</span>${item.anomalyTypes.length ? `<small>${escapeHtml(item.anomalyTypes.join('、'))}</small>` : ''}</td><td>${safe(item.dataDate, '待校验')}</td></tr>`;
}

function merchantTable(model) {
  const items = model.filteredMerchants || [];
  return `<section class="wanjia-section"><div class="v14-section-head"><div><span class="v14-kicker">MERCHANT HEALTH</span><h3>商家健康看板</h3><p>这是最新经营状态，不随上方历史时间范围变化；健康状态由固定规则计算，不由 AI 主观判断。</p></div><strong>${items.length} / ${(model.merchants || []).length}</strong></div>${filters(model)}<div class="wanjia-table-wrap"><table><thead><tr><th>商家 / 林客 ID</th><th>行业</th><th>跟进人</th><th>支付 GMV</th><th>核销 GMV</th><th>核销率</th><th>视频直接支付</th><th>直播支付</th><th>经营分</th><th>健康状态 / 异常</th><th>数据日期</th></tr></thead><tbody>${items.length ? items.map(merchantRow).join('') : '<tr><td colspan="11"><div class="wanjia-empty">暂无符合条件的商家，调整筛选或等待数据同步。</div></td></tr>'}</tbody></table></div></section>`;
}

function opportunities(items = []) {
  return `<section class="wanjia-section"><div class="v14-section-head"><div><span class="v14-kicker">GROWTH OPPORTUNITIES</span><h3>增长机会池</h3><p>规则只识别机会，不自动执行、不自动写飞书。</p></div></div><div class="wanjia-opportunity-grid">${items.length ? items.map((item) => `<article><header><span>${escapeHtml(item.type)}</span><strong>${escapeHtml(item.merchantName)}</strong></header><p><b>数据依据</b>${escapeHtml(item.evidence)}</p><p><b>建议服务</b>${escapeHtml(item.service)}</p><p><b>下一步</b>${escapeHtml(item.nextAction)}</p><footer><span>${item.converted ? '已转商机' : '尚未转商机'}</span><button class="v13-action" data-wanjia-opportunity-draft="${escapeHtml(item.id)}">生成商机草案</button></footer></article>`).join('') : '<div class="wanjia-empty">暂未发现有完整数据证据的增长机会。</div>'}</div></section>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const model = viewModel.wanjiaOps;
  if (!model) {
    container.innerHTML = '<section class="wanjia-shell"><div class="wanjia-empty">万嘉运营模型尚未初始化，请刷新页面。</div></section>';
    return;
  }
  container.innerHTML = `<div class="wanjia-shell">${statusPanel(model.status)}${historySection(model.history)}${kpiGrid(model.kpis)}${historicalPanel(model.historicalReference)}${urgentSection(model.urgentMerchants)}${merchantTable(model)}${opportunities(model.opportunities)}</div>`;
}
