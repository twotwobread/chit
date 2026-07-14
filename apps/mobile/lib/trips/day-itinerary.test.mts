import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { GetDayScheduleItemsResponse } from '@i-um/api-contract';

import {
  buildDayItineraryPlaceAccessibilityLabel,
  buildDayItineraryViewModel,
  dayItineraryFailureState,
  getPlaceTypeLabel,
} from './day-itinerary';

describe('day itinerary helpers', () => {
  it('formats day header and ordered rows from the generated response type', () => {
    const response: GetDayScheduleItemsResponse = {
      day: {
        date: '2026-07-10',
        dayOrder: 1,
        lodgingPlace: { id: 'place-1', name: '우메다 공중정원', placeType: 'sights', address: 'Umeda' },
      },
      items: [
        {
          id: 'item-2',
          itemOrder: 2,
          version: 3,
          isLodging: false,
          startTime: null,
          endTime: null,
          arrivedAt: null,
          skippedAt: null,
          place: { id: 'place-2', name: '도톤보리', placeType: 'food', address: 'Dotonbori' },
        },
        {
          id: 'item-1',
          itemOrder: 1,
          version: 7,
          isLodging: true,
          startTime: '09:30',
          endTime: '11:00',
          arrivedAt: null,
          skippedAt: null,
          place: { id: 'place-1', name: '우메다 공중정원', placeType: 'sights', address: 'Umeda' },
        },
      ],
    };

    assert.deepEqual(buildDayItineraryViewModel(response), {
      status: 'success',
      dayLabel: '1일차',
      formattedDate: '2026.07.10',
      lodgingPlace: { id: 'place-1', name: '우메다 공중정원', placeType: 'sights', address: 'Umeda' },
      items: [
        {
          id: 'item-1',
          version: 7,
          orderLabel: '1',
          isLodging: true,
          startTime: '09:30',
          endTime: '11:00',
          timeLabel: '09:30–11:00',
          placeId: 'place-1',
          placeName: '우메다 공중정원',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Umeda',
        },
        {
          id: 'item-2',
          version: 3,
          orderLabel: '2',
          isLodging: false,
          startTime: null,
          endTime: null,
          timeLabel: undefined,
          placeId: 'place-2',
          placeName: '도톤보리',
          placeType: 'food',
          placeTypeLabel: '식당',
          address: 'Dotonbori',
        },
      ],
    });
  });

  it('uses place schedule title as the primary label while keeping place context', () => {
    const response: GetDayScheduleItemsResponse = {
      day: { date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
      scheduleItems: [
        {
          id: 'item-1',
          itemOrder: 1,
          version: 1,
          itemType: 'place',
          isLodging: false,
          startTime: null,
          endTime: null,
          arrivedAt: null,
          skippedAt: null,
          place: { id: 'place-1', name: '도톤보리', placeType: 'sights', address: 'Osaka' },
          placeSchedule: { title: '야경 산책', memo: '강가 걷기' },
        },
      ],
    };

    const viewModel = buildDayItineraryViewModel(response);
    assert.equal(viewModel.status, 'success');
    if (viewModel.status !== 'success') {
      return;
    }
    assert.equal(viewModel.items[0].placeName, '야경 산책');
    assert.equal(viewModel.items[0].address, 'Osaka');
    assert.equal(viewModel.items[0].placeMemo, '강가 걷기');
    assert.equal(buildDayItineraryPlaceAccessibilityLabel(viewModel.items[0]), '1번째 장소 야경 산책. 관광지');
  });

  it('returns empty state for an in-range day with no items', () => {
    const response: GetDayScheduleItemsResponse = {
      day: { date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
      items: [],
    };

    assert.deepEqual(buildDayItineraryViewModel(response), {
      status: 'empty',
      dayLabel: '1일차',
      formattedDate: '2026.07.10',
      lodgingPlace: null,
      title: '아직 등록된 일정이 없어요.',
      helper: '일정 추가를 눌러 방문할 장소를 등록해보세요.',
    });
  });

  it('builds the existing place row accessibility label from row presentation data', () => {
    assert.equal(
      buildDayItineraryPlaceAccessibilityLabel({
        id: 'item-1',
        version: 7,
        orderLabel: '1',
        isLodging: true,
        startTime: '09:30',
        endTime: '11:00',
        timeLabel: '09:30–11:00',
        placeId: 'place-1',
        placeName: '우메다 공중정원',
        placeType: 'sights',
        placeTypeLabel: '관광지',
        address: 'Umeda',
      }),
      '1번째 장소 09:30–11:00. 우메다 공중정원. 관광지',
    );
  });

  it('maps place type enum values to Korean labels', () => {
    assert.equal(getPlaceTypeLabel('sights'), '관광지');
    assert.equal(getPlaceTypeLabel('food'), '식당');
    assert.equal(getPlaceTypeLabel('lodging'), '숙소');
    assert.equal(getPlaceTypeLabel('cafe'), '카페');
    assert.equal(getPlaceTypeLabel('shopping'), '쇼핑');
    assert.equal(getPlaceTypeLabel('etc'), '기타');
    assert.equal(getPlaceTypeLabel('transport'), '교통');
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
