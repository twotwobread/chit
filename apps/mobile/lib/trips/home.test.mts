import assert from 'node:assert/strict';
import test from 'node:test';

import type { GetMySettlementSummaryResponse, MeetingListItem, TripListItem } from '@i-um/api-contract';

import {
  buildHomeRootRefreshFailureViewModel,
  buildHomeRootRefreshStartViewModel,
  buildHomeRootViewModel,
  buildHomeViewModel,
} from './home.ts';

function trip(overrides: Partial<TripListItem>): TripListItem {
  return {
    id: 'trip-a',
    name: '테스트 여행',
    startDate: '2026-06-20',
    endDate: '2026-06-22',
    defaultCurrency: 'KRW',
    defaultTravelMode: 'transit',
    createdAt: '2026-06-01T00:00:00Z',
    joinedAt: '2026-06-01T00:00:00Z',
    myRole: 'owner',
    participantCount: 1,
    eventContext: {
      eventId: 'event-a',
      meetingId: 'meeting-a',
      meetingName: '테스트 모임',
      meetingVisibility: 'saved',
    },
    ...overrides,
  };
}

function oneOffTrip(overrides: Partial<TripListItem>): TripListItem {
  return trip({
    eventContext: {
      eventId: 'event-one-off',
      meetingId: 'meeting-one-off',
      meetingName: '이번만 오사카',
      meetingVisibility: 'one_off',
    },
    ...overrides,
  });
}

function meeting(overrides: Partial<MeetingListItem>): MeetingListItem {
  return {
    id: 'meeting-a',
    name: '친구 모임',
    visibility: 'saved',
    memberCount: 3,
    myRole: 'owner',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function settlementSummary(overrides: Partial<GetMySettlementSummaryResponse> = {}): GetMySettlementSummaryResponse {
  return {
    trips: [],
    ...overrides,
  };
}

test('ordinary root entry shows schedule-first loading copy without BottomMenu before session is known', () => {
  assert.deepEqual(buildHomeRootViewModel({ status: 'loading' }), {
    status: 'loading',
    surface: 'root',
    title: '일정을 불러오는 중...',
    helper: '다가오는 일정과 모임을 확인하고 있어요.',
    showBottomMenu: false,
  });
});

test('ordinary root entry shows retry-only schedule dashboard error', () => {
  assert.deepEqual(buildHomeRootViewModel({ status: 'homeDashboardError' }), {
    status: 'rootError',
    title: '홈을 불러올 수 없어요.',
    helper: '일정과 모임 정보를 다시 확인해주세요.',
    retryLabel: '다시 시도',
    showBottomMenu: false,
  });
});

test('ordinary root entry renders Home and pins the current schedule instead of redirecting', () => {
  const viewModel = buildHomeRootViewModel({
    status: 'ready',
    today: '2026-06-22',
    trips: [
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25' }),
      trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22' }),
    ],
    meetings: [],
    settlementSummary: settlementSummary(),
  });

  assert.equal(viewModel.status, 'home');
  if (viewModel.status !== 'home') {
    return;
  }
  assert.equal(viewModel.showBottomMenu, true);
  assert.equal(viewModel.home.currentTrip?.id, 'ongoing');
  assert.equal(viewModel.home.currentTrip?.resumePath, '/trips/ongoing/today');
  assert.deepEqual(
    viewModel.home.sections.map((section) => [section.status, section.trips.map((item) => item.id)]),
    [['upcoming', ['upcoming']]],
  );
});

test('Home dashboard keeps one-off schedules visible while hiding one-off containers from my meetings', () => {
  const viewModel = buildHomeViewModel(
    {
      trips: [
        oneOffTrip({ id: 'ongoing-one-off', startDate: '2026-06-20', endDate: '2026-06-22' }),
        trip({ id: 'upcoming-saved', startDate: '2026-06-23', endDate: '2026-06-25' }),
        oneOffTrip({ id: 'past-one-off', startDate: '2026-06-18', endDate: '2026-06-21' }),
      ],
      meetings: [
        meeting({ id: 'saved-meeting', name: '동네 친구들' }),
        meeting({ id: 'hidden-one-off', visibility: 'one_off' }),
      ],
      settlementSummary: settlementSummary(),
    },
    '2026-06-22',
  );

  assert.equal(viewModel.currentTrip?.id, 'ongoing-one-off');
  assert.equal(viewModel.currentTrip?.meetingContextLabel, '이번만 함께하기');
  assert.deepEqual(
    viewModel.sections.map((section) => [
      section.status,
      section.trips.map((item) => [item.id, item.meetingContextLabel]),
    ]),
    [
      ['upcoming', [['upcoming-saved', '테스트 모임']]],
      ['past', [['past-one-off', '이번만 함께하기']]],
    ],
  );
  assert.deepEqual(
    viewModel.savedMeetings.map((item) => [item.id, item.name, item.memberCountLabel, item.roleLabel]),
    [['saved-meeting', '동네 친구들', '멤버 3명', '내가 만든 모임']],
  );
});

test('Home dashboard exposes settlement-needed trips as attention tasks', () => {
  const viewModel = buildHomeViewModel(
    {
      trips: [],
      meetings: [],
      settlementSummary: settlementSummary({
        trips: [
          {
            tripId: 'trip-settle',
            tripName: '후쿠오카 여행',
            startDate: '2026-06-20',
            endDate: '2026-06-22',
            defaultCurrency: 'JPY',
            currencySummaries: [
              { currency: 'JPY', direction: 'send', netMinor: 4200 },
              { currency: 'KRW', direction: 'receive', netMinor: 18000 },
            ],
          },
        ],
      }),
    },
    '2026-06-22',
  );

  assert.equal(viewModel.isEmpty, false);
  assert.deepEqual(viewModel.settlementTasks, [
    {
      tripId: 'trip-settle',
      tripName: '후쿠오카 여행',
      dateRangeLabel: '2026.06.20 ~ 2026.06.22',
      route: '/trips/trip-settle/settle',
      summaryLabels: ['보낼 금액 4,200엔', '받을 금액 18,000원'],
    },
  ]);
});

test('Home empty state is explicit only when there are no schedules settlements or saved meetings', () => {
  const emptyViewModel = buildHomeViewModel(
    { trips: [], meetings: [], settlementSummary: settlementSummary() },
    '2026-06-22',
  );
  assert.equal(emptyViewModel.isEmpty, true);
  assert.equal(emptyViewModel.hasVisibleTrips, false);
  assert.deepEqual(emptyViewModel.sections, []);
  assert.deepEqual(emptyViewModel.savedMeetings, []);
  assert.deepEqual(emptyViewModel.settlementTasks, []);

  const meetingOnlyViewModel = buildHomeViewModel(
    { trips: [], meetings: [meeting({ id: 'saved-meeting' })], settlementSummary: settlementSummary() },
    '2026-06-22',
  );
  assert.equal(meetingOnlyViewModel.isEmpty, false);
});

test('explicit Home loading and error states are Home management states', () => {
  assert.equal(buildHomeRootViewModel({ explicitHomeIntent: true, status: 'loading' }).showBottomMenu, true);

  const errorViewModel = buildHomeRootViewModel({ explicitHomeIntent: true, status: 'homeDashboardError' });
  assert.equal(errorViewModel.status, 'homeError');
  assert.equal(errorViewModel.showBottomMenu, true);
});

test('Home focus refresh keeps the current Home view instead of showing blocking loading', () => {
  const current = buildHomeRootViewModel({
    status: 'ready',
    today: '2026-06-22',
    trips: [trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22' })],
    meetings: [],
    settlementSummary: settlementSummary(),
  });

  const refreshState = buildHomeRootRefreshStartViewModel(current, false);

  assert.equal(refreshState.status, 'home');
  assert.deepEqual(refreshState, current);
});

test('Home focus refresh failure keeps stale Home content when there is already data', () => {
  const current = buildHomeRootViewModel({
    status: 'ready',
    today: '2026-06-22',
    trips: [trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22' })],
    meetings: [],
    settlementSummary: settlementSummary(),
  });

  const failureState = buildHomeRootRefreshFailureViewModel(current, false);

  assert.equal(failureState.status, 'home');
  assert.deepEqual(failureState, current);
});

test('Home focus refresh uses blocking loading and error when there is no stale Home data', () => {
  const current = buildHomeRootViewModel({ status: 'loading' });

  const refreshState = buildHomeRootRefreshStartViewModel(current, false);
  const failureState = buildHomeRootRefreshFailureViewModel(current, false);

  assert.equal(refreshState.status, 'loading');
  assert.equal(failureState.status, 'rootError');
});

test('Home exposes all ongoing trips for the current schedule carousel without duplicating them in sections', () => {
  const viewModel = buildHomeViewModel(
    {
      trips: [
        trip({ id: 'current', startDate: '2026-06-20', endDate: '2026-06-22', participantCount: 2 }),
        trip({ id: 'other-ongoing', startDate: '2026-06-21', endDate: '2026-06-23' }),
        trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25', myRole: 'member' }),
        trip({ id: 'past', startDate: '2026-06-18', endDate: '2026-06-21' }),
      ],
      meetings: [],
      settlementSummary: settlementSummary(),
    },
    '2026-06-22',
  );

  assert.equal(viewModel.currentTrip?.id, 'current');
  assert.deepEqual(
    viewModel.ongoingTrips.map((item) => [item.id, item.resumeLabel, item.resumePath, item.detailPath]),
    [
      ['current', '일정 이어가기', '/trips/current/today', '/trips/current/today'],
      ['other-ongoing', '일정 이어가기', '/trips/other-ongoing/today', '/trips/other-ongoing/today'],
    ],
  );
  assert.equal(viewModel.ongoingTrips[0]?.participantCountLabel, '참여자 2명');
  assert.equal(viewModel.ongoingTrips[0]?.dateRangeLabel, '2026.06.20 ~ 2026.06.22');
  assert.equal(viewModel.ongoingTrips[0]?.currencyLabel, '기본 통화 KRW');
  assert.deepEqual(
    viewModel.sections.map((section) => [section.status, section.trips.map((item) => [item.id, item.detailPath])]),
    [
      ['upcoming', [['upcoming', '/trips/upcoming/today']]],
      ['past', [['past', '/trips/past/today']]],
    ],
  );
});
