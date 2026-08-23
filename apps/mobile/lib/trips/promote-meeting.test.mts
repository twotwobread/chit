import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { GetTripDetailResponse } from '@i-um/api-contract';

import {
  buildPromoteMeetingDefaultName,
  buildPromoteMeetingSuccessMessage,
  canShowOneOffMeetingPromotion,
  validatePromoteMeetingName,
} from './promote-meeting';

describe('one-off meeting promotion helpers', () => {
  it('shows promotion only to the owner of one-off trip-backed events', () => {
    assert.equal(canShowOneOffMeetingPromotion(detail({ meetingVisibility: 'one_off' }), 'user-owner'), true);
    assert.equal(canShowOneOffMeetingPromotion(detail({ meetingVisibility: 'one_off' }), 'user-member'), false);
    assert.equal(canShowOneOffMeetingPromotion(detail({ meetingVisibility: 'saved' }), 'user-owner'), false);
    assert.equal(canShowOneOffMeetingPromotion(detail({ eventContext: null }), 'user-owner'), false);
  });

  it('defaults the saved meeting name from the current trip name and validates trimmed input', () => {
    assert.equal(buildPromoteMeetingDefaultName(detail({ tripName: '  성수 저녁  ' })), '성수 저녁');
    assert.equal(validatePromoteMeetingName(' 성수 저녁 모임 '), null);
    assert.equal(validatePromoteMeetingName('   '), '모임 이름을 입력해주세요.');
    assert.equal(validatePromoteMeetingName('가'.repeat(81)), '모임 이름은 80자 이내로 입력해주세요.');
  });

  it('builds kind success copy after promotion', () => {
    assert.equal(buildPromoteMeetingSuccessMessage('성수 저녁 모임'), '성수 저녁 모임을 내 모임에 저장했어요.');
  });
});

function detail({
  eventContext = undefined,
  meetingVisibility = 'one_off',
  tripName = '성수 저녁',
}: {
  eventContext?: GetTripDetailResponse['trip']['eventContext'] | null;
  meetingVisibility?: 'one_off' | 'saved';
  tripName?: string;
} = {}): GetTripDetailResponse {
  const resolvedEventContext =
    eventContext === undefined
      ? {
          eventId: 'event-id',
          meetingId: 'meeting-id',
          meetingName: tripName.trim() || '성수 저녁',
          meetingVisibility,
        }
      : eventContext;

  return {
    trip: {
      id: 'trip-id',
      name: tripName,
      startDate: '2026-06-20',
      endDate: '2026-06-20',
      defaultCurrency: 'KRW',
      defaultTravelMode: 'transit',
      createdBy: 'user-owner',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
      eventContext: resolvedEventContext,
      destinations: [],
    },
    participantSummary: { totalCount: 2, previewNames: ['민수', '지은'], overflowCount: 0 },
    days: [],
  };
}
