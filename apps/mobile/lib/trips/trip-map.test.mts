import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScheduleItem, TripDay } from '@i-um/api-contract';

import {
  buildRouteMapPlaces,
  buildTripMapDayChips,
  resolveMapRouteSheetState,
  resolveTripMapSelectedDay,
} from './trip-map';

function day(overrides: Partial<TripDay>): TripDay {
  return {
    date: '2026-07-10',
    dayOrder: 1,
    id: 'day-1',
    lodgingPlace: null,
    ...overrides,
  };
}

function item(overrides: Partial<ScheduleItem>): ScheduleItem {
  return {
    arrivedAt: null,
    id: 'item-1',
    isLodging: false,
    itemOrder: 1,
    place: {
      address: 'Umeda',
      id: 'place-1',
      name: '우메다',
      placeType: 'sights',
      routablePlace: null,
    },
    skippedAt: null,
    version: 1,
    ...overrides,
  };
}

test('builds ordered day chips from trip days', () => {
  assert.deepEqual(
    buildTripMapDayChips([
      day({ id: 'day-2', dayOrder: 2, date: '2026-07-11' }),
      day({ id: 'day-1', dayOrder: 1, date: '2026-07-10' }),
    ]),
    [
      { id: 'day-1', label: 'Day 1', dateLabel: '2026.07.10' },
      { id: 'day-2', label: 'Day 2', dateLabel: '2026.07.11' },
    ],
  );
});

test('resolves selected map day from preferred id, current calendar day, then first day', () => {
  const days = [
    day({ id: 'day-1', dayOrder: 1, date: '2026-07-10' }),
    day({ id: 'day-2', dayOrder: 2, date: '2026-07-11' }),
  ];

  assert.equal(resolveTripMapSelectedDay({ days, preferredDayId: 'day-2', today: '2026-07-10' })?.id, 'day-2');
  assert.equal(resolveTripMapSelectedDay({ days, preferredDayId: 'missing', today: '2026-07-11' })?.id, 'day-2');
  assert.equal(resolveTripMapSelectedDay({ days, preferredDayId: null, today: '2026-07-12' })?.id, 'day-1');
  assert.equal(resolveTripMapSelectedDay({ days: [], preferredDayId: null, today: '2026-07-12' }), null);
});

test('resolves map route sheet state from vertical gestures', () => {
  assert.equal(resolveMapRouteSheetState('collapsed', -20), 'expanded');
  assert.equal(resolveMapRouteSheetState('expanded', 20), 'collapsed');
  assert.equal(resolveMapRouteSheetState('collapsed', -6), 'collapsed');
  assert.equal(resolveMapRouteSheetState('expanded', 6), 'expanded');
});

test('builds route map places from valid routable items while preserving duplicates and statuses', () => {
  assert.deepEqual(
    buildRouteMapPlaces([
      item({
        arrivedAt: '2026-07-10T00:30:00Z',
        id: 'arrived',
        itemOrder: 1,
        place: {
          address: 'Umeda',
          id: 'place-1',
          name: '우메다',
          placeType: 'sights',
          routablePlace: { provider: 'google', googlePlaceId: 'g-1', latitude: 34.1, longitude: 135.1 },
        },
      }),
      item({
        id: 'missing',
        itemOrder: 2,
        place: { address: 'N/A', id: 'place-2', name: '좌표 없음', placeType: 'etc', routablePlace: null },
      }),
      item({
        id: 'invalid',
        itemOrder: 3,
        place: {
          address: 'Bad',
          id: 'place-3',
          name: '잘못된 좌표',
          placeType: 'etc',
          routablePlace: { provider: 'google', googlePlaceId: 'g-2', latitude: Number.NaN, longitude: 135.2 },
        },
      }),
      item({
        id: 'duplicate',
        itemOrder: 4,
        skippedAt: '2026-07-10T01:30:00Z',
        place: {
          address: 'Umeda again',
          id: 'place-4',
          name: '우메다 재방문',
          placeType: 'food',
          routablePlace: { provider: 'google', googlePlaceId: 'g-3', latitude: 34.1, longitude: 135.1 },
        },
      }),
    ]),
    [
      { id: 'arrived', latitude: 34.1, longitude: 135.1, name: '우메다', order: 1, status: 'done', type: 'sights' },
      {
        id: 'duplicate',
        latitude: 34.1,
        longitude: 135.1,
        name: '우메다 재방문',
        order: 4,
        status: 'skipped',
        type: 'food',
      },
    ],
  );
});
