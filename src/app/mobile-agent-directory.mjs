const CATEGORY_ORG = Object.freeze({
  shared: '共享中台',
  wanjia: '万嘉网络',
  huahuo: '花火影像',
  lingli: '玲丽教育',
  life: '个人中心',
});

function isPrivateRelationshipAgent(agent = {}) {
  return agent.agentId === 'REL-001';
}

function organizationFor(agent = {}) {
  return isPrivateRelationshipAgent(agent)
    ? '个人中心'
    : (agent.organization || CATEGORY_ORG[agent.category] || '未分类');
}

function departmentFor(agent = {}) {
  return isPrivateRelationshipAgent(agent)
    ? '私密关系'
    : (agent.department || agent.sections?.department || '综合');
}

function departmentId(organization, department) {
  return `${organization}::${department}`;
}

const ABNORMAL_STATES = new Set(['failed', 'error', 'blocked']);

function isAbnormalAgent(agent = {}) {
  return agent.abnormal === true
    || ABNORMAL_STATES.has(agent.status)
    || ABNORMAL_STATES.has(agent.runtimeAvailability)
    || ABNORMAL_STATES.has(agent.recentPilot?.status);
}

export function buildMobileAgentDirectory(agents = [], options = {}) {
  const organizations = new Map();
  const recentAgentIds = options.recentAgentIds || [];
  for (const agent of agents) {
    const organization = organizationFor(agent);
    const department = departmentFor(agent);
    if (!organizations.has(organization)) organizations.set(organization, new Map());
    const departments = organizations.get(organization);
    if (!departments.has(department)) departments.set(department, []);
    const recent = recentAgentIds.includes(agent.agentId);
    const abnormal = isAbnormalAgent(agent);
    departments.get(department).push({ ...agent, recent, abnormal, priority: recent || abnormal });
  }
  return [...organizations].map(([name, departments]) => {
    const groupedDepartments = [...departments].map(([departmentName, groupedAgents]) => {
      const id = departmentId(name, departmentName);
      const prioritizedPrivateAgent = groupedAgents.some((agent) => isPrivateRelationshipAgent(agent) && agent.priority);
      return {
        id,
        name: departmentName,
        open: options.expandedDepartmentId === id || prioritizedPrivateAgent,
        agents: groupedAgents,
      };
    });
    return {
      id: name,
      name,
      open: options.expandedOrganizationId === name || groupedDepartments.some((department) => department.open),
      departments: groupedDepartments,
    };
  });
}
