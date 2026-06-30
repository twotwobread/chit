import assert from 'node:assert/strict';
import test from 'node:test';

import type { GetMySettlementSummaryResponse, TripListItem } from '@i-um/api-contract';

import {
  buildMySettlementSummaryViewModel,
  buildMyTripsSuccessViewModel,
  formatTripDateRange,
  participantCountLabel,
  toTripCardViewModel,
  tripDetailPath,
  tripRoleLabel,
} from './mypage.ts';

function settlementSummary(overrides: Partial<GetMySettlementSummaryResponse> = {}): GetMySettlementSummaryResponse {
  return {
    trips: [],
    ...overrides,
  };
}

function trip(overrides: Partial<TripListItem>): TripListItem {
  return {
    id: 'trip-a',
    name: '테스트 여행',
    startDate: '2026-06-20',
    endDate: '2026-06-22',
    defaultCurrency: 'KRW',
    createdAt: '2026-06-01T00:00:00Z',
    joinedAt: '2026-06-01T00:00:00Z',
    myRole: 'owner',
    participantCount: 1,
    ...overrides,
  };
}

test('builds empty MyPage settlement summary state', () => {
  assert.deepEqual(buildMySettlementSummaryViewModel(settlementSummary()), {
    helper: '보내거나 받을 금액이 있는 여행이 없어요.',
    status: 'empty',
    title: '정산할 여행이 없어요.',
  });
});

test('builds populated MyPage settlement summary rows with per-currency labels in API order', () => {
  const viewModel = buildMySettlementSummaryViewModel(
    settlementSummary({
      trips: [
        {
          tripId: 'trip-a',
          tripName: '오사카',
          startDate: '2026-07-10',
          endDate: '2026-07-14',
          defaultCurrency: 'KRW',
          currencySummaries: [
            { currency: 'USD', direction: 'receive', netMinor: 1234 },
            { currency: 'KRW', direction: 'send', netMinor: 18500 },
          ],
        },
      ],
    }),
  );

  assert.equal(viewModel.status, 'ready');
  assert.equal(viewModel.title, '정산 요약');
  assert.equal(viewModel.helper, '보내거나 받을 금액이 있는 여행 1개');
  assert.deepEqual(viewModel.trips, [
    {
      tripId: 'trip-a',
      tripName: '오사카',
      dateRangeLabel: '2026.07.10 ~ 2026.07.14',
      route: '/trips/trip-a/settle',
      currencySummaries: [
        {
          amountLabel: '$12.34',
          currency: 'USD',
          direction: 'receive',
          directionLabel: '받을 금액',
          summaryLabel: '받을 금액 $12.34',
        },
        {
          amountLabel: '18,500원',
          currency: 'KRW',
          direction: 'send',
          directionLabel: '보낼 금액',
          summaryLabel: '보낼 금액 18,500원',
        },
      ],
    },
  ]);
});

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

test('keeps the current trip shortcut without duplicating an ongoing section', () => {
  const viewModel = buildMyTripsSuccessViewModel(
    [
      trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22' }),
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25' }),
    ],
    '2026-06-22',
  );

  assert.equal(viewModel.currentTrip?.id, 'ongoing');
  assert.deepEqual(
    viewModel.sections.map((section) => section.title),
    ['예정된 여행'],
  );
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
    viewModel.sections.flatMap((section) => section.trips.map((item) => item.id)),
    [],
  );
});

test('formats trip labels for reusable card composition', () => {
  assert.equal(tripRoleLabel('owner'), '주최자');
  assert.equal(tripRoleLabel('member'), '동행자');
  assert.equal(participantCountLabel(3), '참여자 3명');
  assert.equal(formatTripDateRange('2026-06-20', '2026-06-22'), '2026.06.20 ~ 2026.06.22');

  const viewModel = toTripCardViewModel(trip({ defaultCurrency: 'JPY', participantCount: 2 }));
  assert.equal(viewModel.dateRangeLabel, '2026.06.20 ~ 2026.06.22');
  assert.equal(viewModel.currencyLabel, '기본 통화 JPY');
  assert.deepEqual(viewModel.metaLabels, ['주최자', '참여자 2명']);
});

test('adds role and participant count labels to cards in every status section', () => {
  const viewModel = buildMyTripsSuccessViewModel(
    [
      trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22', myRole: 'owner', participantCount: 2 }),
      trip({ id: 'upcoming', startDate: '2026-06-23', endDate: '2026-06-25', myRole: 'member', participantCount: 3 }),
      trip({ id: 'past', startDate: '2026-06-18', endDate: '2026-06-21', myRole: 'member', participantCount: 4 }),
    ],
    '2026-06-22',
  );

  assert.deepEqual(
    viewModel.sections.map((section) =>
      section.trips.map((item) => [item.id, item.roleLabel, item.participantCountLabel, item.dateRangeLabel]),
    ),
    [
      [['upcoming', '동행자', '참여자 3명', '2026.06.23 ~ 2026.06.25']],
      [['past', '동행자', '참여자 4명', '2026.06.18 ~ 2026.06.21']],
    ],
  );
  assert.equal(viewModel.currentTrip?.roleLabel, '주최자');
  assert.equal(viewModel.currentTrip?.participantCountLabel, '참여자 2명');
});

test('shows an invited member trip with the existing member role label', () => {
  const viewModel = buildMyTripsSuccessViewModel(
    [
      trip({
        id: 'trip-invited',
        name: '초대받은 여행',
        startDate: '2026-07-10',
        endDate: '2026-07-13',
        myRole: 'member',
        participantCount: 2,
      }),
    ],
    '2026-06-24',
  );

  const invitedTrip = viewModel.sections.flatMap((section) => section.trips).find((item) => item.id === 'trip-invited');

  assert.equal(invitedTrip?.name, '초대받은 여행');
  assert.equal(invitedTrip?.roleLabel, '동행자');
  assert.equal(invitedTrip?.participantCountLabel, '참여자 2명');
  assert.equal(tripDetailPath(invitedTrip?.id ?? ''), '/trips/trip-invited/detail');
});

test('builds the canonical hidden trip detail route for trip management navigation', () => {
  assert.equal(tripDetailPath('trip_123'), '/trips/trip_123/detail');
});
