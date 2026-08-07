import { escapeHtml } from './view-utils.mjs?v=2.0.4';

function money(value) {
  return `¥${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

function actionList(label, items, state) {
  return `<section class="merchant-action-bucket" data-action-state="${state}"><header><h4>${label}</h4><span>${items.length}</span></header>${items.length ? items.map((item) => `<div><strong>${escapeHtml(typeof item === 'string' ? item : item.title)}</strong>${typeof item === 'string' ? '<small>飞书和本地任务均无状态证据</small>' : `<small>${escapeHtml(item.source || '业务记录')}${item.dueAt ? ` · ${escapeHtml(item.dueAt.slice(0, 10))}` : ''}</small>`}</div>`).join('') : '<p>暂无</p>'}</section>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const result = viewModel.merchantSearch || { state: 'empty_query', matches: [] };
  const profile = viewModel.merchantProfile || null;
  const stateText = {
    empty_query: '输入商家名称或商家编号开始查询。',
    not_found: '未找到匹配商家，请检查名称或先刷新万嘉数据。',
    ambiguous: '存在同名商家，请选择正确记录。',
    multiple: '找到多条相似记录，请选择。',
  }[result.state];
  container.innerHTML = `<section class="merchant-shell"><div class="v14-section-head"><div><span class="v14-kicker">WANJIA MERCHANT 360 · 只读事实</span><h3>万嘉商家经营档案</h3><p>经营数据来自飞书；本地待办只作为关联动作，不会覆盖飞书事实。</p></div><form data-merchant-search><input name="query" type="search" placeholder="输入商家名或编号" value="${escapeHtml(viewModel.merchantQuery || '')}"><button class="v13-action v13-action-primary">查询</button></form></div>${stateText ? `<div class="merchant-search-state" data-state="${result.state}">${stateText}${result.matches.length ? `<div>${result.matches.map((item) => `<button data-merchant-select="${escapeHtml(item.id)}">${escapeHtml(item.merchantName)} · ${escapeHtml(item.merchantId || item.id)}</button>`).join('')}</div>` : ''}</div>` : ''}${profile ? `<div class="merchant-profile"><header><div><h3>${escapeHtml(profile.merchantName)}</h3><p>${escapeHtml(profile.industry || '行业待补')} · ${escapeHtml(profile.category || '类目待补')} · ${escapeHtml(profile.owner || '负责人待补')}</p></div><span class="v13-chip">${escapeHtml(profile.stage || '阶段待补')}</span></header><div class="merchant-metrics"><article><span>支付 GMV</span><strong>${money(profile.metrics.paymentGmv)}</strong></article><article><span>核销 GMV</span><strong>${money(profile.metrics.redeemedGmv)}</strong></article><article><span>经营分</span><strong>${profile.metrics.businessScore || '—'}</strong></article><article><span>上团 / 动销</span><strong>${profile.metrics.isListed === null ? '未记录' : profile.metrics.isListed ? '已上团' : '未上团'} · ${profile.metrics.isActive === null ? '未记录' : profile.metrics.isActive ? '已动销' : '未动销'}</strong></article></div><div class="merchant-actions">${actionList('已完成', profile.actions.done, 'done')}${actionList('待执行', profile.actions.pending, 'pending')}${actionList('已逾期', profile.actions.overdue, 'overdue')}${actionList('未记录', profile.actions.unrecorded, 'unrecorded')}</div><footer>数据更新时间：${escapeHtml(profile.evidence.sourceUpdatedAt || '未提供')} · 只读</footer></div>` : ''}</section>`;
}
