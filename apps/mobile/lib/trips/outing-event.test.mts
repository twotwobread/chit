import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Event, GetEventResponse, Meeting, MeetingMember } from '@i-um/api-contract';

import {
  buildCreateOutingEventRequest,
  buildOutingDetailViewModel,
  outingCategoryOptions,
  outingCategoryLabel,
  validateOutingEventForm,
} from './outing-event';

describe('outing event helpers', () => {
  it('builds a same-day outing event payload with metadata and selected participants', () => {
    assert.deepEqual(
      buildCreateOutingEventRequest({
        title: '성수 저녁',
        date: '2026-09-01',
        startTime: '19:30',
        category: 'meal',
        placeName: '성수 식당',
        placeAddress: '서울 성동구',
        meetingContext: { mode: 'existing', meetingId: 'meeting-id' },
        participantMemberIds: ['member-owner', 'member-a'],
      }),
      {
        title: '성수 저녁',
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        eventType: 'outing',
        defaultCurrency: 'KRW',
        startTime: '19:30',
        category: 'meal',
        placeName: '성수 식당',
        placeAddress: '서울 성동구',
        meeting: { mode: 'existing', meetingId: 'meeting-id' },
        participantMemberIds: ['member-owner', 'member-a'],
      },
    );
  });

  it('validates title date time and current-user participant selection', () => {
    assert.equal(validateOutingEventForm(validForm(), members, 'user-owner'), null);
    assert.equal(
      validateOutingEventForm({ ...validForm(), title: ' ' }, members, 'user-owner'),
      '약속 이름을 입력해주세요.',
    );
    assert.equal(
      validateOutingEventForm({ ...validForm(), date: '2026-99-99' }, members, 'user-owner'),
      '날짜를 YYYY-MM-DD 형식으로 입력해주세요.',
    );
    assert.equal(
      validateOutingEventForm({ ...validForm(), startTime: '25:00' }, members, 'user-owner'),
      '시간을 HH:mm 형식으로 입력해주세요.',
    );
    assert.equal(
      validateOutingEventForm({ ...validForm(), participantMemberIds: ['member-a'] }, members, 'user-owner'),
      '내가 참여자로 포함되어야 약속을 만들 수 있어요.',
    );
  });

  it('labels category presets and builds detail rows without trip-only copy', () => {
    assert.deepEqual(
      outingCategoryOptions().map((option) => [option.value, option.label]),
      [
        ['date', '데이트'],
        ['friends', '친구'],
        ['meal', '식사'],
        ['cafe', '카페'],
        ['activity', '활동'],
        ['custom', '직접 입력'],
      ],
    );
    assert.equal(outingCategoryLabel('meal'), '식사');

    const viewModel = buildOutingDetailViewModel(getEventResponse());
    assert.equal(viewModel.title, '성수 저녁');
    assert.equal(viewModel.dateTimeLabel, '2026.09.01 19:30');
    assert.equal(viewModel.categoryLabel, '식사');
    assert.deepEqual(viewModel.detailRows, [
      ['모임', '성수 모임'],
      ['장소', '성수 식당 · 서울 성동구'],
      ['참여자', '민수'],
    ]);
  });
});

const members: MeetingMember[] = [
  {
    id: 'member-owner',
    meetingId: 'meeting-id',
    userId: 'user-owner',
    role: 'owner',
    displayName: '민수',
    joinedAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'member-a',
    meetingId: 'meeting-id',
    userId: 'user-a',
    role: 'member',
    displayName: '지은',
    joinedAt: '2026-08-02T00:00:00Z',
  },
];

function validForm() {
  return {
    title: '성수 저녁',
    date: '2026-09-01',
    startTime: '19:30',
    category: 'meal' as const,
    placeName: '성수 식당',
    placeAddress: '서울 성동구',
    meetingContext: { mode: 'existing' as const, meetingId: 'meeting-id' },
    participantMemberIds: ['member-owner', 'member-a'],
  };
}

function getEventResponse(): GetEventResponse {
  return {
    meeting: meeting(),
    event: event(),
    participants: [
      {
        id: 'participant-owner',
        eventId: 'event-id',
        meetingMemberId: 'member-owner',
        userId: 'user-owner',
        role: 'owner',
        displayName: '민수',
        joinedAt: '2026-09-01T00:00:00Z',
      },
    ],
  };
}

function meeting(): Meeting {
  return {
    id: 'meeting-id',
    name: '성수 모임',
    visibility: 'saved',
    createdBy: 'user-owner',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };
}

function event(): Event {
  return {
    id: 'event-id',
    meetingId: 'meeting-id',
    meetingName: '성수 모임',
    meetingVisibility: 'saved',
    eventType: 'outing',
    title: '성수 저녁',
    startDate: '2026-09-01',
    endDate: '2026-09-01',
    startTime: '19:30',
    category: 'meal',
    placeName: '성수 식당',
    placeAddress: '서울 성동구',
    defaultCurrency: 'KRW',
    status: 'planned',
    tripId: null,
    createdBy: 'user-owner',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };
}
