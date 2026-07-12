import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildDayItineraryDetailPanel } from './day-itinerary-detail-panel';

describe('day itinerary detail panel helpers', () => {
  it('keeps place address and secondary actions in the row-tap panel while excluding delete and lodging actions', () => {
    assert.deepEqual(
      buildDayItineraryDetailPanel({
        id: 'item-1',
        version: 7,
        orderLabel: '1',
        itemType: 'place',
        isLodging: true,
        startTime: '09:30',
        endTime: '11:00',
        timeLabel: '09:30–11:00',
        placeId: 'place-1',
        placeName: '우메다 공중정원',
        placeType: 'sights',
        placeTypeLabel: '관광지',
        address: ' Umeda ',
      }),
      {
        title: '우메다 공중정원',
        categoryLabel: '관광지',
        address: 'Umeda',
        detailLabel: '09:30–11:00',
        actions: {
          copyAddress: {
            label: '주소 복사',
            accessibilityLabel: '우메다 공중정원 주소 복사',
            disabled: false,
            disabledHelper: undefined,
          },
          edit: {
            label: '수정',
            accessibilityLabel: '우메다 공중정원 수정',
          },
          openMap: {
            label: '지도에서 보기',
            accessibilityLabel: '우메다 공중정원 지도에서 보기',
          },
        },
        excludedActions: ['delete', 'lodging'],
      },
    );
  });

  it('builds a non-place detail panel without address copy, map, delete, or lodging actions', () => {
    assert.deepEqual(
      buildDayItineraryDetailPanel({
        id: 'item-transport',
        version: 4,
        orderLabel: '2',
        itemType: 'non_place',
        isLodging: false,
        startTime: null,
        endTime: null,
        placeName: '공항 이동',
        placeType: 'etc',
        placeTypeLabel: '이동',
        address: '버스 · 난바 → 간사이공항',
        nonPlaceCategory: 'transport',
        nonPlaceCategoryLabel: '이동',
        nonPlaceDetailLabel: '버스 · 난바 → 간사이공항',
      }),
      {
        title: '공항 이동',
        categoryLabel: '이동',
        address: undefined,
        detailLabel: '버스 · 난바 → 간사이공항',
        actions: {
          copyAddress: undefined,
          edit: {
            label: '수정',
            accessibilityLabel: '공항 이동 수정',
          },
          openMap: undefined,
        },
        excludedActions: ['delete', 'lodging'],
      },
    );
  });
});
