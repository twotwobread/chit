import assert from 'node:assert/strict';
import test from 'node:test';

import type { TripListItem } from '@i-um/api-contract';

import { groupTripsByStatus, localDateString, selectCurrentTrip, tripStatus } from './status.ts';

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

function sectionIds(sections: ReturnType<typeof groupTripsByStatus>): Array<[string, string[]]> {
  return sections.map((section) => [section.title, section.trips.map((item) => item.id)]);
}

test('computes status using inclusive start and end date boundaries', () => {
  assert.equal(
    tripStatus(trip({ startDate: '2026-06-22', endDate: '2026-06-24' }), '2026-06-22'),
    'ongoing',
  );
  assert.equal(
    tripStatus(trip({ startDate: '2026-06-20', endDate: '2026-06-22' }), '2026-06-22'),
    'ongoing',
  );
  assert.equal(
    tripStatus(trip({ startDate: '2026-06-23', endDate: '2026-06-25' }), '2026-06-22'),
    'upcoming',
  );
  assert.equal(
    tripStatus(trip({ startDate: '2026-06-18', endDate: '2026-06-21' }), '2026-06-22'),
    'past',
  );
});

test('groups trips in ongoing, upcoming, past order and hides empty sections', () => {
  const sections = groupTripsByStatus(
    [
      trip({ id: 'past', startDate: '2026-06-18', endDate: '2026-06-21' }),
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25' }),
      trip({ id: 'ongoing', startDate: '2026-06-22', endDate: '2026-06-24' }),
    ],
    '2026-06-22',
  );

  assert.deepEqual(sectionIds(sections), [
    ['진행 중인 여행', ['ongoing']],
    ['예정된 여행', ['upcoming']],
    ['지난 여행', ['past']],
  ]);

  assert.deepEqual(sectionIds(groupTripsByStatus([trip({ id: 'only-past', endDate: '2026-06-21' })], '2026-06-22')), [
    ['지난 여행', ['only-past']],
  ]);
});

test('sorts ongoing trips by endDate, startDate, joinedAt, createdAt, and id', () => {
  const sections = groupTripsByStatus(
    [
      trip({ id: 'same-dates-old', startDate: '2026-06-20', endDate: '2026-06-24', joinedAt: '2026-06-20T00:00:00Z' }),
      trip({
        id: 'same-dates-newer-created-b',
        startDate: '2026-06-20',
        endDate: '2026-06-24',
        joinedAt: '2026-06-22T00:00:00Z',
        createdAt: '2026-06-21T00:00:00Z',
      }),
      trip({
        id: 'same-dates-newer-created-a',
        startDate: '2026-06-20',
        endDate: '2026-06-24',
        joinedAt: '2026-06-22T00:00:00Z',
        createdAt: '2026-06-21T00:00:00Z',
      }),
      trip({
        id: 'same-dates-older-created',
        startDate: '2026-06-20',
        endDate: '2026-06-24',
        joinedAt: '2026-06-22T00:00:00Z',
        createdAt: '2026-06-20T00:00:00Z',
      }),
      trip({ id: 'later-start', startDate: '2026-06-21', endDate: '2026-06-23' }),
      trip({ id: 'earlier-start', startDate: '2026-06-20', endDate: '2026-06-23' }),
      trip({ id: 'earliest-end', startDate: '2026-06-20', endDate: '2026-06-22' }),
    ],
    '2026-06-22',
  );

  assert.deepEqual(sections[0]?.trips.map((item) => item.id), [
    'earliest-end',
    'earlier-start',
    'later-start',
    'same-dates-newer-created-b',
    'same-dates-newer-created-a',
    'same-dates-older-created',
    'same-dates-old',
  ]);
});

test('sorts upcoming trips by startDate, endDate, joinedAt, createdAt, and id', () => {
  const sections = groupTripsByStatus(
    [
      trip({ id: 'same-dates-old', startDate: '2026-06-25', endDate: '2026-06-29', joinedAt: '2026-06-20T00:00:00Z' }),
      trip({ id: 'same-dates-new-b', startDate: '2026-06-25', endDate: '2026-06-29', joinedAt: '2026-06-22T00:00:00Z' }),
      trip({ id: 'same-dates-new-a', startDate: '2026-06-25', endDate: '2026-06-29', joinedAt: '2026-06-22T00:00:00Z' }),
      trip({ id: 'later-end', startDate: '2026-06-24', endDate: '2026-06-28' }),
      trip({ id: 'earlier-end', startDate: '2026-06-24', endDate: '2026-06-27' }),
      trip({ id: 'earliest-start', startDate: '2026-06-23', endDate: '2026-06-30' }),
    ],
    '2026-06-22',
  );

  assert.deepEqual(sections[0]?.trips.map((item) => item.id), [
    'earliest-start',
    'earlier-end',
    'later-end',
    'same-dates-new-b',
    'same-dates-new-a',
    'same-dates-old',
  ]);
});

test('sorts past trips by endDate, startDate, joinedAt, createdAt, and id descending', () => {
  const sections = groupTripsByStatus(
    [
      trip({ id: 'same-dates-old', startDate: '2026-06-10', endDate: '2026-06-18', joinedAt: '2026-06-18T00:00:00Z' }),
      trip({ id: 'same-dates-new-b', startDate: '2026-06-10', endDate: '2026-06-18', joinedAt: '2026-06-20T00:00:00Z' }),
      trip({ id: 'same-dates-new-a', startDate: '2026-06-10', endDate: '2026-06-18', joinedAt: '2026-06-20T00:00:00Z' }),
      trip({ id: 'earlier-start', startDate: '2026-06-09', endDate: '2026-06-19' }),
      trip({ id: 'later-start', startDate: '2026-06-10', endDate: '2026-06-19' }),
      trip({ id: 'latest-end', startDate: '2026-06-10', endDate: '2026-06-21' }),
    ],
    '2026-06-22',
  );

  assert.deepEqual(sections[0]?.trips.map((item) => item.id), [
    'latest-end',
    'later-start',
    'earlier-start',
    'same-dates-new-b',
    'same-dates-new-a',
    'same-dates-old',
  ]);
});

test('selects no current trip when no trip is ongoing', () => {
  const currentTrip = selectCurrentTrip(
    [
      trip({ id: 'past', startDate: '2026-06-18', endDate: '2026-06-21' }),
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25' }),
    ],
    '2026-06-22',
  );

  assert.equal(currentTrip, null);
});

test('selects the only ongoing trip including start and end date boundaries', () => {
  assert.equal(
    selectCurrentTrip([trip({ id: 'starts-today', startDate: '2026-06-22', endDate: '2026-06-24' })], '2026-06-22')
      ?.id,
    'starts-today',
  );
  assert.equal(
    selectCurrentTrip([trip({ id: 'ends-today', startDate: '2026-06-20', endDate: '2026-06-22' })], '2026-06-22')
      ?.id,
    'ends-today',
  );
});

test('selects the primary current trip using ongoing trip sort order', () => {
  const currentTrip = selectCurrentTrip(
    [
      trip({ id: 'same-dates-old', startDate: '2026-06-20', endDate: '2026-06-24', joinedAt: '2026-06-20T00:00:00Z' }),
      trip({ id: 'later-start', startDate: '2026-06-21', endDate: '2026-06-23' }),
      trip({ id: 'earlier-start', startDate: '2026-06-20', endDate: '2026-06-23' }),
      trip({ id: 'earliest-end', startDate: '2026-06-20', endDate: '2026-06-22' }),
    ],
    '2026-06-22',
  );

  assert.equal(currentTrip?.id, 'earliest-end');
});

test('formats local dates without UTC conversion', () => {
  assert.equal(localDateString(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
});
