import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MeetingListItem } from '@i-um/api-contract';

import {
  buildCreateTripMeetingContextPayload,
  createTripMeetingContextSummary,
  defaultCreateTripMeetingContext,
  validateCreateTripMeetingContext,
  type CreateTripMeetingContextSelection,
} from './create-trip-context';

const savedMeeting: MeetingListItem = {
  id: 'meeting-1',
  name: '등산 모임',
  visibility: 'saved',
  memberCount: 4,
  myRole: 'member',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

describe('event-first trip creation context helpers', () => {
  it('defaults to one-off so users can create a trip without making a meeting first', () => {
    assert.deepEqual(defaultCreateTripMeetingContext(), { mode: 'one_off' });
    assert.deepEqual(buildCreateTripMeetingContextPayload({ mode: 'one_off' }, '오사카 3박 4일'), {
      mode: 'one_off',
    });
    assert.equal(validateCreateTripMeetingContext({ mode: 'one_off' }, []), null);
    assert.equal(createTripMeetingContextSummary({ mode: 'one_off' }, []), '이번만 함께하기');
  });

  it('builds an existing saved meeting payload and review summary', () => {
    const selection: CreateTripMeetingContextSelection = { mode: 'existing', meetingId: savedMeeting.id };

    assert.deepEqual(buildCreateTripMeetingContextPayload(selection, '오사카 3박 4일'), {
      mode: 'existing',
      meetingId: savedMeeting.id,
    });
    assert.equal(validateCreateTripMeetingContext(selection, [savedMeeting]), null);
    assert.equal(createTripMeetingContextSummary(selection, [savedMeeting]), '등산 모임 · 4명');
  });

  it('builds a new saved meeting payload, defaulting the meeting name to the trip name', () => {
    assert.deepEqual(buildCreateTripMeetingContextPayload({ mode: 'new_saved', meetingName: '' }, '오사카 3박 4일'), {
      mode: 'new_saved',
      meetingName: '오사카 3박 4일',
    });
    assert.deepEqual(
      buildCreateTripMeetingContextPayload({ mode: 'new_saved', meetingName: '여름 정산 모임' }, '오사카 3박 4일'),
      {
        mode: 'new_saved',
        meetingName: '여름 정산 모임',
      },
    );
    assert.equal(validateCreateTripMeetingContext({ mode: 'new_saved', meetingName: '' }, []), null);
    assert.equal(createTripMeetingContextSummary({ mode: 'new_saved', meetingName: '' }, []), '새 모임으로 저장');
  });

  it('rejects unknown existing meetings before submit', () => {
    assert.equal(
      validateCreateTripMeetingContext({ mode: 'existing', meetingId: 'missing' }, [savedMeeting]),
      '선택한 모임을 다시 확인해주세요.',
    );
  });
});
