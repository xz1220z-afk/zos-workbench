export const COMPANY_AGENT_TYPES = Object.freeze(['ceo', 'wanjia', 'huahuo', 'lingli']);

function value(metric) {
  return typeof metric?.value === 'number' && Number.isFinite(metric.value) ? metric.value : null;
}

function deterministicActions(agent, context) {
  const companies = context.companies || {};
  if (agent === 'ceo') {
    const top = (context.todayTop3 || []).map((item) => item.title).filter(Boolean);
    return top.length ? top : ['先完成三家公司数据健康检查，再确定今日经营动作'];
  }
  if (agent === 'wanjia') {
    const active = value(companies.wanjia?.operations?.active);
    const total = value(companies.wanjia?.operations?.total);
    return active !== null && total !== null && active < total
      ? [`核对 ${total - active} 个未动销商家的负责人、下一步和完成时间`]
      : ['核对万嘉商家动销、支付与核销事实是否为最新'];
  }
  if (agent === 'huahuo') {
    const outstanding = value(companies.huahuo?.finance?.outstanding);
    const pending = value(companies.huahuo?.projects?.pendingDelivery);
    const actions = [];
    if (outstanding !== null && outstanding > 0) actions.push(`逐项目核对待回款 ¥${outstanding.toLocaleString('zh-CN')} 的约定日期`);
    if (pending !== null && pending > 0) actions.push(`确认 ${pending} 个待交付项目的负责人和交期`);
    return actions.length ? actions : ['核对花火项目、交付和回款事实是否为最新'];
  }
  const leads = value(companies.lingli?.operations?.leads);
  const students = value(companies.lingli?.operations?.students);
  return leads !== null && students !== null
    ? [`核对 ${leads} 条线索到 ${students} 名在读学员的转化阶段与下一步`]
    : ['完成玲丽招生、学员、实收与课消事实回读'];
}

function sanitizeActions(actions, fallback) {
  const safe = (Array.isArray(actions) ? actions : []).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5);
  return safe.length ? safe : fallback;
}

export async function runCompanyAgent(agent, context = {}, options = {}) {
  if (!COMPANY_AGENT_TYPES.includes(agent)) throw new Error(`unsupported agent: ${agent}`);
  const now = String(options.now || new Date().toISOString());
  const fallback = deterministicActions(agent, context);
  let mode = 'deterministic';
  let summary = `${agent === 'ceo' ? 'CEO' : agent} 经营建议草稿`;
  let actions = fallback;
  if (typeof options.model === 'function') {
    const result = await options.model({ agent, context: structuredClone(context), constraints: { readOnly: true, reviewRequired: true } });
    mode = 'model';
    summary = String(result?.summary || summary).trim();
    actions = sanitizeActions(result?.actions, fallback);
  }
  return {
    id: `agent-draft:${agent}:${now.slice(0, 10)}`,
    kind: 'agent_draft', agent, mode, generatedAt: now,
    summary, actions,
    evidence: {
      company: agent === 'ceo' ? 'all' : agent,
      topActionIds: (context.todayTop3 || []).map((item) => item.id).filter(Boolean).slice(0, 3),
    },
    reviewStatus: 'pending_review',
    sideEffects: [],
  };
}
