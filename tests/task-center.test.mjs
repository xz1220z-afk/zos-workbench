import test from 'node:test';
import assert from 'node:assert/strict';

import {
  groupAgenda,
  normalizeTask,
  taskCompletion,
  toggleSubtask,
} from '../src/app/task-center.mjs';

test('normalizeTask preserves legacy dueDate and applies rich defaults', () => {
  const task = normalizeTask({
    id: 't1',
    title: '  确认方案  ',
    dueDate: '2026-08-03',
    tags: ['万嘉', ' 万嘉 ', '', '重要'],
    priority: 9,
  });

  assert.equal(task.title, '确认方案');
  assert.equal(task.dueAt, '2026-08-03T23:59:59.999+08:00');
  assert.deepEqual(task.tags, ['万嘉', '重要']);
  assert.equal(task.priority, 0);
  assert.equal(task.company, 'ceo');
  assert.equal(task.status, 'todo');
  assert.deepEqual(task.subtasks, []);
});

test('normalizeTask keeps supported rich fields and rejects blank titles', () => {
  const task = normalizeTask({
    title: '花火档期确认', description: '确认人员和地点', priority: 3,
    company: 'huahuo', projectId: 'project-1', businessEntityId: 'booking-1',
    assigneeIds: ['p1', 'p1', 'p2'], estimateMinutes: 45,
    reminderAt: '2026-08-03T08:30:00+08:00', recurrence: 'weekly',
  });

  assert.equal(task.company, 'huahuo');
  assert.deepEqual(task.assigneeIds, ['p1', 'p2']);
  assert.equal(task.estimateMinutes, 45);
  assert.equal(task.recurrence, 'weekly');
  assert.throws(() => normalizeTask({ title: '  ' }), /title is required/);
});

test('subtask completion and toggling are deterministic', () => {
  const task = normalizeTask({
    id: 't1', title: '交付',
    subtasks: [
      { id: 's1', title: '剪辑', completed: true },
      { id: 's2', title: '审片', completed: false },
    ],
  });

  assert.deepEqual(taskCompletion(task), { completed: 1, total: 2, percent: 50 });
  const next = toggleSubtask(task, 's2');
  assert.equal(next.subtasks[1].completed, true);
  assert.deepEqual(taskCompletion(next), { completed: 2, total: 2, percent: 100 });
  assert.throws(() => toggleSubtask(task, 'missing'), /subtask not found/);
});

test('agenda separates timed, all-day, overdue and unscheduled tasks', () => {
  const groups = groupAgenda([
    { id: 'a', title: '会议', startAt: '2026-08-03T10:00:00+08:00' },
    { id: 'b', title: '全天', dueDate: '2026-08-03', allDay: true },
    { id: 'c', title: '以后安排' },
    { id: 'd', title: '下午拜访', startAt: '2026-08-03T15:00:00+08:00' },
    { id: 'e', title: '晚上复盘', startAt: '2026-08-03T20:00:00+08:00' },
    { id: 'f', title: '已逾期', dueAt: '2026-08-02T12:00:00+08:00' },
    { id: 'g', title: '已完成逾期项', dueAt: '2026-08-02T12:00:00+08:00', status: 'done' },
  ], { date: '2026-08-03', timeZone: 'Asia/Shanghai' });

  assert.deepEqual(groups.morning.map((item) => item.id), ['a']);
  assert.deepEqual(groups.afternoon.map((item) => item.id), ['d']);
  assert.deepEqual(groups.evening.map((item) => item.id), ['e']);
  assert.deepEqual(groups.allDay.map((item) => item.id), ['b']);
  assert.deepEqual(groups.overdue.map((item) => item.id), ['f']);
  assert.deepEqual(groups.unscheduled.map((item) => item.id), ['c']);
});
