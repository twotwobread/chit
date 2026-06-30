import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildItineraryTimelineItems,
  ITINERARY_TAB_DETAIL_CTA_LABEL,
  ITINERARY_TAB_EMPTY_HELPER,
  ITINERARY_TAB_EMPTY_TITLE,
} from './itinerary-tab';

test('buildItineraryTimelineItems maps selected day rows to order-only timeline items', () => {
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
        area: 'Umeda',
        startTime: '09:30',
        endTime: '11:00',
        status: 'todo',
        isLodging: true,
      },
      {
        id: 'item-2',
        order: 2,
        type: 'food',
        name: '도톤보리',
        area: '식당',
        startTime: null,
        endTime: null,
        status: 'todo',
        isLodging: false,
      },
    ],
  );
});

test('itinerary tab empty and detail CTA copy is stable', () => {
  assert.equal(ITINERARY_TAB_EMPTY_TITLE, '이 Day에 등록된 일정이 없어요.');
  assert.equal(ITINERARY_TAB_EMPTY_HELPER, '장소를 추가하려면 일정 자세히 보기로 이동해 주세요.');
  assert.equal(ITINERARY_TAB_DETAIL_CTA_LABEL, '일정 자세히 보기');
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
