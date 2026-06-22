import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TripDay } from '@i-um/api-contract';

import { buildTripDayViewModels, formatTripDayDate } from './days';

describe('trip day view models', () => {
  it('formats date-only strings without Date timezone conversion', () => {
    assert.equal(formatTripDayDate('2026-07-10'), '2026.07.10');
  });

  it('builds Day labels from dayOrder and keeps returned order', () => {
    const days: TripDay[] = [
      { date: '2026-07-10', dayOrder: 1 },
      { date: '2026-07-11', dayOrder: 2 },
    ];

    assert.deepEqual(buildTripDayViewModels(days), [
      { ...days[0], dayLabel: 'Day 1', formattedDate: '2026.07.10' },
      { ...days[1], dayLabel: 'Day 2', formattedDate: '2026.07.11' },
    ]);
  });
});
