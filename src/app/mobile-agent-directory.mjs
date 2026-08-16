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

export function buildMobileAgentDirectory(agents = [], options = {}) {
  const organizations = new Map();
  const recentAgentIds = options.recentAgentIds || [];
  for (const agent of agents) {
    const organization = organizationFor(agent);
    const department = departmentFor(agent);
    if (!organizations.has(organization)) organizations.set(organization, new Map());
    const departments = organizations.get(organization);
    if (!departments.has(department)) departments.set(department, []);
    departments.get(department).push({ ...agent, recent: recentAgentIds.includes(agent.agentId) });
  }
  return [...organizations].map(([name, departments]) => ({
    id: name,
    name,
    departments: [...departments].map(([departmentName, groupedAgents]) => ({
      name: departmentName,
      agents: groupedAgents,
    })),
  }));
}
