import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CEO_BRIEF_SECTIONS,
  briefFingerprint,
  ceoBriefToMarkdown,
  generateCeoBrief,
  shouldGenerateBrief,
} from '../src/app/daily-brief.mjs';

const fixture = {
  tasks: [
    { id: 't2', title: '核对回款', status: 'open', priority: 3, dueDate: '2026-08-02' },
    { id: 't1', title: '确认交付', status: 'done', completedAt: '2026-08-01T12:00:00.000Z' },
    { id: 't3', title: '推进商家活动', status: 'open', priority: 2, dueDate: '2026-08-02' },
  ],
  decisions: [{ id: 'd1', factSummary: '一个项目延期', status: 'open', severity: 'high' }],
  targetGaps: [{ metricKey: 'wanjia.paymentGmv', state: 'behind', actual: 80, gap: 20 }],
  risks: [{ source: 'huahuo', sourceRecordId: 'p1', factSummary: '交付延期 3 天', severity: 'high' }],
  wanjia: { summary: { paymentGmv: 80, redeemedGmv: 60 }, fetchedAt: '2026-08-02T06:00:00.000Z' },
  huahuo: { summary: { receivedAmount: 5000, outstandingAmount: 3000, pendingDeliveries: 2 }, fetchedAt: '2026-08-02T06:05:00.000Z' },
  aiSuggestions: ['先确认高风险项目的新交付日期'],
  health: [{ source: 'wanjia', state: 'synced', lastSuccessAt: '2026-08-02T06:00:00.000Z' }],
};

test('CEO brief has eight fixed sections and remains a review draft', () => {
  const brief = generateCeoBrief(fixture, { date: '2026-08-02', now: '2026-08-02T07:30:00.000Z' });
  assert.deepEqual(Object.keys(brief.sections), [
    'yesterday',
    'todayTop3',
    'targetGaps',
    'risks',
    'decisions',
    'cashAndDelivery',
    'aiSuggestions',
    'freshness',
  ]);
  assert.deepEqual(CEO_BRIEF_SECTIONS, Object.keys(brief.sections));
  assert.equal(brief.reviewStatus, 'pending_review');
  assert.equal(brief.kind, 'daily_brief');
  assert.deepEqual(brief.sections.yesterday.map((task) => task.title), ['确认交付']);
  assert.deepEqual(brief.sections.todayTop3.map((task) => task.title), ['核对回款', '推进商家活动', '一个项目延期']);
});

test('same date and same data fingerprint generates once', () => {
  const existing = [generateCeoBrief(fixture, { date: '2026-08-02', now: '2026-08-02T07:30:00.000Z' })];
  assert.equal(shouldGenerateBrief(existing, fixture, { date: '2026-08-02' }), false);
  assert.equal(shouldGenerateBrief(existing, { ...fixture, risks: [] }, { date: '2026-08-02' }), true);
  assert.equal(shouldGenerateBrief(existing, fixture, { date: '2026-08-03' }), true);
});

test('fingerprint is stable across object key order and is a SHA-256 hex digest', () => {
  const left = briefFingerprint({ b: 2, a: { y: 2, x: 1 } });
  const right = briefFingerprint({ a: { x: 1, y: 2 }, b: 2 });
  assert.equal(left, right);
  assert.match(left, /^[a-f0-9]{64}$/);
});

test('brief keeps source facts and AI suggestions separate and exports all headings', () => {
  const brief = generateCeoBrief(fixture, { date: '2026-08-02', now: '2026-08-02T07:30:00.000Z' });
  assert.deepEqual(brief.sections.cashAndDelivery, {
    wanjia: { paymentGmv: 80, redeemedGmv: 60 },
    huahuo: { receivedAmount: 5000, outstandingAmount: 3000, pendingDeliveries: 2 },
  });
  assert.deepEqual(brief.sections.aiSuggestions, ['先确认高风险项目的新交付日期']);
  const markdown = ceoBriefToMarkdown(brief);
  for (const heading of ['昨日复盘', '今日 Top 3', '目标差距', '风险', '待我决策', '现金与交付', 'AI 建议', '数据新鲜度']) {
    assert.match(markdown, new RegExp(`## ${heading}`));
  }
  assert.match(markdown, /待人工审核/);
});

test('open decisions fill empty Top 3 slots without leaking object strings', () => {
  const brief = generateCeoBrief({
    tasks: [{ id: 't1', title: '先处理今天到期任务', status: 'open', priority: 3, dueDate: '2026-08-02' }],
    decisions: [
      { id: 'd1', factSummary: '确认万嘉停滞商家的负责人和完成时间', status: 'open', severity: 'high' },
      { id: 'd2', factSummary: '确认花火待回款项目的收款日期', status: 'open', severity: 'medium' },
    ],
  }, { date: '2026-08-02', now: '2026-08-02T07:30:00.000Z' });

  assert.deepEqual(brief.sections.todayTop3.map((item) => item.title), [
    '先处理今天到期任务',
    '确认万嘉停滞商家的负责人和完成时间',
    '确认花火待回款项目的收款日期',
  ]);
  assert.equal(brief.sections.todayTop3.every((item) => !item.title.includes('[object Object]')), true);
});
