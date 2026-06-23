import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DayItineraryViewModel } from './day-itinerary';
import {
  buildDayItineraryReorderDraft,
  buildReorderDayItineraryItemsRequest,
  moveDayItineraryReorderItem,
} from './reorder-itinerary';

describe('reorder itinerary move batch generation', () => {
  it('builds an ordered move batch from the original order, final order, and item versions', () => {
    const viewModel: DayItineraryViewModel = {
      status: 'success',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      items: [
        { id: 'item-1', version: 3, orderLabel: '1', placeName: '우메다 공중정원', placeType: 'sights', placeTypeLabel: '관광지', address: 'Umeda' },
        { id: 'item-2', version: 5, orderLabel: '2', placeName: '도톤보리', placeType: 'food', placeTypeLabel: '식당', address: 'Dotonbori' },
        { id: 'item-3', version: 8, orderLabel: '3', placeName: '오사카성', placeType: 'sights', placeTypeLabel: '관광지', address: 'Osaka' },
        { id: 'item-4', version: 13, orderLabel: '4', placeName: '난바', placeType: 'shopping', placeTypeLabel: '쇼핑', address: 'Namba' },
      ],
    };

    const draft = buildDayItineraryReorderDraft(viewModel);
    assert.ok(draft);

    const movedOnce = moveDayItineraryReorderItem(draft, 3, 1);
    const finalDraft = moveDayItineraryReorderItem(movedOnce, 3, 0);

    assert.deepEqual(finalDraft.items.map((item) => item.id), ['item-3', 'item-1', 'item-4', 'item-2']);
    assert.deepEqual(buildReorderDayItineraryItemsRequest(finalDraft), {
      moves: [
        {
          itemId: 'item-3',
          beforeItemId: null,
          afterItemId: 'item-1',
          clientVersion: 8,
        },
        {
          itemId: 'item-4',
          beforeItemId: 'item-1',
          afterItemId: 'item-2',
          clientVersion: 13,
        },
      ],
    });
  });
});
