import { AGENT_CATALOG } from '../agent-workbench.mjs?v=2.1.0';
import { escapeHtml, renderState } from './view-utils.mjs?v=2.1.0';

const COMPANY = { all: '总控', wanjia: '万嘉', huahuo: '花火', lingli: '玲丽', personal: '个人' };

function agentCard(agent) {
  return `<article class="agent-card"><div class="agent-orb">${escapeHtml(agent.name.slice(0, 1))}</div><div><span>${escapeHtml(COMPANY[agent.company] || agent.company)}</span><h3>${escapeHtml(agent.name)}</h3><p>${escapeHtml(agent.output)}</p></div><button data-agent-run="${escapeHtml(agent.id)}">新建任务</button></article>`;
}

function runRows(runs) {
  if (!runs.length) return renderState('empty', 'Agent 执行记录');
  const visible = runs.slice().reverse().slice(0, 30);
  const remainder = runs.length - visible.length;
  return `${visible.map((run) => `<div class="agent-run-row"><div><strong>${escapeHtml(run.objective)}</strong><small>${escapeHtml(run.agentId)} · ${escapeHtml(run.status)}</small></div><div>${run.status === 'draft' ? `<button data-agent-submit="${escapeHtml(run.id)}">提交审核</button>` : ''}${run.status === 'awaiting_approval' ? `<button data-agent-approve="${escapeHtml(run.id)}">审核通过</button>` : ''}<button data-agent-run-delete="${escapeHtml(run.id)}">删除</button></div></div>`).join('')}${remainder > 0 ? `<p class="growth-list-more">还有 ${remainder} 条，已按最新执行时间优先展示</p>` : ''}`;
}

export function render(container, viewModel = {}) {
  if (!container) return;
  const summary = viewModel.agentSummary || {};
  container.innerHTML = `<section class="agent-hero"><div><span class="growth-kicker">CONTROLLED AGENTS</span><h2>Agent 工作台</h2><p>每个 Agent 都有明确输入、工具、产出和审批边界。正式发布、消息发送、ERP 写入和删除均需确认。</p></div><div class="agent-boundary"><span>默认能力</span><strong>分析与草稿</strong><small>所有外部动作进入待我决策</small></div></section>
  <div class="agent-summary"><span><b>${Number(summary.total) || 0}</b>执行记录</span><span><b>${Number(summary.awaitingApproval) || 0}</b>待审核</span><span><b>${Number(summary.completed) || 0}</b>已完成</span><span><b>${Number(summary.failed) || 0}</b>失败</span></div>
  <div class="agent-catalog">${AGENT_CATALOG.map(agentCard).join('')}</div>
  <article class="agent-runs"><header><div><span class="growth-kicker">RUN HISTORY</span><h3>执行记录与审批链</h3></div><small>输入引用与结果摘要均可回查</small></header>${runRows(viewModel.agentRuns || [])}</article>`;
}
