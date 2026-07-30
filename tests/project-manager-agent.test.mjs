import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBrief,
  briefToMarkdown,
  BRIEF_SECTIONS,
} from '../src/project-manager-agent.mjs';

const sampleProjects = [
  { id: 'p1', name: '万嘉商家运营', type: '万嘉商家运营', status: '进行中', owner: '运营组', updatedAt: '2026-07-28T09:00:00Z', riskLevel: '中', source: 'wanjia' },
  { id: 'p2', name: '花火拍摄', type: '花火拍摄', status: '风险', owner: '花火团队', updatedAt: '2026-07-26T11:00:00Z', riskLevel: '高', source: 'huahuo' },
  { id: 'p3', name: 'ERP建设', type: 'ERP建设', status: '待启动', owner: 'IT组', updatedAt: '2026-07-25T16:00:00Z', riskLevel: '低', source: 'erp' },
];

test('generateBrief produces the 5 required sections', () => {
  const brief = generateBrief(sampleProjects, { owner: '朱帅', date: '2026-07-30' });
  for (const key of BRIEF_SECTIONS) {
    assert.ok(Array.isArray(brief.sections[key]), `section ${key} should be array`);
  }
  assert.equal(brief.title, '朱帅每日经营简报');
  assert.equal(brief.reviewRequired, true);
  assert.match(brief.disclaimer, /人工审核/);
});

test('generateBrief flags high-risk projects as delay risks', () => {
  const brief = generateBrief(sampleProjects);
  // p2 风险 + 高 should appear in delayRisks
  const text = brief.sections.delayRisks.join('\n');
  assert.match(text, /花火拍摄/);
  assert.match(text, /风险|延期/);
});

test('generateBrief routes wanjia to merchant follow-ups', () => {
  const brief = generateBrief(sampleProjects);
  const text = brief.sections.merchantFollowups.join('\n');
  assert.match(text, /万嘉/);
});

test('generateBrief lists decisions for high-risk + inbox drafts', () => {
  const brief = generateBrief(sampleProjects, { inboxDrafts: 3 });
  const text = brief.sections.decisions.join('\n');
  assert.match(text, /花火拍摄/);
  assert.match(text, /3 条收集箱草稿/);
});

test('generateBrief handles empty projects without throwing', () => {
  const brief = generateBrief([], { owner: '朱帅' });
  assert.equal(brief.sections.keyTasks.length, 1); // fallback line
  assert.equal(brief.sections.delayRisks[0], '当前无高风险的延期项目，保持监控。');
});

test('generateBrief is deterministic for same input', () => {
  const a = JSON.stringify(generateBrief(sampleProjects, { date: '2026-07-30' }).sections);
  const b = JSON.stringify(generateBrief(sampleProjects, { date: '2026-07-30' }).sections);
  assert.equal(a, b);
});

test('briefToMarkdown renders all sections with title', () => {
  const brief = generateBrief(sampleProjects, { owner: '朱帅', date: '2026-07-30' });
  const md = briefToMarkdown(brief);
  assert.match(md, /# 朱帅每日经营简报/);
  assert.match(md, /一、今日重点任务/);
  assert.match(md, /二、项目延期风险/);
  assert.match(md, /三、商家跟进提醒/);
  assert.match(md, /四、待决策事项/);
  assert.match(md, /五、AI 建议/);
  assert.match(md, /人工审核/);
});

test('briefToMarkdown throws on invalid brief', () => {
  assert.throws(() => briefToMarkdown({}), /invalid brief/);
});
