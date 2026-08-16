import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMobileAgentDirectory } from '../src/app/mobile-agent-directory.mjs';

test('dynamic agents are grouped by organization and department without exposing REL-001 to companies', () => {
  const directory = buildMobileAgentDirectory([
    { agentId: 'WANJIA-001', category: 'wanjia', organization: '万嘉网络', department: '运营', status: 'active' },
    { agentId: 'WANJIA-002', category: 'wanjia', organization: '万嘉网络', department: '销售', status: 'pilot' },
    { agentId: 'REL-001', category: 'life', organization: '个人中心', department: '私密关系', status: 'draft', confidentiality: 'private' },
  ]);
  assert.deepEqual(directory.map((item) => item.name), ['万嘉网络', '个人中心']);
  assert.deepEqual(directory[0].departments.map((item) => item.name), ['运营', '销售']);
  assert.equal(directory[0].departments.flatMap((item) => item.agents).some((item) => item.agentId === 'REL-001'), false);
  assert.equal(directory[1].departments[0].agents[0].agentId, 'REL-001');
});

test('REL-001 is kept in the private personal branch when index metadata is incorrect', () => {
  const directory = buildMobileAgentDirectory([
    { agentId: 'REL-001', category: 'wanjia', organization: '万嘉网络', department: '运营', confidentiality: 'private' },
  ]);
  assert.deepEqual(directory, [{
    id: '个人中心',
    name: '个人中心',
    open: false,
    departments: [{ id: '个人中心::私密关系', name: '私密关系', open: false, agents: [
      { agentId: 'REL-001', category: 'wanjia', organization: '万嘉网络', department: '运营', confidentiality: 'private', recent: false, abnormal: false, priority: false },
    ] }],
  }]);
});

test('disclosure state marks only the selected organization and uniquely identified department as open', () => {
  const directory = buildMobileAgentDirectory([
    { agentId: 'WANJIA-001', category: 'wanjia', organization: '万嘉网络', department: '运营' },
    { agentId: 'HUAHUO-001', category: 'huahuo', organization: '花火影像', department: '运营' },
  ], {
    expandedOrganizationId: '万嘉网络',
    expandedDepartmentId: '万嘉网络::运营',
  });

  assert.equal(directory[0].open, true);
  assert.equal(directory[0].departments[0].id, '万嘉网络::运营');
  assert.equal(directory[0].departments[0].open, true);
  assert.equal(directory[1].departments[0].id, '花火影像::运营');
  assert.equal(directory[1].departments[0].open, false);
});

test('recent and failed-pilot Agents are marked for default mobile priority without hard-coded identities', () => {
  const directory = buildMobileAgentDirectory([
    { agentId: 'RECENT-DYNAMIC', category: 'wanjia', organization: '万嘉网络', department: '运营', status: 'active' },
    { agentId: 'FAILED-DYNAMIC', category: 'huahuo', organization: '花火影像', department: '制作', status: 'pilot', recentPilot: { status: 'failed' } },
    { agentId: 'NORMAL-DYNAMIC', category: 'lingli', organization: '玲丽教育', department: '教务', status: 'active' },
  ], { recentAgentIds: ['RECENT-DYNAMIC'] });
  const agents = directory.flatMap((organization) => organization.departments.flatMap((department) => department.agents));

  assert.equal(agents.find((agent) => agent.agentId === 'RECENT-DYNAMIC').priority, true);
  assert.equal(agents.find((agent) => agent.agentId === 'FAILED-DYNAMIC').abnormal, true);
  assert.equal(agents.find((agent) => agent.agentId === 'FAILED-DYNAMIC').priority, true);
  assert.equal(agents.find((agent) => agent.agentId === 'NORMAL-DYNAMIC').priority, false);
});

test('a prioritized REL-001 opens only its private personal branch', () => {
  const directory = buildMobileAgentDirectory([
    { agentId: 'REL-001', category: 'wanjia', organization: '万嘉网络', department: '运营', confidentiality: 'private' },
  ], { recentAgentIds: ['REL-001'] });

  assert.equal(directory.length, 1);
  assert.equal(directory[0].name, '个人中心');
  assert.equal(directory[0].open, true);
  assert.equal(directory[0].departments.length, 1);
  assert.equal(directory[0].departments[0].name, '私密关系');
  assert.equal(directory[0].departments[0].open, true);
});
