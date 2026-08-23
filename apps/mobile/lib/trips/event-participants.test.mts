import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MeetingMember, TripParticipantListItem } from '@i-um/api-contract';

import {
  areEventParticipantSelectionsEqual,
  buildDefaultEventParticipantMemberIds,
  buildEventParticipantSelectionRows,
  eventParticipantSelectionSummary,
  selectedMemberIdsFromTripParticipants,
  toggleEventParticipantMemberId,
  validateEventParticipantSelection,
} from './event-participants';

const members: MeetingMember[] = [
  meetingMember({ id: 'member-owner', userId: 'user-owner', displayName: '민수', role: 'owner' }),
  meetingMember({ id: 'member-a', userId: 'user-a', displayName: '지영', role: 'member' }),
  meetingMember({ id: 'member-b', userId: 'user-b', displayName: '지은', role: 'member' }),
];

describe('event participant selection helpers', () => {
  it('defaults all current meeting members as selected event participants', () => {
    assert.deepEqual(buildDefaultEventParticipantMemberIds(members), ['member-owner', 'member-a', 'member-b']);
    assert.equal(eventParticipantSelectionSummary(members, ['member-owner', 'member-b']), '3명 중 2명 선택');
  });

  it('toggles non-owner members while keeping stable selected order', () => {
    assert.deepEqual(toggleEventParticipantMemberId(['member-owner', 'member-a'], 'member-b', members), [
      'member-owner',
      'member-a',
      'member-b',
    ]);
    assert.deepEqual(toggleEventParticipantMemberId(['member-owner', 'member-a', 'member-b'], 'member-a', members), [
      'member-owner',
      'member-b',
    ]);
  });

  it('validates non-empty current meeting member selection with the current user included', () => {
    assert.equal(validateEventParticipantSelection(members, ['member-owner', 'member-a'], 'user-owner'), null);
    assert.equal(
      validateEventParticipantSelection(members, [], 'user-owner'),
      '이번 일정 참여자를 1명 이상 선택해주세요.',
    );
    assert.equal(
      validateEventParticipantSelection(members, ['member-a'], 'user-owner'),
      '내가 참여자로 포함되어야 일정을 만들 수 있어요.',
    );
    assert.equal(
      validateEventParticipantSelection(members, ['member-owner', 'missing'], 'user-owner'),
      '참여자 선택을 다시 확인해주세요.',
    );
  });

  it('builds rows with meeting role copy and selected state', () => {
    assert.deepEqual(buildEventParticipantSelectionRows(members, ['member-owner', 'member-b'], 'user-owner'), [
      {
        memberId: 'member-owner',
        displayName: '민수',
        roleLabel: '모임장',
        selected: true,
        disabled: true,
        isCurrentUser: true,
      },
      {
        memberId: 'member-a',
        displayName: '지영',
        roleLabel: '멤버',
        selected: false,
        disabled: false,
        isCurrentUser: false,
      },
      {
        memberId: 'member-b',
        displayName: '지은',
        roleLabel: '멤버',
        selected: true,
        disabled: false,
        isCurrentUser: false,
      },
    ]);
  });

  it('reconciles current trip participants back to selected meeting member ids by user id', () => {
    const participants: TripParticipantListItem[] = [
      participant({ userId: 'user-owner', participantId: 'participant-owner' }),
      participant({ userId: 'user-b', participantId: 'participant-b' }),
    ];

    assert.deepEqual(selectedMemberIdsFromTripParticipants(members, participants), ['member-owner', 'member-b']);
    assert.equal(areEventParticipantSelectionsEqual(['member-owner', 'member-b'], ['member-b', 'member-owner']), true);
    assert.equal(areEventParticipantSelectionsEqual(['member-owner'], ['member-owner', 'member-b']), false);
  });
});

function meetingMember(overrides: Partial<MeetingMember>): MeetingMember {
  return {
    id: 'member-id',
    meetingId: 'meeting-id',
    userId: 'user-id',
    role: 'member',
    displayName: '참여자',
    joinedAt: '2026-06-21T00:00:00Z',
    ...overrides,
  };
}

function participant(overrides: Partial<TripParticipantListItem>): TripParticipantListItem {
  return {
    participantId: 'participant-id',
    userId: 'user-id',
    role: 'member',
    displayName: '참여자',
    joinedAt: '2026-06-21T00:00:00Z',
    ...overrides,
  };
}
