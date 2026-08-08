import { escapeHtml, renderState } from './view-utils.mjs?v=2.7.2';
import { buildLifeHomepagePresence } from '../homepage-presence.mjs?v=2.7.2';

function primaryAction(action = {}) {
  if (action.target === 'important-dates') return `<button class="v13-action v13-action-primary" data-important-dates-open="life">${escapeHtml(action.label)}</button>`;
  if (action.target === 'calendar') return `<button class="v13-action v13-action-primary" data-page="calendar">${escapeHtml(action.label)}</button>`;
  return `<button class="v13-action v13-action-primary" data-life-capture>${escapeHtml(action.label)}</button>`;
}

function todayCard(nextSevenDays = [], items = []) {
  const next = nextSevenDays.find((item) => item.daysUntil === 0)
    || items.find((item) => !item.deletedAt && !['done', 'completed', 'cancelled'].includes(item.status));
  if (!next) return `<article class="life-today-card"><span class="growth-kicker">TODAY · OWN TIME</span><h3>今天留给自己的事</h3><p>还没有生活安排。留下一件真正想完成的小事，而不是把时间填满。</p><button class="v13-action v13-action-primary" data-life-capture>记录一件事</button></article>`;
  return `<article class="life-today-card"><span class="growth-kicker">TODAY · OWN TIME</span><h3>今天留给自己的事</h3><strong>${escapeHtml(next.title)}</strong><p>${escapeHtml(next.category || next.area || '生活')} · ${escapeHtml(next.occurrence || next.date || '今天')}</p><button class="v13-action v13-action-primary" data-page="calendar">查看日历</button></article>`;
}

function careCard(importantDates = [], rituals = []) {
  const item = importantDates[0] || rituals[0];
  if (!item) return `<article class="life-care-card"><span class="growth-kicker">CARE · AHEAD</span><h3>值得提前准备</h3><p>未来还没有需要提醒的日期。你可以从日历或私人日期保险箱补充。</p><button class="v13-action" data-private-date-import>导入私人日期</button></article>`;
  const days = item.days ?? item.daysUntil;
  return `<article class="life-care-card"><span class="growth-kicker">CARE · AHEAD</span><h3>值得提前准备</h3><strong>${escapeHtml(item.title)}</strong><p>${days === 0 ? '今天' : `${days} 天后`} · 仅自己可见</p><button class="v13-action" data-important-dates-open="life">查看安排</button></article>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const summary = viewModel.lifeSummary || [];
  const items = viewModel.life || [];
  const importantDates = viewModel.importantDates?.life || [];
  const nextSevenDays = viewModel.lifeNextSevenDays || [];
  const rituals = viewModel.rituals || [];
  const privateDateSource = viewModel.privateDateSource || { state: 'idle', count: 0 };
  const weather = viewModel.weather || {};
  const presence = buildLifeHomepagePresence(viewModel);
  const weatherAction = '<button class="v13-action v13-action-quiet" type="button" data-weather-location>使用当前位置</button>';
  const weatherCard = weather.state === 'ready'
    ? `<article class="life-weather-card"><span>☀</span><div><strong>${escapeHtml(weather.location?.name || '天气')} · ${escapeHtml(weather.summary || '待确认')}</strong><p>${escapeHtml(`${weather.temperatureC ?? '—'}°C`)}${weather.apparentTemperatureC != null ? ` · 体感 ${escapeHtml(`${weather.apparentTemperatureC}°C`)}` : ''}</p>${weatherAction}<small>公开预报 · 仅在点击后请求定位，不保存精确位置</small></div></article>`
    : `<article class="life-weather-card is-pending"><span>☀</span><div><strong>今日天气${weather.state === 'loading' || weather.state === 'locating' ? '读取中' : '暂不可用'}</strong>${weatherAction}<small>${escapeHtml(weather.message || '拒绝定位后继续使用默认城市')}</small></div></article>`;
  const dateRows = importantDates.length ? `<div class="v13-list">${importantDates.slice(0, 6).map((item) => `<div class="v13-row"><div><strong>${escapeHtml(item.title)}</strong><div class="v13-meta">${escapeHtml(item.occurrence)} · 仅自己可见</div></div><span class="v13-chip">${item.days === 0 ? '今天' : `${item.days} 天`}</span></div>`).join('')}</div>` : renderState('empty', '重要日子');
  const drawer = viewModel.importantDatesPanel === 'life' ? `<aside class="important-dates-drawer" role="dialog" aria-modal="true" aria-label="全部重要日子"><header><div><small>仅自己可见</small><h2>重要日子</h2></div><button data-important-dates-close aria-label="关闭">×</button></header>${dateRows}<footer><button class="v13-action v13-action-primary" data-countdown-capture>＋ 新增重要日子</button></footer></aside><div class="task-drawer-backdrop" data-important-dates-close></div>` : '';
  const agendaRows = nextSevenDays.length ? `<div class="v13-list">${nextSevenDays.map((item) => `<div class="v13-row"><div><strong>${escapeHtml(item.title)}</strong><div class="v13-meta">${escapeHtml(item.occurrence)} · ${escapeHtml(item.category || item.area || '生活')}</div></div><span class="v13-chip">${item.daysUntil === 0 ? '今天' : `${item.daysUntil} 天后`}</span></div>`).join('')}</div>` : renderState('empty', '未来 7 天');
  const ritualCards = rituals.length ? `<div class="ritual-grid">${rituals.slice(0, 6).map((item) => `<article class="ritual-card"><div><span class="v13-chip">${item.daysUntil === 0 ? '今天' : `${item.daysUntil} 天后`}</span><small>${escapeHtml(item.occurrence)}</small></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.suggestion)}</p><footer><button class="v13-action v13-action-primary" data-ritual-convert="${escapeHtml(item.id)}">加入生活安排</button><button class="v13-action v13-action-quiet" data-ritual-ignore="${escapeHtml(item.id)}">今年忽略</button></footer></article>`).join('')}</div>` : renderState('empty', '近期仪式提醒');
  const managementCards = summary.length ? summary.map((area) => `<article class="life-area-card"><span>${escapeHtml(area.icon)}</span><h3>${escapeHtml(area.label)}</h3><strong>${area.open}</strong><p>待处理 / ${area.count} 条记录</p></article>`).join('') : renderState('empty', '生活分类');
  container.innerHTML = `<div class="life-hero v25-glass-hero" data-home-presence="life" data-presence-tone="${escapeHtml(presence.tone)}"><div><span class="v14-kicker">${escapeHtml(presence.kicker)} · 仅自己可见</span><h2>${escapeHtml(presence.title)}</h2><p>${escapeHtml(presence.summary)}</p></div><div class="life-hero-actions">${primaryAction(presence.primaryAction)}<button class="v13-action" data-private-date-import>${presence.secondaryAction.event === 'private-date-import' ? escapeHtml(presence.secondaryAction.label) : '导入私人日期'}</button></div></div>
    <section class="life-today-grid">${todayCard(nextSevenDays, items)}${careCard(importantDates, rituals)}${weatherCard}</section>
    <div class="v14-main-grid life-dashboard-grid"><div class="v14-section"><div class="v14-section-head"><div><h3>未来 7 天</h3><p>把需要提前准备的事放在眼前。</p></div><span>私有</span></div>${agendaRows}</div><div class="v14-section"><div class="v14-section-head"><h3>🎈 重要日子</h3><button class="v13-action" data-important-dates-open="life">查看全部</button></div>${dateRows}</div></div>
    <section class="v14-section life-ritual-section"><div class="v14-section-head"><div><h3>仪式提醒</h3><p>提前想到，才能把重要的日子过得有记忆。</p></div></div>${ritualCards}</section>
    <details class="v14-section life-management"><summary><span><span class="growth-kicker">PRIVATE MANAGEMENT</span><strong>生活管理</strong><small>分类、私人日期与所有事项 · 仅自己可见</small></span><span>展开</span></summary><div class="life-area-grid">${managementCards}</div><section class="private-date-import-note"><div><h3>私人日期保险箱</h3><p>仅导入标题、日期、分类和提醒提前量；不会读取或上传 Obsidian 正文、电话、地址、聊天或财务信息。</p></div><strong>${privateDateSource.state === 'ready' ? `已安全导入 ${privateDateSource.count} 条` : '尚未导入 · 完全自愿'}</strong></section><div class="life-all-items"><div class="v14-section-head"><h3>全部生活事项</h3><span>仅自己可见</span></div>${items.length ? `<div class="v13-list">${items.slice(0, 12).map((item) => `<div class="v13-row"><div><strong>${escapeHtml(item.title)}</strong><div class="v13-meta">${escapeHtml(item.area || '生活')} · ${escapeHtml(item.startAt?.slice(0, 16).replace('T', ' ') || item.date || item.monthDay || '未设时间')}</div></div><span class="v13-chip">${escapeHtml(item.status || '待处理')}</span></div>`).join('')}</div>` : renderState('empty', '生活事项')}</div></details>${drawer}`;
}
