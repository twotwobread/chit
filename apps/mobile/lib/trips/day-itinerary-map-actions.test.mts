import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDayItineraryMapRowActions,
  buildGoogleMapsSearchUrl,
  dayItineraryMapActionFailureState,
  dayItineraryMapActionSuccessState,
} from './day-itinerary-map-actions';

describe('day itinerary map action helpers', () => {
  it('builds a Google Maps search URL from place name and address', () => {
    assert.equal(
      buildGoogleMapsSearchUrl('우메다 공중정원', '1 Chome-1-88 Oyodonaka, Kita Ward, Osaka'),
      'https://www.google.com/maps/search/?api=1&query=%EC%9A%B0%EB%A9%94%EB%8B%A4%20%EA%B3%B5%EC%A4%91%EC%A0%95%EC%9B%90%201%20Chome-1-88%20Oyodonaka%2C%20Kita%20Ward%2C%20Osaka',
    );
  });

  it('falls back to a place-name-only map query when address is missing or blank', () => {
    assert.equal(
      buildGoogleMapsSearchUrl('도톤보리', undefined),
      'https://www.google.com/maps/search/?api=1&query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC',
    );
    assert.equal(
      buildGoogleMapsSearchUrl('도톤보리', '   '),
      'https://www.google.com/maps/search/?api=1&query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC',
    );
  });

  it('builds visible direct row actions and disables address copy for blank addresses', () => {
    assert.deepEqual(buildDayItineraryMapRowActions({ placeName: '도톤보리', address: ' Dotonbori ' }), {
      map: {
        label: '지도',
        accessibilityLabel: '도톤보리 지도 열기',
        url: 'https://www.google.com/maps/search/?api=1&query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC%20Dotonbori',
        successFeedback: null,
        failureFeedback: '지도를 열 수 없어요. 잠시 후 다시 시도해주세요.',
      },
      copy: {
        label: '주소 복사',
        accessibilityLabel: '도톤보리 주소 복사',
        address: 'Dotonbori',
        disabled: false,
        disabledHelper: undefined,
        successFeedback: '주소를 복사했어요.',
        failureFeedback: '주소를 복사할 수 없어요. 잠시 후 다시 시도해주세요.',
      },
    });

    assert.deepEqual(buildDayItineraryMapRowActions({ placeName: '도톤보리', address: '   ' }), {
      map: {
        label: '지도',
        accessibilityLabel: '도톤보리 지도 열기',
        url: 'https://www.google.com/maps/search/?api=1&query=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC',
        successFeedback: null,
        failureFeedback: '지도를 열 수 없어요. 잠시 후 다시 시도해주세요.',
      },
      copy: {
        label: '주소 복사',
        accessibilityLabel: '도톤보리 주소 복사',
        address: undefined,
        disabled: true,
        disabledHelper: '주소 정보가 없어요.',
        successFeedback: '주소를 복사했어요.',
        failureFeedback: '주소를 복사할 수 없어요. 잠시 후 다시 시도해주세요.',
      },
    });
  });

  it('maps success and failure feedback without adding map-open success feedback', () => {
    assert.equal(dayItineraryMapActionSuccessState('map'), null);
    assert.deepEqual(dayItineraryMapActionSuccessState('copy'), {
      kind: 'success',
      message: '주소를 복사했어요.',
    });
    assert.deepEqual(dayItineraryMapActionFailureState('map'), {
      kind: 'error',
      message: '지도를 열 수 없어요. 잠시 후 다시 시도해주세요.',
    });
    assert.deepEqual(dayItineraryMapActionFailureState('copy'), {
      kind: 'error',
      message: '주소를 복사할 수 없어요. 잠시 후 다시 시도해주세요.',
    });
  });
});
