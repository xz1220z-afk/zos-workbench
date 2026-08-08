import { AGENT_OS_CATEGORIES } from '../agent-os-center.mjs?v=2.7.2';
import { escapeHtml, renderState } from './view-utils.mjs?v=2.7.2';

const FILTERS = Object.freeze([
  ['all', '全部可见'], ['shared', '总控与共享中台'], ['wanjia', '万嘉网络'],
  ['huahuo', '花火影像'], ['lingli', '玲丽教育'], ['life', '我的生活'], ['private-relations', '私密关系'],
]);
const STATUS_LABEL = Object.freeze({ draft: '草稿', pilot: '试运行', active: '已启用', deprecated: '已停用' });
const PILOT_LABEL = Object.freeze({ draft: '草稿', pilot: '试运行', review: '待复核', passed: '已通过', failed: '未通过', active: '已启用', evidence: '有证据' });

function agentCard(agent) {
  const mission = agent.sections?.mission || '职责待身份卡补充';
  const pilot = agent.recentPilot
    ? `Pilot ${PILOT_LABEL[agent.recentPilot.status] || agent.recentPilot.status}${agent.recentPilot.updatedAt ? ` · ${String(agent.recentPilot.updatedAt).slice(0, 10)}` : ''}`
    : '待补 Pilot 证据';
  const privateMark = agent.agentId === 'REL-001' ? '<span class="agent-private-mark">私密关系</span>' : '';
  return `<article class="agent-card agent-os-card" data-agent-id="${escapeHtml(agent.agentId)}">
    <div class="agent-orb">${escapeHtml((agent.name || agent.agentId).slice(0, 1))}</div>
    <div class="agent-card-copy"><div class="agent-card-eyebrow"><span>${escapeHtml(AGENT_OS_CATEGORIES[agent.category] || agent.category)}</span>${privateMark}</div>
      <h3>${escapeHtml(agent.name || agent.agentId)}</h3><code>${escapeHtml(agent.agentId)}</code><p>${escapeHtml(mission)}</p>
      <div class="agent-card-meta"><span data-agent-status="${escapeHtml(agent.status)}">${escapeHtml(STATUS_LABEL[agent.status] || agent.status)}</span><span data-agent-runtime="${escapeHtml(agent.runtimeAvailability || 'can_draft')}">${escapeHtml(agent.runtimeAvailability === 'can_analyze' ? '可直接分析' : agent.runtimeAvailability === 'pilot_limited' ? '试运行分析' : '可派任务')}</span><span>${Number(agent.skillIds?.length) || 0} Skills</span><span>上下文 ${Number(agent.confirmedContextCount) || 0}</span><span>${escapeHtml(String(agent.updatedAt || '待更新').slice(0, 10))}</span><span>${escapeHtml(pilot)}</span></div>
    </div>
    <div class="agent-card-actions"><button class="v13-action" data-agent-details="${escapeHtml(agent.agentId)}">查看详情</button><button class="v13-action v13-action-primary" data-agent-analyze="${escapeHtml(agent.agentId)}">直接分析</button><button class="v13-action" data-agent-invoke="${escapeHtml(agent.agentId)}">派任务</button></div>
  </article>`;
}

function runRows(runs) {
  if (!runs.length) return renderState('empty', 'Agent 执行记录');
  const visible = runs.slice().reverse().slice(0, 30);
  const remainder = runs.length - visible.length;
  return `${visible.map((run) => `<div class="agent-run-row"><div><strong>${escapeHtml(run.objective)}</strong><small>${escapeHtml(run.agentId)} · ${escapeHtml(run.status)}</small></div><div>${run.status === 'draft' ? `<button data-agent-submit="${escapeHtml(run.id)}">提交审核</button>` : ''}${run.status === 'awaiting_approval' ? `<button data-agent-approve="${escapeHtml(run.id)}">审核通过</button>` : ''}<button data-agent-run-delete="${escapeHtml(run.id)}">删除</button></div></div>`).join('')}${remainder > 0 ? `<p class="growth-list-more">还有 ${remainder} 条，已按最新执行时间优先展示</p>` : ''}`;
}

function patrolPanel(viewModel) {
  const patrol = viewModel.agentOsPatrol;
  const overview = viewModel.agentOsOverview;
  const status = overview?.summary?.status || {};
  const changes = patrol ? [...(patrol.added || []), ...(patrol.modified || []), ...(patrol.missing || []), ...(patrol.deprecated || [])] : [];
  const risks = patrol?.risks || [];
  return `<section class="agent-os-patrol"><div><span class="growth-kicker">READ-ONLY PATROL</span><h3>Agent OS 巡检</h3><p>${escapeHtml(patrol?.message || '等待首次只读索引。')}</p></div>
    <div class="agent-os-patrol-stats"><span><b>${Number(overview?.summary?.total) || 0}</b>Agent</span><span><b>${Number(status.draft) || 0}</b>draft</span><span><b>${Number(status.pilot) || 0}</b>pilot</span><span><b>${Number(status.active) || 0}</b>active</span><span><b>${Number(status.deprecated) || 0}</b>deprecated</span><span><b>${Number(patrol?.risks?.length) || 0}</b>待补证据</span></div>
    ${changes.length ? `<p class="agent-os-change-list">结构变化：${changes.slice(0, 8).map(escapeHtml).join('、')}${changes.length > 8 ? '…' : ''}</p>` : ''}
    ${risks.length ? `<details class="agent-os-risk-list"><summary>需要朱帅确认：${risks.length} 个 Agent 缺少完整证据</summary><p>${risks.slice(0, 10).map((item) => `${escapeHtml(item.agentId)}（${item.missing.map(escapeHtml).join('、')}）`).join('；')}${risks.length > 10 ? '…' : ''}</p></details>` : ''}
  </section>`;
}

function detailsList(items, idKey) {
  if (!items?.length) return '<span class="agent-detail-empty">暂无关联记录</span>';
  return items.slice(0, 12).map((item) => `<span>${escapeHtml(item.name || item[idKey] || '未命名')}</span>`).join('');
}

function taskArchivePanel(detail, archives = [], candidates = []) {
  if (!detail) return '';
  const current = archives.filter((item) => item.agentId === detail.agentId).slice().sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))).slice(0, 8);
  if (!current.length) return `<section class="agent-task-archives"><h4>本机任务记录</h4><p>从“派任务”保存后，这里会记录该 Agent 的任务目标、规则快照与待确认上下文；不参与云同步。</p></section>`;
  return `<section class="agent-task-archives"><header><div><span class="growth-kicker">LOCAL TASK MEMORY</span><h4>本机任务记录</h4></div><small>规则快照与候选上下文仅本机保存</small></header>${current.map((archive) => {
    const candidate = candidates.find((item) => item.id === archive.contextCandidateId || item.archiveId === archive.id);
    const canAnalyze = archive.phase === 'draft' && detail.agentId !== 'REL-001';
    const candidateActions = candidate?.status === 'pending_confirmation' ? `<div class="agent-task-row-actions"><button class="v13-action v13-action-primary" data-agent-context-confirm="${escapeHtml(candidate.id)}">确认写入上下文</button><button class="v13-action" data-agent-context-reject="${escapeHtml(candidate.id)}">忽略候选</button></div>` : candidate ? `<small>上下文：${escapeHtml(candidate.status === 'confirmed' ? '已确认' : '已忽略')}</small>` : '';
    return `<article class="agent-task-row"><div><strong>${escapeHtml(archive.objective)}</strong><small>${escapeHtml(archive.phase === 'draft' ? '草稿待分析' : archive.phase === 'result_ready' ? '只读分析已完成' : archive.phase)} · ${escapeHtml(String(archive.createdAt || '').replace('T', ' ').slice(0, 16))}</small>${candidate?.summary ? `<p>${escapeHtml(candidate.summary)}</p>` : ''}</div><div class="agent-task-row-actions">${canAnalyze ? `<button class="v13-action" data-agent-task-analyze="${escapeHtml(archive.id)}">开始只读分析</button>` : ''}${candidateActions}</div></article>`;
  }).join('')}</section>`;
}

function detailsDrawer(detail, reminderDrafts = [], analysis = null, archives = [], candidates = []) {
  if (!detail) return '';
  const sections = detail.sections || {};
  const invocation = `请以 ${detail.name || detail.agentId}（${detail.agentId}）身份进行只读分析或起草。先区分事实、推断、建议、待确认，再给出下一步；不得自动写入、外发或执行。`;
  const relation = detail.agentId === 'REL-001' ? `<section class="agent-private-policy"><h4>私密关系 · 本地提醒草稿</h4><p>只使用明确提供的重要日期、已确认偏好、承诺、待关心事项和有效沟通方式；不读取私密聊天全文、性隐私、定位账号密码、猜测、私人财务或医疗细节。</p><div>${reminderDrafts.map((item) => `<span>${escapeHtml(item.title)}<small>本地草稿 · 不自动发送</small></span>`).join('')}</div></section>` : '';
  const directAnalysis = detail.agentId === 'REL-001' ? '' : `<section class="agent-direct-analysis"><div><span class="growth-kicker">OPENAI · READ ONLY</span><h4>直接调用 ${escapeHtml(detail.name || detail.agentId)}</h4><p>仅输出分析和草稿，不会写 Vault、飞书、日历或外发消息。</p></div><form data-agent-analysis-form="${escapeHtml(detail.agentId)}"><input name="question" value="${escapeHtml(analysis?.agentId === detail.agentId ? analysis.question || '' : '')}" placeholder="输入具体任务，例如：分析本周万嘉商家风险" required><button class="v13-action v13-action-primary" type="submit" ${analysis?.state === 'loading' ? 'disabled' : ''}>${analysis?.state === 'loading' ? '分析中…' : '开始分析'}</button></form>${analysis?.agentId === detail.agentId && analysis.answer ? `<div class="agent-direct-result" data-state="${escapeHtml(analysis.state)}"><strong>${analysis.state === 'answered' ? '分析结果' : '当前状态'}</strong><p>${escapeHtml(analysis.answer)}</p>${analysis.knowledgeState ? `<small>知识依据：${escapeHtml(analysis.knowledgeState === 'matched_approved_excerpt' ? '已匹配你授权的知识摘要' : '未匹配授权摘要，仅作通用分析')}</small>` : ''}</div>` : ''}</section>`;
  return `<aside class="agent-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="agentDetailTitle">
    <header><div><span class="growth-kicker">AGENT IDENTITY</span><h2 id="agentDetailTitle">${escapeHtml(detail.name || detail.agentId)}</h2><code>${escapeHtml(detail.agentId)}</code></div><button data-agent-details-close aria-label="关闭">×</button></header>
    <div class="agent-detail-grid">
      <section><h4>使命与职责</h4><p>${escapeHtml(sections.mission || '待身份卡补充')}</p></section>
      <section><h4>范围内</h4><p>${escapeHtml(sections.scopeIn || sections.allowedActions || '按身份卡与关联 Skill 执行')}</p></section>
      <section><h4>范围外 / 禁止动作</h4><p>${escapeHtml(sections.scopeOut || sections.forbiddenActions || '不自动执行任何外部动作')}</p></section>
      <section><h4>当前状态与 Pilot</h4><p>${escapeHtml(STATUS_LABEL[detail.status] || detail.status)} · 评估 ${detail.evaluations?.length || 0} · 日志 ${detail.logs?.length || 0}</p></section>
      <section><h4>最近变更</h4><p>${escapeHtml(String(detail.updatedAt || detail.mtime || '待更新').replace('T', ' ').slice(0, 16))}<br>${escapeHtml(detail.relativePath || '')}</p></section>
      <section><h4>关联 Skill</h4><div class="agent-detail-chips">${detailsList(detail.skills, 'skillId')}</div></section>
      <section><h4>关联 Workflow</h4><div class="agent-detail-chips">${detailsList(detail.workflows, 'workflowId')}</div></section>
      <section><h4>知识入口</h4><div class="agent-detail-chips">${detail.knowledgeEntries?.length ? detail.knowledgeEntries.slice(0, 12).map((item) => `<span>${escapeHtml(item)}</span>`).join('') : '<span class="agent-detail-empty">执行时按身份卡路径按需读取</span>'}</div></section>
      <section><h4>评估 / 日志 / Runbook</h4><p>${detail.evaluations?.length || 0} 评估 · ${detail.logs?.length || 0} 日志 · ${detail.runbooks?.length || 0} 调用卡</p></section>
    </div>${taskArchivePanel(detail, archives, candidates)}${relation}${directAnalysis}
    <section class="agent-invocation-example"><h4>可复制的调用示例</h4><p>${escapeHtml(invocation)}</p></section>
    <footer><button class="v13-action" data-agent-details-close>关闭</button>${detail.agentId === 'REL-001' ? '' : `<button class="v13-action" data-agent-analyze="${escapeHtml(detail.agentId)}">直接分析</button>`}<button class="v13-action v13-action-primary" data-agent-invoke="${escapeHtml(detail.agentId)}">派任务</button></footer>
  </aside><div class="agent-detail-backdrop" data-agent-details-close></div>`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const summary = viewModel.agentSummary || {};
  const hasIndex = Boolean(viewModel.agentOsIndex);
  const agents = viewModel.agentOsAgents || [];
  const sourceMessage = viewModel.agentOsImportMessage || '工作台只保存身份卡路径、哈希、更新时间与关联关系，不复制 Vault 正文。';
  const knowledge = viewModel.knowledgeContext || { state: 'unknown', count: 0 };
  const knowledgeLabel = knowledge.state === 'ready' ? `已授权 ${Number(knowledge.count) || 0} 条知识摘要` : knowledge.state === 'uploading' ? '知识摘要导入中…' : '未导入知识摘要';
  container.innerHTML = `<section class="agent-hero"><div><span class="growth-kicker">AGENT OS · CONTROLLED INVOCATION</span><h2>Agent OS 管理与调用中心</h2><p>沿用现有 Agent 工作台和任务入口，动态读取 Agent 身份卡。默认只做扫描、索引、展示、分析与草稿；所有写入和外部动作继续等待确认。</p></div><div class="agent-boundary"><span>默认能力</span><strong>只读分析与草稿</strong><small>不修改 Vault · 不写飞书 · 不自动外发</small><button class="v13-action" data-agent-index-import>导入最新只读索引</button><button class="v13-action" data-knowledge-context-import ${knowledge.state === 'uploading' ? 'disabled' : ''}>${escapeHtml(knowledgeLabel)}</button></div></section>
  ${patrolPanel(viewModel)}
  <div class="agent-os-source" data-state="${escapeHtml(viewModel.agentOsImportState || 'idle')}"><span>${escapeHtml(sourceMessage)}</span><small>${hasIndex ? `仅本机保存 · 索引生成：${escapeHtml(String(viewModel.agentOsIndex.generatedAt || '').replace('T', ' ').slice(0, 16))}` : '正式网页受浏览器权限限制，请手动导入本机索引；不会上传云端。'}</small></div>
  <nav class="agent-os-filters" aria-label="Agent 分类">${FILTERS.map(([value, label]) => `<button class="v13-action ${viewModel.agentOsFilter === value ? 'active' : ''}" data-agent-os-filter="${value}">${label}</button>`).join('')}</nav>
  <div class="agent-summary agent-os-summary"><span><b>${Number(viewModel.agentOsOverview?.summary?.total) || 0}</b>动态发现</span><span><b>${Number(summary.total) || 0}</b>历史执行记录</span><span><b>${Number(summary.awaitingApproval) || 0}</b>待审核</span><span><b>${Number(summary.completed) || 0}</b>已完成</span></div>
  <div class="agent-catalog">${hasIndex ? (agents.map(agentCard).join('') || renderState('empty', '该分类暂无 Agent')) : `<div class="agent-os-empty">${renderState('empty', 'Agent OS 索引')}<p>请导入扫描器生成的 JSON 索引；原有执行记录不会丢失。</p><button class="v13-action v13-action-primary" data-agent-index-import>选择索引文件</button></div>`}</div>
  <article class="agent-runs"><header><div><span class="growth-kicker">RUN HISTORY</span><h3>执行记录与审批链</h3></div><small>保留原功能；输入引用与结果摘要均可回查</small></header>${runRows(viewModel.agentRuns || [])}</article>
  ${detailsDrawer(viewModel.agentOsDetails, viewModel.relationReminderDrafts, viewModel.agentAnalysis, viewModel.agentTaskArchives, viewModel.agentContextCandidates)}`;
}
