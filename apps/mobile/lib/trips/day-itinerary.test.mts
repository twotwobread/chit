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
      dayLabel: 'Day 1',
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
          nonPlace: null,
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
    assert.equal(buildDayItineraryPlaceAccessibilityLabel(viewModel.items[0]), '1번째 장소 야경 산책. 관광지');
  });

  it('formats non-place rows with category and compact transport details', () => {
    const response: GetDayScheduleItemsResponse = {
      day: { date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
      items: [
        {
          id: 'item-transport',
          itemOrder: 1,
          version: 4,
          itemType: 'non_place',
          isLodging: false,
          startTime: '08:00',
          endTime: '09:30',
          arrivedAt: null,
          skippedAt: null,
          place: null,
          nonPlace: {
            category: 'transport',
            title: '공항 이동',
            memo: null,
            link: null,
            transportMode: 'bus',
            referenceNumber: 'BUS-12',
            bookingReference: null,
            originText: '난바',
            destinationText: '간사이공항',
            terminalText: 'T1',
            gateText: '4',
          },
        },
      ],
    };

    const viewModel = buildDayItineraryViewModel(response);

    assert.deepEqual(viewModel, {
      status: 'success',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      lodgingPlace: null,
      items: [
        {
          id: 'item-transport',
          version: 4,
          orderLabel: '1',
          itemType: 'non_place',
          isLodging: false,
          startTime: '08:00',
          endTime: '09:30',
          timeLabel: '08:00–09:30',
          placeName: '공항 이동',
          placeType: 'etc',
          placeTypeLabel: '이동',
          address: '버스 · 난바 → 간사이공항 · BUS-12 · T1 · 4',
          nonPlaceCategory: 'transport',
          nonPlaceCategoryLabel: '이동',
          nonPlaceDetailLabel: '버스 · 난바 → 간사이공항 · BUS-12 · T1 · 4',
          transportMode: 'bus',
          referenceNumber: 'BUS-12',
          originText: '난바',
          destinationText: '간사이공항',
          terminalText: 'T1',
          gateText: '4',
        },
      ],
    });
    if (viewModel.status !== 'success') {
      assert.fail('expected success view model');
    }
    assert.equal(
      buildDayItineraryPlaceAccessibilityLabel(viewModel.items[0]),
      '1번째 일정 08:00–09:30. 공항 이동. 이동',
    );
  });

  it('returns empty state for an in-range day with no items', () => {
    const response: GetDayScheduleItemsResponse = {
      day: { date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
      items: [],
    };

    assert.deepEqual(buildDayItineraryViewModel(response), {
      status: 'empty',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      lodgingPlace: null,
      title: '아직 등록된 일정이 없어요.',
      helper: '일정 추가를 눌러 방문할 장소나 장소 없는 일정을 등록해보세요.',
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
