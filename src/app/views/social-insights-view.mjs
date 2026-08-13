import { escapeHtml, renderState } from './view-utils.mjs?v=2.8.4';

const COMPANY = { wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', personal: '个人 IP' };

export function render(container, viewModel = {}) {
  if (!container) return;
  const items = viewModel.socialInsights || [];
  const visible = items.slice(0, 24);
  const remainder = items.length - visible.length;
  container.innerHTML = `<section class="social-insight-shell"><header><div><span class="growth-kicker">SOCIAL SIGNALS</span><h2>社媒洞察</h2><p>聚合热点、竞品、评论问题、情绪和内容空白；没有链接与采集时间的判断统一标记为待补证据。</p></div><button data-social-capture>＋ 添加洞察</button></header>
  <div class="social-insight-summary"><span><b>${items.length}</b>洞察总数</span><span><b>${items.filter((item) => item.status === 'observed').length}</b>有证据</span><span><b>${items.filter((item) => item.status === 'pending_evidence').length}</b>待补证据</span></div>
  ${items.length ? `<div class="social-insight-grid">${visible.map((item) => `<article class="social-insight-card"><div><span class="growth-company">${escapeHtml(COMPANY[item.company] || item.company || '待路由')}</span><span class="social-evidence ${item.status}">${item.status === 'observed' ? '已观察' : '待补证据'}</span></div><h3>${escapeHtml(item.claim)}</h3><p>${escapeHtml(item.userQuestion || item.contentGap || '等待补充用户问题与内容空白')}</p><footer><small>${escapeHtml(item.platform || '未注明平台')} · 机会分 ${Number(item.score) || 0}</small><div><button data-social-edit="${escapeHtml(item.id)}">编辑</button><button data-social-to-content="${escapeHtml(item.id)}">转为选题</button><button data-social-delete="${escapeHtml(item.id)}">删除</button></div></footer></article>`).join('')}</div>${remainder > 0 ? `<p class="growth-list-more">还有 ${remainder} 条，优先展示机会分最高的洞察</p>` : ''}` : renderState('empty', '社媒洞察')}
  </section>`;
}
