import test from 'node:test';
import assert from 'node:assert/strict';

import { render as renderDashboard } from '../src/app/views/dashboard-view.mjs';
import { render as renderLife } from '../src/app/views/life-view.mjs';

function container() {
  return { innerHTML: '' };
}

test('work home shows only business deadlines and opens the complete work list', () => {
  const root = container();
  renderDashboard(root, {
    today: '2026-08-04', health: [], importantDates: {
      work: [{ id: 'w1', title: '万嘉合同到期', occurrence: '2026-08-10', days: 6, company: 'wanjia' }],
      life: [{ id: 'l1', title: '家人生日', occurrence: '2026-08-12', days: 8, company: 'life' }],
    },
  });

  assert.match(root.innerHTML, /关键期限/);
  assert.match(root.innerHTML, /万嘉合同到期/);
  assert.doesNotMatch(root.innerHTML, /家人生日/);
  assert.match(root.innerHTML, /data-important-dates-open="work"/);
});

test('work home shows privacy-safe morning and evening digest summaries', () => {
  const root = container();
  renderDashboard(root, {
    today: '2026-08-04', health: [], importantDates: { work: [], life: [] },
    morningDigest: { body: '今日重点 3 项；时间冲突 1 组；关键期限 2 项' },
    eveningDigest: { body: '今日完成 2 项；待顺延 1 项；明日重点 3 项' },
  });
  assert.match(root.innerHTML, /晨间简报/);
  assert.match(root.innerHTML, /今日重点 3 项/);
  assert.match(root.innerHTML, /晚间简报/);
  assert.doesNotMatch(root.innerHTML, /私人/);
});

test('life home shows private important dates without exposing business deadlines', () => {
  const root = container();
  renderLife(root, {
    lifeSummary: [], life: [], importantDates: {
      work: [{ id: 'w1', title: '万嘉合同到期', occurrence: '2026-08-10', days: 6 }],
      life: [{ id: 'l1', title: '家人生日', occurrence: '2026-08-12', days: 8 }],
    },
  });

  assert.match(root.innerHTML, /重要日子/);
  assert.match(root.innerHTML, /家人生日/);
  assert.doesNotMatch(root.innerHTML, /万嘉合同到期/);
  assert.match(root.innerHTML, /data-important-dates-open="life"/);
});
