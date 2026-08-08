import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAgentOsIndex, validateAgentOsIndex } from '../src/agent-os-index.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'agent-os-'));
  for (const name of ['02 Agents', '03 Skills Registry', '04 Workflows', '05 Evaluations', '06 Logs', '07 Runbooks']) {
    await mkdir(join(root, name), { recursive: true });
  }
  await writeFile(join(root, '02 Agents', 'REL-001.md'), `---
agent_id: REL-001
name: 关系关怀 Agent
status: draft
confidentiality: private
category: life
updated: 2026-08-07
---
# 关系关怀 Agent
## Mission
只使用明确提供的必要信息。
## Scope In
- 重要日期
## Scope Out
- 私密聊天全文
## Read Paths
- [[Life OS/关系关怀卡]]
## Output Contract
事实、推断、建议、待确认、下一步。
SECRET BODY MUST NOT BE COPIED
`);
  await writeFile(join(root, '02 Agents', 'notes.md'), '# 不是 Agent\n');
  await writeFile(join(root, '03 Skills Registry', 'SK-REL-001.md'), `---
skill_id: SK-REL-001
name: 亲密关系关怀
status: draft
---
# Skill
**主责 Agent：** REL-001
`);
  await writeFile(join(root, '04 Workflows', 'WF-REL-001.md'), `---
workflow_id: WF-REL-001
name: 关系提醒 Workflow
status: draft
---
# Workflow
REL-001
`);
  await writeFile(join(root, '05 Evaluations', 'EV-REL-001.md'), `---
evaluation_id: EV-REL-001
status: review
---
# REL-001 试运行评分
`);
  await writeFile(join(root, '06 Logs', 'PILOT-REL-001.md'), `---
task_id: PILOT-REL-001
status: review
---
# REL-001 只读试运行
`);
  await writeFile(join(root, '07 Runbooks', 'REL-card.md'), `---
id: RB-REL-001
status: draft
confidentiality: private
---
# REL-001 调用卡
`);
  return root;
}

test('read-only index discovers identity cards and stores metadata without markdown bodies', async () => {
  const root = await fixture();
  const before = await readFile(join(root, '02 Agents', 'REL-001.md'), 'utf8');
  const index = await buildAgentOsIndex(root, { generatedAt: '2026-08-07T09:15:00+08:00' });
  const after = await readFile(join(root, '02 Agents', 'REL-001.md'), 'utf8');

  assert.equal(before, after);
  assert.equal(index.agents.length, 1);
  assert.equal(index.skills.length, 1);
  assert.equal(index.workflows.length, 1);
  assert.equal(index.evaluations.length, 1);
  assert.equal(index.logs.length, 1);
  assert.equal(index.runbooks.length, 1);
  assert.equal(index.agents[0].agentId, 'REL-001');
  assert.equal(index.agents[0].category, 'life');
  assert.match(index.agents[0].hash, /^[a-f0-9]{64}$/);
  assert.ok(index.agents[0].relativePath.startsWith('02 Agents/'));
  assert.deepEqual(index.agents[0].skillIds, ['SK-REL-001']);
  assert.deepEqual(index.agents[0].workflowIds, ['WF-REL-001']);
  assert.equal(JSON.stringify(index).includes('SECRET BODY MUST NOT BE COPIED'), false);
  assert.equal(index.agents[0].sections.mission, '只使用明确提供的必要信息。');
  assert.deepEqual(index.agents[0].knowledgeEntries, ['Life OS/关系关怀卡']);
  assert.equal(validateAgentOsIndex(index).schemaVersion, 'agent-os-index-v1');
});

test('invalid or body-bearing index payloads are rejected', () => {
  assert.throws(() => validateAgentOsIndex({ schemaVersion: 'wrong', agents: [] }), /agent_os_index_invalid/);
  assert.throws(() => validateAgentOsIndex({
    schemaVersion: 'agent-os-index-v1', generatedAt: new Date().toISOString(), sourceRoot: '/tmp',
    agents: [{ agentId: 'A', body: 'forbidden' }], skills: [], workflows: [], evaluations: [], logs: [], runbooks: [],
  }), /agent_os_index_body_forbidden/);
});
