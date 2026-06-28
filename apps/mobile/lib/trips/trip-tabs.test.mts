import assert from 'node:assert/strict';
import test from 'node:test';

import type { GetTripDetailResponse, TripListItem } from '@i-um/api-contract';

import {
  buildSwitchableTrips,
  buildTripAppBarMembers,
  buildTripTabUnavailableViewModel,
  findTripCalendarDay,
  formatTripDateRange,
} from './trip-tabs.ts';

function trip(overrides: Partial<TripListItem> = {}): TripListItem {
  return {
    id: 'trip-a',
    name: '오사카 여행',
    startDate: '2026-07-10',
    endDate: '2026-07-13',
    defaultCurrency: 'JPY',
    joinedAt: '2026-06-01T00:00:00Z',
    createdAt: '2026-06-01T00:00:00Z',
    myRole: 'member',
    participantCount: 2,
    ...overrides,
  };
}

test('builds distinct unavailable state copy with shared itinerary/detail actions', () => {
  assert.deepEqual(buildTripTabUnavailableViewModel('today', 'trip-a'), {
    title: '오늘 일정을 찾을 수 없어요.',
    helper: '이 여행에는 오늘 날짜에 해당하는 Day가 없어요. 전체 일정에서 날짜별 계획을 확인해 주세요.',
    primaryAction: { label: '일정 보기', route: '/trips/trip-a/itinerary' },
    secondaryAction: { label: '여행 정보 보기', route: '/trips/trip-a/detail' },
  });

  assert.equal(buildTripTabUnavailableViewModel('map', 'trip-a').title, '오늘 지도에 표시할 일정이 없어요.');
  assert.equal(buildTripTabUnavailableViewModel('settle', 'trip-a').title, '오늘 정산할 지출을 찾을 수 없어요.');
});

test('resolves only the calendar-today trip day without nearest-day fallback', () => {
  const days = [
    { id: 'day-1', date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
    { id: 'day-2', date: '2026-07-11', dayOrder: 2, lodgingPlace: null },
  ];

  assert.equal(findTripCalendarDay(days, '2026-07-11')?.id, 'day-2');
  assert.equal(findTripCalendarDay(days, '2026-07-12'), null);
});

test('builds app bar members from trip participant preview names', () => {
  const detail = {
    trip: {
      id: 'trip-a',
      name: '오사카 여행',
      startDate: '2026-07-10',
      endDate: '2026-07-13',
      defaultCurrency: 'JPY',
      createdBy: 'user-a',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    },
    participantSummary: { totalCount: 3, previewNames: ['민수', ' ', '지영'], overflowCount: 0 },
    days: [],
  } satisfies GetTripDetailResponse;

  assert.deepEqual(buildTripAppBarMembers(detail), [{ name: '민수' }, { name: '여행자' }, { name: '지영' }]);
  assert.deepEqual(buildTripAppBarMembers(null), []);
});

test('builds switcher rows with formatted date range and current marker', () => {
  assert.deepEqual(
    buildSwitchableTrips([trip(), trip({ id: 'trip-b', name: '도쿄 여행' })], 'trip-b').map((row) => ({
      id: row.id,
      name: row.name,
      dates: row.dates,
      current: row.current,
    })),
    [
      { id: 'trip-a', name: '오사카 여행', dates: '2026.07.10 ~ 2026.07.13', current: false },
      { id: 'trip-b', name: '도쿄 여행', dates: '2026.07.10 ~ 2026.07.13', current: true },
    ],
  );
});

test('formats trip date ranges with dots', () => {
  assert.equal(formatTripDateRange('2026-07-10', '2026-07-13'), '2026.07.10 ~ 2026.07.13');
});
