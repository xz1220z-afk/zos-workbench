import test from 'node:test';
import assert from 'node:assert/strict';

import { LINGLI_TABLE_ALIASES, LINGLI_TABLE_NAMES, summarizeLingli } from '../supabase/functions/_shared/lingli-data.mjs';

test('declares the six minimum Lingli production fact tables', () => {
  assert.deepEqual(LINGLI_TABLE_NAMES, {
    leads: '00.招生线索管理',
    students: '00.学员档案管理',
    income: '00.收入管理',
    costs: '01.成本管理',
    lessons: '03.课时消耗管理',
    classes: '01.教学班级管理',
  });
  assert.deepEqual(LINGLI_TABLE_ALIASES.leads, ['00.招生线索管理', '01 招生线索管理']);
  assert.deepEqual(LINGLI_TABLE_ALIASES.income, ['00.收入管理', '00 收入成本管理']);
  assert.deepEqual(LINGLI_TABLE_ALIASES.costs, ['01.成本管理', '00 收入成本管理']);
});

test('summarizes current-month Lingli facts without confusing cash, students and classes', () => {
  const summary = summarizeLingli({
    leads: [{ fields: { '线索编号': 'L1' } }, { fields: { '线索编号': 'L2' } }],
    students: [
      { fields: { '学员状态': '在读' } },
      { fields: { '学员状态': '已结业' } },
    ],
    income: [
      { fields: { '收支类型': '收入', '实收金额': 3000, '发生日期': '2026-08-02' } },
      { fields: { '收支类型': '收入', '实收金额': 1000, '发生日期': '2026-07-31' } },
    ],
    costs: [
      { fields: { '金额': 500, '日期': '2026-08-02' } },
      { fields: { '金额': 200, '日期': '2026-07-31' } },
    ],
    lessons: [
      { fields: { '消耗课时': 2 } },
      { fields: { '课消状态': '已完成' } },
    ],
    classes: [
      { fields: { '班级状态': '开班中' } },
      { fields: { '班级状态': '已结课' } },
    ],
  }, { asOf: '2026-08-03T09:00:00+08:00' });

  assert.deepEqual(summary, {
    leads: 2,
    students: 1,
    received: 3000,
    cost: 500,
    grossProfit: 2500,
    consumed: 3,
    activeClasses: 1,
  });
});

test('uses null for unprovable active-student, finance, lesson and class metrics', () => {
  const summary = summarizeLingli({
    leads: [],
    students: [{ fields: { '姓名': '甲' } }],
    income: [{ fields: { '摘要': '没有金额字段' } }],
    costs: [{ fields: { '备注': '没有金额字段' } }],
    lessons: [{ fields: { '课程': 'A' } }],
    classes: [{ fields: { '班级名称': '一班' } }],
  }, { asOf: '2026-08-03T09:00:00+08:00' });

  assert.equal(summary.leads, 0);
  assert.equal(summary.students, null);
  assert.equal(summary.received, null);
  assert.equal(summary.cost, null);
  assert.equal(summary.grossProfit, null);
  assert.equal(summary.consumed, null);
  assert.equal(summary.activeClasses, null);
});
