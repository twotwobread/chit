import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { GetDayItineraryResponse } from '@i-um/api-contract';

import {
  buildDayItineraryRoute,
  buildDayItineraryViewModel,
  dayItineraryFailureState,
  getPlaceTypeLabel,
} from './day-itinerary';

describe('day itinerary helpers', () => {
  it('builds the day itinerary route from trip id and date', () => {
    assert.equal(
      buildDayItineraryRoute('00000000-0000-0000-0000-000000000001', '2026-07-10'),
      '/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10',
    );
  });

  it('formats day header and ordered rows from the generated response type', () => {
    const response: GetDayItineraryResponse = {
      day: { date: '2026-07-10', dayOrder: 1, lodgingPlace: { id: 'place-1', name: '우메다 공중정원', placeType: 'sights', address: 'Umeda' } },
      items: [
        {
          id: 'item-2',
          itemOrder: 2,
          version: 3,
          isLodging: false,
          place: { id: 'place-2', name: '도톤보리', placeType: 'food', address: 'Dotonbori' },
        },
        {
          id: 'item-1',
          itemOrder: 1,
          version: 7,
          isLodging: true,
          place: { id: 'place-1', name: '우메다 공중정원', placeType: 'sights', address: 'Umeda' },
        },
      ],
    };

    assert.deepEqual(buildDayItineraryViewModel(response), {
      status: 'success',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      items: [
        { id: 'item-1', version: 7, orderLabel: '1', isLodging: true, placeId: 'place-1', placeName: '우메다 공중정원', placeType: 'sights', placeTypeLabel: '관광지', address: 'Umeda' },
        { id: 'item-2', version: 3, orderLabel: '2', isLodging: false, placeId: 'place-2', placeName: '도톤보리', placeType: 'food', placeTypeLabel: '식당', address: 'Dotonbori' },
      ],
    });
  });

  it('returns empty state for an in-range day with no items', () => {
    const response: GetDayItineraryResponse = {
      day: { date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
      items: [],
    };

    assert.deepEqual(buildDayItineraryViewModel(response), {
      status: 'empty',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      title: '아직 등록된 장소가 없어요.',
      helper: '장소 추가를 눌러 첫 장소를 등록해보세요.',
    });
  });

  it('maps place type enum values to Korean labels', () => {
    assert.equal(getPlaceTypeLabel('sights'), '관광지');
    assert.equal(getPlaceTypeLabel('food'), '식당');
    assert.equal(getPlaceTypeLabel('lodging'), '숙소');
    assert.equal(getPlaceTypeLabel('cafe'), '카페');
    assert.equal(getPlaceTypeLabel('shopping'), '쇼핑');
    assert.equal(getPlaceTypeLabel('etc'), '기타');
  });

  it('maps HTTP failures to not-found or retryable states', () => {
    assert.deepEqual(dayItineraryFailureState(403), {
      status: 'notFound',
      title: '일정을 찾을 수 없어요.',
      helper: '삭제되었거나 접근할 수 없는 여행 일정이에요.',
    });
    assert.deepEqual(dayItineraryFailureState(404), {
      status: 'notFound',
      title: '일정을 찾을 수 없어요.',
      helper: '삭제되었거나 접근할 수 없는 여행 일정이에요.',
    });
    assert.deepEqual(dayItineraryFailureState(500), {
      status: 'retryableError',
      title: '일정을 불러올 수 없어요.',
      helper: '잠시 후 다시 시도해주세요.',
    });
    assert.deepEqual(dayItineraryFailureState(), {
      status: 'retryableError',
      title: '일정을 불러올 수 없어요.',
      helper: '잠시 후 다시 시도해주세요.',
    });
  });
});
