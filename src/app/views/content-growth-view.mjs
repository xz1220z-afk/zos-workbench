import { CONTENT_STAGES, CONTENT_STAGE_LABELS } from '../content-growth.mjs?v=2.10.0';
import { displayValue, escapeHtml, renderState } from './view-utils.mjs?v=2.10.0';

const COMPANY_LABELS = { wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', personal: '个人 IP' };
const PLATFORM_LABELS = { douyin: '抖音', xiaohongshu: '小红书', wechat: '视频号', bilibili: 'B站', other: '其他' };

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `¥${number.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}` : '—';
}

function metric(label, value, hint = '') {
  return `<article class="growth-metric"><span>${escapeHtml(label)}</span><strong>${displayValue(value)}</strong><small>${escapeHtml(hint)}</small></article>`;
}

function contentCard(item) {
  const nextIndex = CONTENT_STAGES.indexOf(item.stage) + 1;
  const nextStage = CONTENT_STAGES[nextIndex];
  return `<article class="growth-content-card" data-content-id="${escapeHtml(item.id)}">
    <div class="growth-card-head"><span class="growth-company">${escapeHtml(COMPANY_LABELS[item.company] || item.company || '未归属')}</span><span>${escapeHtml(PLATFORM_LABELS[item.platform] || item.platform || '待选择')}</span></div>
    <h4>${escapeHtml(item.title)}</h4>
    <p>${escapeHtml(item.angle || item.summary || '等待补充内容角度与交付目标')}</p>
    <footer><span>${item.dueAt ? `截止 ${escapeHtml(String(item.dueAt).slice(0, 10))}` : '未排期'}</span><div class="growth-card-actions"><button data-content-edit="${escapeHtml(item.id)}">编辑</button>${['published', 'reviewed', 'reusable'].includes(item.stage) ? `<button data-content-metrics="${escapeHtml(item.id)}">录入复盘</button>` : ''}${['reviewed', 'reusable'].includes(item.stage) ? `<button data-content-compound="${escapeHtml(item.id)}">转复利资产</button>` : ''}${nextStage ? `<button data-content-transition="${escapeHtml(item.id)}" data-content-next-stage="${nextStage}">${nextStage === 'published' ? '审核发布' : `移至${CONTENT_STAGE_LABELS[nextStage]}`}</button>` : ''}<button data-content-delete="${escapeHtml(item.id)}">删除</button></div></footer>
  </article>`;
}

const STAGE_RENDER_LIMIT = 30;

function stageColumn(stage, items) {
  const rows = items.filter((item) => item.stage === stage);
  const visible = rows.slice(0, STAGE_RENDER_LIMIT);
  const remainder = rows.length - visible.length;
  return `<section class="growth-stage" data-content-stage="${stage}"><header><span>${CONTENT_STAGE_LABELS[stage]}</span><b>${rows.length}</b></header><div class="growth-stage-list">${visible.length ? visible.map(contentCard).join('') : '<p class="growth-stage-empty">暂无内容</p>'}${remainder > 0 ? `<p class="growth-stage-more">还有 ${remainder} 条，请用公司筛选缩小范围</p>` : ''}</div></section>`;
}

function experiments(items) {
  return items.length ? items.slice(0, 20).map((item) => `<div class="growth-mini-row"><div><strong>${escapeHtml(item.title || '未命名实验')}</strong><small>${escapeHtml(item.variable || '标题 / 封面 / 开头')}</small></div><div><span>${item.winnerId ? `胜出 ${escapeHtml(item.winnerId)}` : '采集中'}</span><button data-experiment-results="${escapeHtml(item.id)}">录入结果</button><button data-experiment-delete="${escapeHtml(item.id)}">删除</button></div></div>`).join('') : renderState('empty', '内容实验');
}

function compounds(items) {
  return items.length ? items.slice(0, 20).map((item) => `<div class="growth-mini-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.type || '待分类')} · ${item.status === 'approved' ? '已审核，可人工沉淀' : '保留来源证据'}</small></div><div>${item.status === 'approved' ? '' : `<button data-compound-review="${escapeHtml(item.id)}">审核</button>`}<button data-compound-delete="${escapeHtml(item.id)}">删除</button></div></div>`).join('') : renderState('empty', '复利候选');
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const items = viewModel.contentItems || [];
  const performance = viewModel.contentPerformance || {};
  const activeCompany = viewModel.contentCompany || 'all';
  const activeOwner = viewModel.contentOwner || 'all';
  container.innerHTML = `<section class="growth-hero">
    <div><span class="growth-kicker">CONTENT GROWTH OS · 三家公司 + 个人 IP</span><h2>内容增长中心</h2><p>从真实情报与知识证据出发，把选题、制作、发布、线索、成交、回款与复盘串成一条闭环。</p></div>
    <div class="growth-hero-actions"><button class="v13-action${activeOwner === 'mine' ? ' active' : ''}" data-content-owner="${activeOwner === 'mine' ? 'all' : 'mine'}">${activeOwner === 'mine' ? '查看全部负责人' : '只看我负责'}</button><button class="v13-action v13-action-primary" data-content-capture>＋ 新建内容</button></div>
  </section>
  <div class="growth-metrics">
    ${metric('内容总数', items.length, '跨公司统一管理')}
    ${metric('已发布', performance.published, '只统计真实发布')}
    ${metric('真实播放', performance.views, '来自复盘录入')}
    ${metric('有效线索', performance.leads, '咨询与客户线索')}
    ${metric('线索转化率', performance.conversionRate == null ? null : `${performance.conversionRate}%`, '播放到线索')}
    ${metric('关联回款', performance.revenue == null ? null : formatMoney(performance.revenue), '只计已确认金额')}
  </div>
  <div class="growth-commandbar"><div><strong>内容流水线</strong><span>按住横向滑动查看全部阶段</span></div><div class="growth-filter-chips">${Object.entries({ all: '全部', wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', personal: '个人 IP' }).map(([value, label]) => `<button data-content-company="${value}"${activeCompany === value ? ' class="active"' : ''}>${label}</button>`).join('')}</div></div>
  <div class="growth-stage-board">${CONTENT_STAGES.map((stage) => stageColumn(stage, items)).join('')}</div>
  <div class="growth-lower-grid">
    <article class="growth-panel"><header><div><span class="growth-kicker">EXPERIMENTS</span><h3>内容实验</h3></div><button data-experiment-capture>＋ 新建实验</button></header>${experiments(viewModel.contentExperiments || [])}</article>
    <article class="growth-panel"><header><div><span class="growth-kicker">COMPOUNDING</span><h3>内容资产复利</h3></div><span class="growth-safety">人工审核后沉淀</span></header>${compounds(viewModel.compoundCandidates || [])}</article>
  </div>`;
}
