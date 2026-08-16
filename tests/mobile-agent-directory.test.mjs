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
    departments: [{ name: '私密关系', agents: [
      { agentId: 'REL-001', category: 'wanjia', organization: '万嘉网络', department: '运营', confidentiality: 'private', recent: false },
    ] }],
  }]);
});
