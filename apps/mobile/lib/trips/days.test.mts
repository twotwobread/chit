import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TripDay } from '@i-um/api-contract';

import { buildTripDayViewModels, formatTripDayDate, formatTripDayLabel } from './days';

describe('trip day view models', () => {
  it('formats date-only strings without Date timezone conversion', () => {
    assert.equal(formatTripDayDate('2026-07-10'), '2026.07.10');
  });

  it('builds Korean day labels from dayOrder and keeps returned order', () => {
    assert.equal(formatTripDayLabel(1), '1일차');

    const days: TripDay[] = [
      { date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
      {
        date: '2026-07-11',
        dayOrder: 2,
        lodgingPlace: { id: 'place-1', name: '호텔 니코 오사카', placeType: 'lodging', address: 'Nishi-Shinsaibashi' },
      },
    ];

    assert.deepEqual(buildTripDayViewModels(days), [
      { ...days[0], dayLabel: '1일차', formattedDate: '2026.07.10', lodgingSummary: null },
      {
        ...days[1],
        dayLabel: '2일차',
        formattedDate: '2026.07.11',
        lodgingSummary: { label: '숙소', placeName: '호텔 니코 오사카', address: 'Nishi-Shinsaibashi' },
      },
    ]);
  });
});
