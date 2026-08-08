import { escapeHtml } from './view-utils.mjs?v=2.3.0';

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
  return `<section class="wanjia-status-panel" data-state="${escapeHtml(status.state || 'pending_sync')}">
    <div><span class="v14-kicker">WANJIA DATA TRUST</span><h2>万嘉本地生活运营总控台</h2><p>${escapeHtml(status.message || '今日经营数据待同步。')}</p></div>
    <dl><div><dt>数据来源</dt><dd>${safe(status.sourceLabel)}</dd></div><div><dt>数据日期</dt><dd>${safe(status.dataDate)}</dd></div><div><dt>最后同步</dt><dd>${safe(status.lastSyncedAt)}</dd></div><div><dt>同步状态</dt><dd>${safe(status.label)}</dd></div><div><dt>数据可信</dt><dd>${status.trustworthy ? '可用于运营参考' : '暂不可作为今日事实'}</dd></div></dl>
    <small>本次校验表：${escapeHtml(tableText)}</small>
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
  return `<section class="wanjia-section"><div class="v14-section-head"><div><span class="v14-kicker">MERCHANT HEALTH</span><h3>商家健康看板</h3><p>健康状态由固定规则计算，不由 AI 主观判断。</p></div><strong>${items.length} / ${(model.merchants || []).length}</strong></div>${filters(model)}<div class="wanjia-table-wrap"><table><thead><tr><th>商家 / 林客 ID</th><th>行业</th><th>跟进人</th><th>支付 GMV</th><th>核销 GMV</th><th>核销率</th><th>视频直接支付</th><th>直播支付</th><th>经营分</th><th>健康状态 / 异常</th><th>数据日期</th></tr></thead><tbody>${items.length ? items.map(merchantRow).join('') : '<tr><td colspan="11"><div class="wanjia-empty">暂无符合条件的商家，调整筛选或等待数据同步。</div></td></tr>'}</tbody></table></div></section>`;
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
  container.innerHTML = `<div class="wanjia-shell">${statusPanel(model.status)}${kpiGrid(model.kpis)}${historicalPanel(model.historicalReference)}${urgentSection(model.urgentMerchants)}${merchantTable(model)}${opportunities(model.opportunities)}</div>`;
}
