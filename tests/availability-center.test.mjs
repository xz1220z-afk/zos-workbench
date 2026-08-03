import test from 'node:test';
import assert from 'node:assert/strict';

import { queryAvailability } from '../src/app/availability-center.mjs';

test('availability reports assignments conflicts and evidence gaps without claiming free', () => {
  const result = queryAvailability([
    {
      id: 'p1', projectName: '婚礼 A', shootingDate: '2026-08-08',
      startAt: '2026-08-08T09:00:00+08:00', endAt: '2026-08-08T12:00:00+08:00',
      members: ['阿杰'], roles: ['摄影'], location: '阳西酒店',
    },
    {
      id: 'p2', projectName: '活动 B', shootingDate: '2026-08-08',
      startAt: '2026-08-08T11:00:00+08:00', endAt: '2026-08-08T14:00:00+08:00',
      members: ['阿杰'], roles: ['摄影'], location: '阳江会展中心',
    },
    { id: 'p3', projectName: '写真 C', shootingDate: '2026-08-08', members: [] },
  ], { date: '2026-08-08' });

  assert.equal(result.conflicts[0].person, '阿杰');
  assert.deepEqual(result.unassigned.map((item) => item.id), ['p3']);
  assert.equal(result.availabilityState, 'insufficient_roster_evidence');
  assert.ok(result.gaps.some((gap) => gap.projectId === 'p3' && gap.fields.includes('members')));
});

test('availability supports a date range and does not expose private event titles', () => {
  const result = queryAvailability([
    {
      id: 'p1', projectName: '交付拍摄', shootingDate: '2026-08-09',
      startAt: '2026-08-09T09:00:00+08:00', endAt: '2026-08-09T11:00:00+08:00',
      members: ['小林'], roles: ['摄像'], location: '摄影棚',
    },
  ], {
    startDate: '2026-08-08', endDate: '2026-08-10',
    busyBlocks: [{ id: 'private-1', startAt: '2026-08-09T10:00:00+08:00', endAt: '2026-08-09T12:00:00+08:00', privacy: 'private', title: '家庭体检' }],
  });

  assert.deepEqual(result.assignments.map((item) => item.projectId), ['p1']);
  assert.equal(JSON.stringify(result).includes('家庭体检'), false);
  assert.equal(result.privateBusyBlocks[0].title, '个人安排');
  assert.equal(result.availabilityState, 'scheduled_no_conflict');
});

test('availability returns explicit no-record evidence instead of claiming the team is free', () => {
  const result = queryAvailability([], { date: '2026-08-08' });
  assert.equal(result.availabilityState, 'no_schedule_evidence');
  assert.deepEqual(result.assignments, []);
});
