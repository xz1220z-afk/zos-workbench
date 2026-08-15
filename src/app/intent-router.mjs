const EXTERNAL_ACTION = /写进飞书|写入飞书|发给|发送|发布|付款|转账|预约|预订|签署|合同|改价|修改价格|删除|归档|批量移动|改名|权限|凭证|自动化|外部日历/iu;
const LOCAL_DRAFT = /保存为?(?:任务|提醒|收集箱)?草案|新建(?:任务|提醒|收集箱)草案|转为待办草案/iu;
const KNOWLEDGE = /以前|知识库|Enterprise Brain|SOP|案例|复盘|方法|历史决策/iu;
const CALENDAR = /日程|日历|安排|空闲时间|几点有空/iu;
const INTELLIGENCE = /情报|资讯|行业最新|热点|新闻/iu;
const AGENT = /Agent|智能体|代理/iu;
const WANJIA = /万嘉|商家|GMV|核销|退款|团购|林客/iu;
const HUAHUO = /花火|影像|拍摄|后期|交付/iu;
const LINGLI = /玲丽|招生|学员|教育|课程/iu;

function inferredScope(value) {
  if (KNOWLEDGE.test(value)) return 'knowledge';
  if (WANJIA.test(value)) return 'wanjia';
  if (HUAHUO.test(value)) return 'huahuo';
  if (LINGLI.test(value)) return 'lingli';
  if (CALENDAR.test(value)) return 'life';
  if (INTELLIGENCE.test(value)) return 'intelligence';
  return 'auto';
}

export function routeIntent(text, options = {}) {
  const value = String(text || '').trim();
  const scope = options.scope && options.scope !== 'auto' ? options.scope : inferredScope(value);
  const riskLevel = EXTERNAL_ACTION.test(value) ? 'L2' : LOCAL_DRAFT.test(value) ? 'L1' : 'L0';
  const agentTask = Boolean(options.agentId) || AGENT.test(value);
  const knowledge = !agentTask && KNOWLEDGE.test(value);
  const calendar = !agentTask && !knowledge && CALENDAR.test(value);
  const intelligence = !agentTask && !knowledge && !calendar && INTELLIGENCE.test(value);
  const business = !agentTask && !knowledge && !calendar && !intelligence
    && (WANJIA.test(value) || HUAHUO.test(value) || LINGLI.test(value));
  const intent = agentTask ? 'agent_task'
    : knowledge ? 'knowledge_lookup'
      : calendar ? 'calendar_query'
        : intelligence ? 'intelligence_query'
          : business ? 'business_query' : 'general_assistant';
  const sourcePlan = agentTask ? ['agent_os']
    : knowledge ? ['enterprise_brain_index']
      : calendar ? ['private_calendar']
        : intelligence ? ['intelligence_center']
          : scope === 'wanjia' ? ['wanjia_business']
            : scope === 'huahuo' ? ['huahuo_business']
              : scope === 'lingli' ? ['lingli_business'] : ['workspace_context'];
  return {
    intent,
    scope,
    sourcePlan,
    agentId: options.agentId || null,
    riskLevel,
    requestedAction: riskLevel === 'L2' ? 'external_write' : riskLevel === 'L1' ? 'save_draft' : 'read_analysis',
  };
}
