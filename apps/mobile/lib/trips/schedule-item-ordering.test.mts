import assert from 'node:assert/strict';
import test from 'node:test';

import { orderScheduleItemsByDisplayTime, resolvePreviousTimedEndTimeDefault } from './schedule-item-ordering';

type TestScheduleItem = {
  id: string;
  itemOrder: number;
  startTime?: string | null;
  endTime?: string | null;
};

function item(overrides: TestScheduleItem): TestScheduleItem {
  return overrides;
}

test('orders timed schedule items by start time while preserving untimed item-order slots', () => {
  const ordered = orderScheduleItemsByDisplayTime([
    item({ id: 'untimed-last', itemOrder: 5, startTime: null }),
    item({ id: 'timed-late', itemOrder: 1, startTime: '18:30' }),
    item({ id: 'timed-early-tie-second', itemOrder: 4, startTime: '09:00' }),
    item({ id: 'untimed-middle', itemOrder: 2, startTime: null }),
    item({ id: 'timed-early-tie-first', itemOrder: 3, startTime: '09:00' }),
  ]);

  assert.deepEqual(
    ordered.map((candidate) => candidate.id),
    ['timed-early-tie-first', 'untimed-middle', 'timed-early-tie-second', 'timed-late', 'untimed-last'],
  );
});

test('treats invalid start times as untimed slots during display ordering', () => {
  const ordered = orderScheduleItemsByDisplayTime([
    item({ id: 'timed-late', itemOrder: 1, startTime: '18:30' }),
    item({ id: 'invalid-middle', itemOrder: 2, startTime: '9:00' }),
    item({ id: 'timed-early', itemOrder: 3, startTime: '09:00' }),
  ]);

  assert.deepEqual(
    ordered.map((candidate) => candidate.id),
    ['timed-early', 'invalid-middle', 'timed-late'],
  );
});

test('resolves previous valid timed end time for an untimed target without overwriting existing target start time', () => {
  const items = [
    item({ id: 'breakfast', itemOrder: 1, startTime: '09:00', endTime: '10:00' }),
    item({ id: 'museum', itemOrder: 2, startTime: '13:00', endTime: null }),
    item({ id: 'dinner', itemOrder: 3, startTime: '18:00', endTime: '19:30' }),
    item({ id: 'untimed-next', itemOrder: 4, startTime: null, endTime: null }),
    item({ id: 'untimed-after', itemOrder: 5, startTime: null, endTime: null }),
  ];

  assert.equal(resolvePreviousTimedEndTimeDefault(items, 'untimed-next'), '19:30');
  assert.equal(resolvePreviousTimedEndTimeDefault(items, 'museum'), null);
  assert.equal(resolvePreviousTimedEndTimeDefault(items), '19:30');
});
