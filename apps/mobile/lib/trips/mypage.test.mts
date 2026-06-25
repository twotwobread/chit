import assert from 'node:assert/strict';
import test from 'node:test';

import type { TripListItem } from '@i-um/api-contract';

import {
  buildMyTripsSuccessViewModel,
  participantCountLabel,
  toTripCardViewModel,
  tripDetailPath,
  tripRoleLabel,
} from './mypage.ts';

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
    trips: [toTripCardViewModel(trip({ id: 'ongoing', startDate: '2026-06-20', endDate: '2026-06-22' }))],
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

test('formats trip role and participant count labels', () => {
  assert.equal(tripRoleLabel('owner'), '주최자');
  assert.equal(tripRoleLabel('member'), '동행자');
  assert.equal(participantCountLabel(3), '참여자 3명');
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
      section.trips.map((item) => [item.id, item.roleLabel, item.participantCountLabel]),
    ),
    [[['ongoing', '주최자', '참여자 2명']], [['upcoming', '동행자', '참여자 3명']], [['past', '동행자', '참여자 4명']]],
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
  assert.equal(tripDetailPath(invitedTrip?.id ?? ''), '/trips/trip-invited');
});

test('builds the existing trip detail route for current trip shortcut navigation', () => {
  assert.equal(tripDetailPath('trip_123'), '/trips/trip_123');
});
