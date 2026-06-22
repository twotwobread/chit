import assert from 'node:assert/strict';
import test from 'node:test';

import type { TripListItem } from '@i-um/api-contract';

import { buildMyTripsSuccessViewModel, tripDetailPath } from './mypage.ts';

function trip(overrides: Partial<TripListItem>): TripListItem {
  return {
    id: 'trip-a',
    name: '테스트 여행',
    startDate: '2026-06-20',
    endDate: '2026-06-22',
    defaultCurrency: 'KRW',
    createdAt: '2026-06-01T00:00:00Z',
    joinedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

test('omits the current trip shortcut model when no trip is ongoing', () => {
  const viewModel = buildMyTripsSuccessViewModel(
    [
      trip({ id: 'past', startDate: '2026-06-18', endDate: '2026-06-21' }),
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25' }),
    ],
    '2026-06-22',
  );

  assert.equal(viewModel.currentTrip, null);
  assert.deepEqual(
    viewModel.sections.map((section) => section.title),
    ['예정된 여행', '지난 여행'],
  );
});

test('includes one ongoing trip in both shortcut model and ongoing section', () => {
  const viewModel = buildMyTripsSuccessViewModel(
    [
      trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22' }),
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25' }),
    ],
    '2026-06-22',
  );

  assert.equal(viewModel.currentTrip?.id, 'ongoing');
  assert.deepEqual(viewModel.sections[0], {
    status: 'ongoing',
    title: '진행 중인 여행',
    trips: [trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22' })],
  });
});

test('uses deterministic primary current trip when multiple trips are ongoing', () => {
  const viewModel = buildMyTripsSuccessViewModel(
    [
      trip({ id: 'later-start', startDate: '2026-06-21', endDate: '2026-06-23' }),
      trip({ id: 'earlier-start', startDate: '2026-06-20', endDate: '2026-06-23' }),
      trip({ id: 'earliest-end', startDate: '2026-06-20', endDate: '2026-06-22' }),
    ],
    '2026-06-22',
  );

  assert.equal(viewModel.currentTrip?.id, 'earliest-end');
  assert.deepEqual(
    viewModel.sections[0]?.trips.map((item) => item.id),
    ['earliest-end', 'earlier-start', 'later-start'],
  );
});

test('builds the existing trip detail route for current trip shortcut navigation', () => {
  assert.equal(tripDetailPath('trip_123'), '/trips/trip_123');
});
