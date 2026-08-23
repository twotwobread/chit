import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Event, GetMeetingResponse, GetMySettlementSummaryResponse, MeetingMember } from '@i-um/api-contract';

import { buildMeetingDetailViewModel, meetingMemberRoleLabel } from './meeting-detail';

const owner: MeetingMember = {
  id: 'member-owner',
  meetingId: 'meeting-1',
  userId: 'user-1',
  role: 'owner',
  displayName: '민수',
  joinedAt: '2026-06-01T00:00:00Z',
};

const member: MeetingMember = {
  id: 'member-2',
  meetingId: 'meeting-1',
  userId: 'user-2',
  role: 'member',
  displayName: '지은',
  joinedAt: '2026-06-02T00:00:00Z',
};

function event(overrides: Partial<Event>): Event {
  return {
    id: overrides.id ?? 'event-1',
    meetingId: 'meeting-1',
    meetingName: '등산 모임',
    meetingVisibility: 'saved',
    eventType: 'trip',
    title: overrides.title ?? '오사카 3박 4일',
    startDate: overrides.startDate ?? '2026-07-10',
    endDate: overrides.endDate ?? '2026-07-13',
    defaultCurrency: overrides.defaultCurrency ?? 'JPY',
    status: overrides.status ?? 'planned',
    tripId: overrides.tripId === undefined ? 'trip-1' : overrides.tripId,
    createdBy: 'user-1',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };
}

function response(events: Event[]): GetMeetingResponse {
  return {
    meeting: {
      id: 'meeting-1',
      name: '등산 모임',
      visibility: 'saved',
      createdBy: 'user-1',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-03T00:00:00Z',
    },
    members: [member, owner],
    events,
  };
}

const settlementSummary: GetMySettlementSummaryResponse = {
  trips: [
    {
      tripId: 'trip-1',
      tripName: '오사카 3박 4일',
      startDate: '2026-07-10',
      endDate: '2026-07-13',
      defaultCurrency: 'JPY',
      currencySummaries: [{ currency: 'JPY', direction: 'receive', netMinor: 120000 }],
    },
    {
      tripId: 'trip-outside',
      tripName: '다른 모임 여행',
      startDate: '2026-07-10',
      endDate: '2026-07-13',
      defaultCurrency: 'JPY',
      currencySummaries: [{ currency: 'JPY', direction: 'send', netMinor: 9000 }],
    },
  ],
};

describe('meeting detail view model', () => {
  it('groups current/upcoming and past meeting events using the local date', () => {
    const viewModel = buildMeetingDetailViewModel({
      detail: response([
        event({
          id: 'past',
          title: '후쿠오카 봄 여행',
          startDate: '2026-05-01',
          endDate: '2026-05-03',
          tripId: 'trip-past',
        }),
        event({
          id: 'upcoming',
          title: '오사카 3박 4일',
          startDate: '2026-07-10',
          endDate: '2026-07-13',
          tripId: 'trip-1',
        }),
        event({
          id: 'outing',
          title: '성수 저녁',
          startDate: '2026-07-11',
          endDate: '2026-07-11',
          eventType: 'outing',
          tripId: null,
        }),
      ]),
      settlementSummary,
      today: '2026-07-10',
    });

    assert.equal(viewModel.title, '등산 모임');
    assert.equal(viewModel.memberPreviewLabel, '민수, 지은');
    assert.deepEqual(
      viewModel.upcomingEvents.map((item) => [item.id, item.title, item.route]),
      [
        ['upcoming', '오사카 3박 4일', '/trips/trip-1/today'],
        ['outing', '성수 저녁', '/events/outing'],
      ],
    );
    assert.deepEqual(
      viewModel.pastEvents.map((item) => [item.id, item.title, item.route]),
      [['past', '후쿠오카 봄 여행', '/trips/trip-past/today']],
    );
  });

  it('filters settlement cues to trip-backed events in this meeting', () => {
    const viewModel = buildMeetingDetailViewModel({
      detail: response([event({ id: 'upcoming', tripId: 'trip-1' })]),
      settlementSummary,
      today: '2026-07-01',
    });

    assert.equal(viewModel.settlementTasks.length, 1);
    assert.equal(viewModel.settlementTasks[0].tripId, 'trip-1');
    assert.equal(viewModel.settlementTasks[0].route, '/trips/trip-1/settle');
    assert.deepEqual(viewModel.settlementTasks[0].summaryLabels, ['받을 돈 120,000엔']);
  });

  it('sorts members by role and joined time with Korean role labels', () => {
    const viewModel = buildMeetingDetailViewModel({
      detail: response([]),
      settlementSummary: { trips: [] },
      today: '2026-07-01',
    });

    assert.equal(meetingMemberRoleLabel('owner'), '모임장');
    assert.equal(meetingMemberRoleLabel('member'), '멤버');
    assert.deepEqual(
      viewModel.members.map((item) => [item.displayName, item.roleLabel]),
      [
        ['민수', '모임장'],
        ['지은', '멤버'],
      ],
    );
  });

  it('marks owner invite and member removal permissions without changing event participation', () => {
    const viewModel = buildMeetingDetailViewModel({
      detail: response([]),
      settlementSummary: { trips: [] },
      today: '2026-07-01',
      currentUserId: 'user-1',
    });

    assert.equal(viewModel.canCreateInvite, true);
    assert.equal(viewModel.canLeaveMeeting, false);
    assert.deepEqual(
      viewModel.members.map((item) => [item.displayName, item.canRemove]),
      [
        ['민수', false],
        ['지은', true],
      ],
    );
  });

  it('marks non-owner members as able to leave but not invite or remove others', () => {
    const viewModel = buildMeetingDetailViewModel({
      detail: response([]),
      settlementSummary: { trips: [] },
      today: '2026-07-01',
      currentUserId: 'user-2',
    });

    assert.equal(viewModel.canCreateInvite, false);
    assert.equal(viewModel.canLeaveMeeting, true);
    assert.deepEqual(
      viewModel.members.map((item) => [item.displayName, item.canRemove]),
      [
        ['민수', false],
        ['지은', false],
      ],
    );
  });
});
