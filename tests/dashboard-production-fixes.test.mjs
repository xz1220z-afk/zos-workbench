import test from 'node:test';
import assert from 'node:assert/strict';

import { render } from '../src/app/views/dashboard-view.mjs';
import { render as renderDecisions } from '../src/app/views/decision-view.mjs';
import { render as renderMobile } from '../src/app/views/mobile-view.mjs';

test('CEO dashboard formats money and never exposes JavaScript object placeholders', () => {
  const container = { innerHTML: '' };
  render(container, {
    today: '2026-08-02',
    state: 'ready',
    sources: {
      wanjia: { summary: { paymentGmv: 2882883.6000000043 } },
      huahuo: { summary: { outstandingAmount: 28000 } },
    },
    todayTop3: [{ id: 'a1', title: { text: '确认项目动作' } }],
    decisions: [{ id: 'd1', factSummary: { text: '核对项目状态' }, category: 'high_risk', severity: 'high', status: 'open' }],
    health: [], mustRead: [], calendar: [], calendarConflicts: [],
  });

  assert.match(container.innerHTML, /¥2,882,883\.60/);
  assert.match(container.innerHTML, /确认项目动作/);
  assert.match(container.innerHTML, /核对项目状态/);
  assert.doesNotMatch(container.innerHTML, /2882883\.6000000043|\[object Object\]/);
});

test('decision center also normalizes legacy rich-value decisions', () => {
  const container = { innerHTML: '' };
  renderDecisions(container, { state: 'ready', decisions: [{
    id: 'd-rich', status: 'open', severity: 'high',
    factSummary: { text: '确认客户交付时间' },
    recommendedAction: { text: '今天联系负责人' },
  }] });
  assert.match(container.innerHTML, /确认客户交付时间/);
  assert.match(container.innerHTML, /今天联系负责人/);
  assert.doesNotMatch(container.innerHTML, /\[object Object\]/);
});

test('decision surfaces separate CEO choices from owner follow-up and resolved history', () => {
  const decisions = [
    { id: 'ceo', status: 'open', category: 'revenue_pending', severity: 'high', factSummary: '花火项目待回款', recommendedAction: '确认收款方案' },
    { id: 'follow', status: 'open', category: 'stale', severity: 'medium', factSummary: '普通项目超过 7 天未更新', recommendedAction: '负责人跟进' },
    { id: 'history', status: 'pending_resolution', severity: 'high', factSummary: '旧风险', decisionNote: '来源风险已消失，等待人工确认解除' },
  ];
  const dashboard = { innerHTML: '' };
  render(dashboard, { state: 'ready', today: '2026-08-07', decisions, health: [], mustRead: [], calendar: [], calendarConflicts: [] });
  assert.match(dashboard.innerHTML, /<span>待我决策<\/span><strong>1<\/strong>/);
  assert.match(dashboard.innerHTML, /花火项目待回款/);
  assert.doesNotMatch(dashboard.innerHTML, /普通项目超过 7 天未更新|来源风险已消失/);

  const center = { innerHTML: '' };
  renderDecisions(center, { state: 'ready', decisions });
  assert.match(center.innerHTML, /需要你决定[\s\S]*1/);
  assert.match(center.innerHTML, /负责人跟进[\s\S]*1/);
  assert.match(center.innerHTML, /已归档历史[\s\S]*1/);
  assert.match(center.innerHTML, /data-decision-action="approve"/);
  assert.match(center.innerHTML, /data-decision-action="delegate"/);
  assert.match(center.innerHTML, /data-decision-action="defer"/);
  assert.match(center.innerHTML, /data-decision-source="ceo"/);
  assert.equal((center.innerHTML.match(/data-preview-decision=/g) || []).length, 0);

  const mobile = { innerHTML: '' };
  renderMobile(mobile, { decisions });
  assert.match(mobile.innerHTML, /1 项需要确认/);
});

test('decision inbox limits history, exposes load more and renders a safe action drawer', () => {
  const history = Array.from({ length: 20 }, (_, index) => ({
    id: `history-${index}`, status: index === 0 ? 'pending_resolution' : 'approved',
    severity: 'medium', factSummary: `历史事项 ${index}`, decisionNote: '已处理',
  }));
  const container = { innerHTML: '' };
  renderDecisions(container, {
    state: 'ready',
    decisions: [
      { id: 'ceo', status: 'open', category: 'revenue_pending', severity: 'high', factSummary: '待确认回款', recommendedAction: '确认方案' },
      ...history,
    ],
    decisionUi: {
      action: { decisionId: 'ceo', action: 'approve' }, busy: false, error: null,
      search: '', company: 'all', status: 'all', followUpLimit: 6, historyLimit: 6,
    },
  });

  assert.equal((container.innerHTML.match(/class="decision-history-row/g) || []).length, 6);
  assert.match(container.innerHTML, /data-decision-load-more="history"/);
  assert.match(container.innerHTML, /role="dialog"/);
  assert.match(container.innerHTML, /data-decision-confirm/);
  assert.doesNotMatch(container.innerHTML, /历史事项 19/);

  const pending = { innerHTML: '' };
  renderDecisions(pending, {
    state: 'ready', decisions: [history[0]],
    decisionUi: { action: null, search: '', company: 'all', status: 'all', followUpLimit: 6, historyLimit: 6 },
  });
  assert.match(pending.innerHTML, /data-decision-action="resolve"/);
  assert.match(pending.innerHTML, /data-decision-action="reopen"/);
  assert.doesNotMatch(pending.innerHTML, /data-preview-decision/);
});
