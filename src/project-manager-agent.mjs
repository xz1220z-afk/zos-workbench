// Project Manager Agent V1 — deterministic, read-only daily brief generator.
//
// Hard constraints (see docs/data-source-map.md and the V1.1 brief):
//   - This agent NEVER writes to a database, knowledge base, or sends any
//     external message. It only READS project metadata + local tasks and
//     produces a structured brief.
//   - Every brief is marked `reviewRequired: true`. Nothing it suggests is
//     executed until 朱帅 manually reviews and approves through the Inbox
//     review pipeline.
//   - No network, no secrets, no API calls. Deterministic given the same
//     inputs, which keeps it trivially testable.

export const BRIEF_VERSION = '1.0';

// Canonical section names (stable keys for the UI + tests).
export const BRIEF_SECTIONS = ['keyTasks', 'delayRisks', 'merchantFollowups', 'decisions', 'suggestions'];

function isoDate(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

// Build the daily brief from a validated project index + local context.
// `context` fields are all optional and purely local/metadata.
export function generateBrief(projects = [], context = {}) {
  const date = context.date || isoDate();
  const owner = context.owner || '朱帅';
  const tasks = Array.isArray(context.tasks) ? context.tasks : [];
  const inboxDrafts = Number.isFinite(context.inboxDrafts) ? context.inboxDrafts : 0;

  const list = Array.isArray(projects) ? projects : (projects && projects.projects) || [];

  const highRisk = list.filter((p) => p.riskLevel === '高' || p.status === '风险' || p.status === '已延期');
  const active = list.filter((p) => p.status === '进行中');
  const wanjia = list.filter((p) => p.source === 'wanjia' || p.type === '万嘉商家运营');

  const keyTasks = [];
  for (const p of active) {
    keyTasks.push(`跟进「${p.name}」（状态：${p.status}，风险：${p.riskLevel}，负责人：${p.owner}）`);
  }
  for (const t of tasks) {
    if (t && t.status !== 'done' && t.status !== '已完成') {
      keyTasks.push(`处理任务：${t.title || t.name || '未命名任务'}`);
    }
  }
  if (keyTasks.length === 0) keyTasks.push('今日无进行中项目，可安排规划与复盘。');

  const delayRisks = [];
  for (const p of highRisk) {
    delayRisks.push(`「${p.name}」存在延期/风险（状态：${p.status}，风险等级：${p.riskLevel}），最近更新：${shortDate(p.updatedAt)}`);
  }
  if (delayRisks.length === 0) delayRisks.push('当前无高风险的延期项目，保持监控。');

  const merchantFollowups = [];
  for (const p of wanjia) {
    if (p.status === '进行中') {
      merchantFollowups.push(`万嘉商家运营「${p.name}」进行中，建议今日核对动销与核销数据。`);
    }
  }
  if (merchantFollowups.length === 0) merchantFollowups.push('暂无万嘉商家运营跟进提醒。');

  const decisions = [];
  for (const p of highRisk) {
    decisions.push(`需决策：「${p.name}」是否增派资源或调整交付节奏（风险：${p.riskLevel}）。`);
  }
  if (inboxDrafts > 0) {
    decisions.push(`有 ${inboxDrafts} 条收集箱草稿待审核，决定是否进入工作流。`);
  }
  if (decisions.length === 0) decisions.push('今日无明确待决策事项。');

  const suggestions = [];
  if (highRisk.length >= 2) {
    suggestions.push(`高风险项目较多（${highRisk.length} 个），建议优先召开项目同步会。`);
  }
  if (active.length > 0) {
    suggestions.push('建议每日上午固定 15 分钟过一遍进行中项目状态。');
  }
  if (inboxDrafts > 0) {
    suggestions.push('先清理收集箱草稿，避免 AI 指令与待办堆积。');
  }
  if (suggestions.length === 0) suggestions.push('系统运行平稳，按既定节奏推进即可。');

  return {
    briefVersion: BRIEF_VERSION,
    title: `${owner}每日经营简报`,
    date,
    owner,
    generatedAt: new Date().toISOString(),
    reviewRequired: true,
    disclaimer: '本简报由 AI 生成，须人工审核后方可执行；AI 不直接修改数据库、知识库或发送外部消息。',
    sections: {
      keyTasks,
      delayRisks,
      merchantFollowups,
      decisions,
      suggestions,
    },
  };
}

function shortDate(iso) {
  if (!iso) return '未知';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未知';
  return d.toISOString().slice(0, 10);
}

// Serialize a brief to a Markdown draft for the Inbox review pipeline.
// This is the ONLY output path — a draft file for human review, never a
// direct write to the knowledge base.
export function briefToMarkdown(brief) {
  if (!brief || !brief.sections) throw new Error('invalid brief');
  const lines = [];
  lines.push(`# ${brief.title}`);
  lines.push('');
  lines.push(`- 日期：${brief.date}`);
  lines.push(`- 负责人：${brief.owner}`);
  lines.push(`- 状态：待人工审核（AI 生成）`);
  lines.push('');
  const titles = {
    keyTasks: '一、今日重点任务',
    delayRisks: '二、项目延期风险',
    merchantFollowups: '三、商家跟进提醒',
    decisions: '四、待决策事项',
    suggestions: '五、AI 建议',
  };
  for (const key of BRIEF_SECTIONS) {
    lines.push(`## ${titles[key]}`);
    const items = brief.sections[key] || [];
    if (items.length === 0) {
      lines.push('- （无）');
    } else {
      for (const item of items) lines.push(`- ${item}`);
    }
    lines.push('');
  }
  lines.push(`> ${brief.disclaimer}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Project Manager Agent V2 — 朱帅经营日报
//
// Consumes read-only metadata from every business source (wanjia / huahuo /
// projects) plus local tasks, runs the risk detector, and produces a daily
// operating report. Same hard constraints as V1: read-only inputs, no writes,
// reviewRequired = true, deterministic.
// ---------------------------------------------------------------------------

export const REPORT_VERSION = '2.0';
export const REPORT_SECTIONS = ['keyFocus', 'projectRisks', 'decisions', 'suggestions'];

// Re-export the risk engine so callers have a single import surface.
import { detectRisks, isDone, bucketRisks, riskLevelFromReasons } from './risk-detector.mjs';
export { detectRisks, isDone, bucketRisks, riskLevelFromReasons };

// Normalize an arbitrary source payload to a plain records array.
function asRecords(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (Array.isArray(source.records)) return source.records;
  if (Array.isArray(source.projects)) return source.projects;
  return [];
}

export function generateDailyReport(sources = {}, context = {}) {
  const date = context.date || isoDate(context.asOf || new Date());
  const owner = context.owner || '朱帅';
  const asOf = context.asOf || new Date();

  const wanjia = asRecords(sources.wanjia);
  const huahuo = asRecords(sources.huahuo);
  const projects = asRecords(sources.projects);
  const tasks = Array.isArray(sources.tasks) ? sources.tasks : [];
  const inboxDrafts = Number.isFinite(context.inboxDrafts) ? context.inboxDrafts : 0;

  const wanjiaRisks = detectRisks(wanjia, 'wanjia', { asOf });
  const huahuoRisks = detectRisks(huahuo, 'huahuo', { asOf });
  const projectRisks = detectRisks(projects, 'project', { asOf });
  const allRisks = [...wanjiaRisks, ...huahuoRisks, ...projectRisks];

  // 今日重点：进行中项目 + 活跃商家/拍摄 + 未完成任务
  const keyFocus = [];
  for (const p of projects) {
    if (p.status === '进行中') keyFocus.push(`推进「${p.name}」（负责人：${p.owner}，风险：${p.riskLevel}）`);
  }
  for (const w of wanjia) {
    if (!isDone(w, 'wanjia')) {
      keyFocus.push(`万嘉「${w.merchantName}」：${w.nextAction || w.stage}`);
    }
  }
  for (const h of huahuo) {
    if (!isDone(h, 'huahuo')) {
      keyFocus.push(`花火「${h.projectName}」：${h.stage} / ${h.deliveryStatus} / ${h.revenueStatus}`);
    }
  }
  for (const t of tasks) {
    if (t && t.status !== 'done' && t.status !== '已完成') {
      keyFocus.push(`任务：${t.title || t.name || '未命名任务'}`);
    }
  }
  if (keyFocus.length === 0) keyFocus.push('今日无进行中项目或未完成任务，可安排规划与复盘。');

  // 项目风险
  const projectRisksLines = allRisks.length
    ? allRisks.map((r) => `【${r.level}】${r.name}（${kindLabel(r.kind)}）：${r.reasons.map((x) => x.label).join('；')}`)
    : ['当前无高风险或延期项目，保持监控。'];

  // 需要决策
  const decisions = [];
  for (const r of allRisks) {
    if (r.level === '高') decisions.push(`「${r.name}」风险等级高，需决策是否增派资源或调整交付节奏。`);
  }
  if (inboxDrafts > 0) decisions.push(`有 ${inboxDrafts} 条收集箱草稿待审核，决定是否进入工作流。`);
  if (decisions.length === 0) decisions.push('今日无明确待决策事项。');

  // 建议动作
  const suggestions = [];
  if (allRisks.length >= 2) suggestions.push(`风险项较多（${allRisks.length} 个），建议上午召开 15 分钟项目同步会。`);
  const stale = allRisks.filter((r) => r.reasons.some((x) => x.code === 'stale'));
  if (stale.length) suggestions.push(`${stale.length} 个项目超过 7 天未更新，建议立即推动状态刷新与负责人确认。`);
  suggestions.push('所有结论须经 Inbox 审核、人工确认后方可执行；AI 不直接修改数据库、知识库或发送外部消息。');
  if (suggestions.length === 1) suggestions.unshift('系统运行平稳，按既定节奏推进即可。');

  return {
    reportVersion: REPORT_VERSION,
    title: `${owner}经营日报`,
    date,
    owner,
    generatedAt: new Date().toISOString(),
    reviewRequired: true,
    disclaimer: '本日报由 AI 生成，须人工审核后方可执行；AI 不直接修改数据库、知识库或发送外部消息。',
    risksCount: allRisks.length,
    sections: {
      keyFocus,
      projectRisks: projectRisksLines,
      decisions,
      suggestions,
    },
  };
}

function kindLabel(kind) {
  return { wanjia: '万嘉', huahuo: '花火', project: '项目' }[kind] || kind;
}

// Serialize the V2 report to a Markdown draft for the Inbox review pipeline.
export function reportToMarkdown(report) {
  if (!report || !report.sections) throw new Error('invalid report');
  const lines = [];
  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(`- 日期：${report.date}`);
  lines.push(`- 负责人：${report.owner}`);
  lines.push(`- 风险项：${report.risksCount}`);
  lines.push(`- 状态：待人工审核（AI 生成）`);
  lines.push('');
  const titles = {
    keyFocus: '一、今日重点',
    projectRisks: '二、项目风险',
    decisions: '三、需要决策',
    suggestions: '四、建议动作',
  };
  for (const key of REPORT_SECTIONS) {
    lines.push(`## ${titles[key]}`);
    const items = report.sections[key] || [];
    if (items.length === 0) {
      lines.push('- （无）');
    } else {
      for (const item of items) lines.push(`- ${item}`);
    }
    lines.push('');
  }
  lines.push(`> ${report.disclaimer}`);
  return lines.join('\n');
}

