import test from 'node:test';
import assert from 'node:assert/strict';

import { render } from '../src/app/views/dashboard-view.mjs';
import { render as renderDecisions } from '../src/app/views/decision-view.mjs';

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
    decisions: [{ id: 'd1', factSummary: { text: '核对项目状态' }, severity: 'high', status: 'open' }],
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
