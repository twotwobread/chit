import assert from 'node:assert/strict';
import test from 'node:test';

import type { GetTripDetailResponse, TripListItem } from '@i-um/api-contract';

import {
  buildSwitchableTrips,
  buildTripAppBarMembers,
  buildTripTabUnavailableViewModel,
  buildTripTodayStatusLandingViewModel,
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

function detail(overrides: Partial<GetTripDetailResponse['trip']> = {}): GetTripDetailResponse {
  return {
    trip: {
      id: 'trip-a',
      name: '오사카 여행',
      startDate: '2026-07-10',
      endDate: '2026-07-13',
      defaultCurrency: 'JPY',
      createdBy: 'user-a',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
      ...overrides,
    },
    participantSummary: { totalCount: 2, previewNames: ['민수', '지영'], overflowCount: 0 },
    days: [],
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

test('builds upcoming and past Today status landing states from the trip date range', () => {
  const upcoming = buildTripTodayStatusLandingViewModel(
    detail({ startDate: '2026-07-22', endDate: '2026-07-25' }),
    '2026-07-12',
  );

  assert.equal(upcoming?.status, 'upcoming');
  assert.equal(upcoming?.tone, 'amber');
  assert.equal(upcoming?.eyebrow, '다가오는 여행');
  assert.equal(upcoming?.heroLabel, 'D-10');
  assert.equal(upcoming?.title, '오사카 여행까지 10일 남았어요.');
  assert.equal(upcoming?.helper, '여행 전 설레는 마음으로 Day별 일정을 준비해보세요.');
  assert.deepEqual(upcoming?.primaryAction, { label: '일정 준비하기', route: '/trips/trip-a/itinerary' });
  assert.equal(upcoming?.secondaryAction, undefined);

  const past = buildTripTodayStatusLandingViewModel(
    detail({ startDate: '2026-07-01', endDate: '2026-07-05' }),
    '2026-07-12',
  );

  assert.equal(past?.status, 'past');
  assert.equal(past?.tone, 'muted');
  assert.equal(past?.eyebrow, '다녀온 여행');
  assert.equal(past?.heroLabel, '여행 완료');
  assert.equal(past?.title, '오사카 여행은 다녀온 여행입니다.');
  assert.equal(past?.helper, '여행은 끝났지만 지출과 정산을 계속 확인할 수 있어요.');
  assert.deepEqual(past?.primaryAction, { label: '지출·정산 확인하기', route: '/trips/trip-a/settle' });
  assert.deepEqual(past?.secondaryAction, { label: '전체 일정 보기', route: '/trips/trip-a/itinerary' });
});

test('does not build a Today status landing state for an ongoing trip', () => {
  assert.equal(
    buildTripTodayStatusLandingViewModel(detail({ startDate: '2026-07-10', endDate: '2026-07-13' }), '2026-07-12'),
    null,
  );
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
