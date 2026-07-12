import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildItineraryTimelineItems,
  ITINERARY_TAB_ADD_CTA_LABEL,
  ITINERARY_TAB_EMPTY_HELPER,
  ITINERARY_TAB_EMPTY_TITLE,
  ITINERARY_TAB_REORDER_CTA_LABEL,
} from './itinerary-tab';

test('buildItineraryTimelineItems maps selected day rows to timeline presentation items', () => {
  assert.deepEqual(
    buildItineraryTimelineItems({
      status: 'success',
      dayLabel: 'Day 2',
      formattedDate: '2026.07.11',
      items: [
        {
          id: 'item-1',
          version: 1,
          orderLabel: '1',
          isLodging: true,
          statusLabel: '완료',
          placeId: 'place-1',
          placeName: '우메다 공중정원',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Umeda',
          startTime: '09:30',
          endTime: '11:00',
          timeLabel: '09:30–11:00',
        },
        {
          id: 'item-2',
          version: 1,
          orderLabel: '2',
          isLodging: false,
          statusLabel: '건너뜀',
          placeId: 'place-2',
          placeName: '도톤보리',
          placeType: 'food',
          placeTypeLabel: '식당',
          address: '',
          startTime: null,
          endTime: null,
        },
      ],
    }),
    [
      {
        id: 'item-1',
        order: 1,
        type: 'sights',
        name: '우메다 공중정원',
        area: undefined,
        startTime: '09:30',
        endTime: '11:00',
        status: 'done',
        isLodging: true,
        lodgingBadgeLabel: '대표 숙소',
      },
      {
        id: 'item-2',
        order: 2,
        type: 'food',
        name: '도톤보리',
        area: undefined,
        startTime: null,
        endTime: null,
        status: 'skipped',
        isLodging: false,
        lodgingBadgeLabel: null,
      },
    ],
  );
});

test('itinerary tab empty and detail CTA copy is stable', () => {
  assert.equal(ITINERARY_TAB_EMPTY_TITLE, '이 Day에 등록된 일정이 없어요.');
  assert.equal(ITINERARY_TAB_EMPTY_HELPER, '일정 추가에서 장소를 검색하거나 장소 없이 일정을 등록해 주세요.');
  assert.equal(ITINERARY_TAB_ADD_CTA_LABEL, '일정 추가');
  assert.equal(ITINERARY_TAB_REORDER_CTA_LABEL, '순서 변경');
  assert.deepEqual(
    buildItineraryTimelineItems({
      status: 'empty',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      title: 'empty',
      helper: 'helper',
    }),
    [],
  );
});
