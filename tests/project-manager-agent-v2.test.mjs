import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDailyReport,
  reportToMarkdown,
  REPORT_VERSION,
  generateBrief,
  briefToMarkdown,
} from '../src/project-manager-agent.mjs';

const AS_OF = new Date('2026-07-30T00:00:00Z');
function daysAgo(n) {
  return new Date(AS_OF.getTime() - n * 86400000).toISOString();
}

const sources = {
  wanjia: [
    { id: 'w1', merchantName: '老街奶茶店', stage: '执行中', riskLevel: '中', revenueStatus: '待收款', nextAction: '核对核销', updatedAt: daysAgo(20), source: 'wanjia' },
    { id: 'w2', merchantName: '海岸咖啡', stage: '复盘', riskLevel: '低', revenueStatus: '已收款', nextAction: '无', updatedAt: daysAgo(2), source: 'wanjia' },
  ],
  huahuo: [
    { id: 'h1', clientName: '海岸集团', projectName: '电商直播', projectType: '电商', stage: '拍摄中', deliveryStatus: '待交付', revenueStatus: '待回款', profitStatus: '待核算', updatedAt: daysAgo(10), source: 'huahuo' },
  ],
  projects: [
    { id: 'p1', name: '万嘉 ERP 升级', type: 'ERP建设', status: '进行中', owner: '小林', riskLevel: '高', updatedAt: daysAgo(3), source: 'projects' },
    { id: 'p2', name: '新墟镇政务项目', type: '政务', status: '已完成', owner: '阿May', riskLevel: '低', updatedAt: daysAgo(40), source: 'projects' },
  ],
  tasks: [
    { id: 't1', title: '整理本周周报', status: 'todo' },
    { id: 't2', title: '已完成的旧任务', status: 'done' },
  ],
};

test('generateDailyReport composes a review-required operating report', () => {
  const report = generateDailyReport(sources, { asOf: AS_OF, owner: '朱帅', inboxDrafts: 1 });
  assert.equal(report.reportVersion, REPORT_VERSION);
  assert.equal(report.reviewRequired, true);
  assert.equal(report.title, '朱帅经营日报');
  assert.ok(report.risksCount >= 2, `expected several risks, got ${report.risksCount}`);
  assert.ok(report.sections.keyFocus.length > 0);
  assert.ok(report.sections.projectRisks.length > 0);
  assert.ok(report.sections.decisions.length > 0);
  assert.ok(report.sections.suggestions.some((s) => s.includes('人工确认')));
  // p2 is done -> excluded from risks
  assert.ok(!report.sections.projectRisks.some((l) => l.includes('新墟镇政务项目')));
});

test('generateDailyReport surfaces stale + high-risk reasons', () => {
  const report = generateDailyReport(sources, { asOf: AS_OF });
  const joined = report.sections.projectRisks.join('\n');
  assert.ok(joined.includes('高') || joined.includes('老街奶茶店'), 'should mention高风险或停滞项目');
  assert.ok(joined.includes('万嘉 ERP 升级'), 'high-risk project should appear');
});

test('generateDailyReport handles empty sources gracefully', () => {
  const report = generateDailyReport({}, { asOf: AS_OF });
  assert.equal(report.risksCount, 0);
  assert.ok(report.sections.projectRisks.length >= 1);
  assert.ok(report.sections.keyFocus[0].includes('无'));
});

test('reportToMarkdown produces a reviewable draft', () => {
  const report = generateDailyReport(sources, { asOf: AS_OF, inboxDrafts: 2 });
  const md = reportToMarkdown(report);
  assert.ok(md.startsWith('# 朱帅经营日报'));
  assert.ok(md.includes('一、今日重点'));
  assert.ok(md.includes('二、项目风险'));
  assert.ok(md.includes('三、需要决策'));
  assert.ok(md.includes('四、建议动作'));
  assert.ok(md.includes('待人工审核'));
  assert.ok(md.includes('2 条收集箱草稿'));
});

test('V1 generateBrief remains compatible', () => {
  const brief = generateBrief(sources.projects, { asOf: AS_OF, tasks: sources.tasks });
  assert.equal(brief.title, '朱帅每日经营简报');
  assert.equal(brief.reviewRequired, true);
  const md = briefToMarkdown(brief);
  assert.ok(md.includes('五、AI 建议'));
});
