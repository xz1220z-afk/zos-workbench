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

test('life home provides a seven-day agenda, ritual planning and privacy-safe metadata import', () => {
  const root = container();
  renderLife(root, {
    lifeSummary: [
      { key: 'health', icon: '♡', label: '健康与精力', open: 1, count: 2 },
      { key: 'family', icon: '⌂', label: '家庭与关系', open: 1, count: 1 },
    ],
    life: [], importantDates: { work: [], life: [] },
    lifeNextSevenDays: [{ id: 'next-1', title: '家人晚餐', occurrence: '2026-08-10', daysUntil: 3, category: 'family' }],
    rituals: [{ id: 'milk-tea', title: '秋天的第一杯奶茶', occurrence: '2026-08-11', daysUntil: 4, suggestion: '提前选好口味。' }],
    privateDateSource: { state: 'ready', count: 19 },
  });
  assert.match(root.innerHTML, /未来 7 天/);
  assert.match(root.innerHTML, /家人晚餐/);
  assert.match(root.innerHTML, /仪式提醒/);
  assert.match(root.innerHTML, /秋天的第一杯奶茶/);
  assert.match(root.innerHTML, /data-ritual-convert="milk-tea"/);
  assert.match(root.innerHTML, /data-ritual-ignore="milk-tea"/);
  assert.match(root.innerHTML, /仅导入标题、日期、分类和提醒提前量/);
  assert.match(root.innerHTML, /data-private-date-import/);
  assert.match(root.innerHTML, /已安全导入 19 条/);
});

test('life home prioritizes today, upcoming care and a collapsible private management layer', () => {
  const root = container();
  renderLife(root, {
    lifeSummary: [{ key: 'health', icon: '♡', label: '健康与精力', open: 1, count: 2 }],
    life: [{ id: 'life-1', title: '晚间散步', area: 'health', status: 'open', date: '2026-08-08' }],
    importantDates: { work: [], life: [{ id: 'date-1', title: '重要日期', occurrence: '2026-08-09', days: 1 }] },
    lifeNextSevenDays: [{ id: 'next-1', title: '晚间散步', occurrence: '2026-08-08', daysUntil: 0, category: 'health' }],
    rituals: [{ id: 'ritual-1', title: '秋日准备', occurrence: '2026-08-20', daysUntil: 12, suggestion: '提前安排。' }],
  });
  assert.match(root.innerHTML, /今天留给自己的事/);
  assert.match(root.innerHTML, /值得提前准备/);
  assert.match(root.innerHTML, /生活管理/);
  assert.match(root.innerHTML, /仅自己可见/);
});
