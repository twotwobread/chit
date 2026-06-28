import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { GetDayScheduleItemsResponse } from '@i-um/api-contract';

import type { DayItineraryViewModel } from './day-itinerary';
import {
  DAY_ITINERARY_REORDER_CONFLICT_MESSAGE,
  buildDayItineraryReorderAction,
  buildDayItineraryReorderConflictViewModel,
  buildDayItineraryReorderDraft,
  buildDayItineraryReorderSuccessViewModel,
  buildDayItineraryReorderSubmitState,
  buildReorderScheduleItemsRequest,
  dayItineraryReorderFailureState,
  hasDayItineraryReorderChanges,
  moveDayItineraryReorderItem,
  submitDayItineraryReorder,
} from './reorder-itinerary';

describe('reorder itinerary helpers', () => {
  it('hides the reorder action for empty and single-place states', () => {
    const emptyViewModel: DayItineraryViewModel = {
      status: 'empty',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      title: '아직 등록된 장소가 없어요.',
      helper: '장소 추가를 눌러 첫 장소를 등록해보세요.',
    };
    const singlePlaceViewModel: DayItineraryViewModel = {
      status: 'success',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      items: [
        {
          id: 'item-1',
          version: 1,
          orderLabel: '1',
          placeName: '우메다 공중정원',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Umeda',
        },
      ],
    };

    assert.deepEqual(buildDayItineraryReorderAction(emptyViewModel), { status: 'hidden' });
    assert.deepEqual(buildDayItineraryReorderAction(singlePlaceViewModel), { status: 'hidden' });
    assert.equal(buildDayItineraryReorderDraft(emptyViewModel), null);
    assert.equal(buildDayItineraryReorderDraft(singlePlaceViewModel), null);
  });

  it('enables the reorder action and builds an edit draft for 2+ places', () => {
    const viewModel: DayItineraryViewModel = {
      status: 'success',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      items: [
        {
          id: 'item-1',
          version: 3,
          orderLabel: '1',
          placeName: '우메다 공중정원',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Umeda',
        },
        {
          id: 'item-2',
          version: 5,
          orderLabel: '2',
          placeName: '도톤보리',
          placeType: 'food',
          placeTypeLabel: '식당',
          address: 'Dotonbori',
        },
      ],
    };

    assert.deepEqual(buildDayItineraryReorderAction(viewModel), { status: 'enabled', label: '순서 변경' });
    assert.deepEqual(buildDayItineraryReorderDraft(viewModel), {
      title: '순서 변경',
      helper: '핸들을 잡고 위아래로 끌어서 순서를 바꿔요.',
      originalItems: [
        {
          id: 'item-1',
          version: 3,
          orderLabel: '1',
          placeName: '우메다 공중정원',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Umeda',
          dragHandleLabel: '드래그',
        },
        {
          id: 'item-2',
          version: 5,
          orderLabel: '2',
          placeName: '도톤보리',
          placeType: 'food',
          placeTypeLabel: '식당',
          address: 'Dotonbori',
          dragHandleLabel: '드래그',
        },
      ],
      items: [
        {
          id: 'item-1',
          version: 3,
          orderLabel: '1',
          placeName: '우메다 공중정원',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Umeda',
          dragHandleLabel: '드래그',
        },
        {
          id: 'item-2',
          version: 5,
          orderLabel: '2',
          placeName: '도톤보리',
          placeType: 'food',
          placeTypeLabel: '식당',
          address: 'Dotonbori',
          dragHandleLabel: '드래그',
        },
      ],
    });
  });

  it('reorders the draft, enables save, and builds sequential move operations', () => {
    const viewModel: DayItineraryViewModel = {
      status: 'success',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      items: [
        {
          id: 'item-1',
          version: 3,
          orderLabel: '1',
          placeName: '우메다 공중정원',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Umeda',
        },
        {
          id: 'item-2',
          version: 5,
          orderLabel: '2',
          placeName: '도톤보리',
          placeType: 'food',
          placeTypeLabel: '식당',
          address: 'Dotonbori',
        },
        {
          id: 'item-3',
          version: 8,
          orderLabel: '3',
          placeName: '오사카성',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Osaka',
        },
      ],
    };

    const draft = buildDayItineraryReorderDraft(viewModel);
    assert.ok(draft);

    const reorderedDraft = moveDayItineraryReorderItem(draft, 2, 0);

    assert.deepEqual(
      reorderedDraft.items.map((item) => ({ id: item.id, orderLabel: item.orderLabel })),
      [
        { id: 'item-3', orderLabel: '1' },
        { id: 'item-1', orderLabel: '2' },
        { id: 'item-2', orderLabel: '3' },
      ],
    );
    assert.equal(hasDayItineraryReorderChanges(reorderedDraft), true);
    assert.deepEqual(buildDayItineraryReorderSubmitState(false, reorderedDraft), { disabled: false, label: '저장' });
    assert.deepEqual(buildDayItineraryReorderSubmitState(true, reorderedDraft), {
      disabled: true,
      label: '저장 중...',
    });
    assert.deepEqual(buildReorderScheduleItemsRequest(reorderedDraft), {
      moves: [
        {
          scheduleItemId: 'item-3',
          beforeScheduleItemId: null,
          afterScheduleItemId: 'item-1',
          clientVersion: 8,
        },
      ],
    });
  });

  it('keeps drag-only changes local and persists only after explicit save', async () => {
    const viewModel: DayItineraryViewModel = {
      status: 'success',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      items: [
        {
          id: 'item-1',
          version: 3,
          orderLabel: '1',
          placeName: '우메다 공중정원',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Umeda',
        },
        {
          id: 'item-2',
          version: 5,
          orderLabel: '2',
          placeName: '도톤보리',
          placeType: 'food',
          placeTypeLabel: '식당',
          address: 'Dotonbori',
        },
        {
          id: 'item-3',
          version: 8,
          orderLabel: '3',
          placeName: '오사카성',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Osaka',
        },
      ],
    };

    const draft = buildDayItineraryReorderDraft(viewModel);
    assert.ok(draft);

    const reorderedDraft = moveDayItineraryReorderItem(draft, 2, 0);
    let submitCount = 0;

    assert.equal(submitCount, 0);

    const response = await submitDayItineraryReorder(reorderedDraft, async (request) => {
      submitCount += 1;
      assert.deepEqual(request, {
        moves: [
          {
            scheduleItemId: 'item-3',
            beforeScheduleItemId: null,
            afterScheduleItemId: 'item-1',
            clientVersion: 8,
          },
        ],
      });
      return { ok: true };
    });

    assert.deepEqual(response, { ok: true });
    assert.equal(submitCount, 1);
  });

  it('keeps save disabled and avoids building a request when the final order returns to the original order', () => {
    const viewModel: DayItineraryViewModel = {
      status: 'success',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      items: [
        {
          id: 'item-1',
          version: 3,
          orderLabel: '1',
          placeName: '우메다 공중정원',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Umeda',
        },
        {
          id: 'item-2',
          version: 5,
          orderLabel: '2',
          placeName: '도톤보리',
          placeType: 'food',
          placeTypeLabel: '식당',
          address: 'Dotonbori',
        },
        {
          id: 'item-3',
          version: 8,
          orderLabel: '3',
          placeName: '오사카성',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Osaka',
        },
      ],
    };

    const draft = buildDayItineraryReorderDraft(viewModel);
    assert.ok(draft);

    const movedDraft = moveDayItineraryReorderItem(draft, 2, 0);
    assert.equal(hasDayItineraryReorderChanges(movedDraft), true);

    const restoredDraft = moveDayItineraryReorderItem(movedDraft, 0, 2);

    assert.equal(hasDayItineraryReorderChanges(restoredDraft), false);
    assert.deepEqual(buildDayItineraryReorderSubmitState(false, restoredDraft), { disabled: true, label: '저장' });
    assert.equal(buildReorderScheduleItemsRequest(restoredDraft), null);
  });

  it('skips persistence when save is attempted without any reorder changes', async () => {
    const viewModel: DayItineraryViewModel = {
      status: 'success',
      dayLabel: 'Day 1',
      formattedDate: '2026.07.10',
      items: [
        {
          id: 'item-1',
          version: 3,
          orderLabel: '1',
          placeName: '우메다 공중정원',
          placeType: 'sights',
          placeTypeLabel: '관광지',
          address: 'Umeda',
        },
        {
          id: 'item-2',
          version: 5,
          orderLabel: '2',
          placeName: '도톤보리',
          placeType: 'food',
          placeTypeLabel: '식당',
          address: 'Dotonbori',
        },
      ],
    };

    const draft = buildDayItineraryReorderDraft(viewModel);
    assert.ok(draft);

    let submitCount = 0;
    const response = await submitDayItineraryReorder(draft, async () => {
      submitCount += 1;
      return { ok: true };
    });

    assert.equal(response, null);
    assert.equal(submitCount, 0);
  });

  it('exits edit mode and shows the latest itinerary order after a successful save', () => {
    const response: GetDayScheduleItemsResponse = {
      day: { date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
      items: [
        {
          id: 'item-3',
          itemOrder: 1,
          version: 9,
          isLodging: false,
          arrivedAt: null,
          skippedAt: null,
          place: { id: 'place-3', name: '오사카성', placeType: 'sights', address: 'Osaka' },
        },
        {
          id: 'item-1',
          itemOrder: 2,
          version: 3,
          isLodging: false,
          arrivedAt: null,
          skippedAt: null,
          place: { id: 'place-1', name: '우메다 공중정원', placeType: 'sights', address: 'Umeda' },
        },
        {
          id: 'item-2',
          itemOrder: 3,
          version: 5,
          isLodging: false,
          arrivedAt: null,
          skippedAt: null,
          place: { id: 'place-2', name: '도톤보리', placeType: 'food', address: 'Dotonbori' },
        },
      ],
    };

    assert.deepEqual(buildDayItineraryReorderSuccessViewModel(response), {
      reorderFeedback: null,
      reorderState: { status: 'idle' },
      itinerary: {
        status: 'success',
        dayLabel: 'Day 1',
        formattedDate: '2026.07.10',
        items: [
          {
            id: 'item-3',
            version: 9,
            orderLabel: '1',
            isLodging: false,
            placeId: 'place-3',
            placeName: '오사카성',
            placeType: 'sights',
            placeTypeLabel: '관광지',
            address: 'Osaka',
          },
          {
            id: 'item-1',
            version: 3,
            orderLabel: '2',
            isLodging: false,
            placeId: 'place-1',
            placeName: '우메다 공중정원',
            placeType: 'sights',
            placeTypeLabel: '관광지',
            address: 'Umeda',
          },
          {
            id: 'item-2',
            version: 5,
            orderLabel: '3',
            isLodging: false,
            placeId: 'place-2',
            placeName: '도톤보리',
            placeType: 'food',
            placeTypeLabel: '식당',
            address: 'Dotonbori',
          },
        ],
      },
    });
  });

  it('maps reorder save failures to retryable copy', () => {
    assert.deepEqual(dayItineraryReorderFailureState(), {
      title: '순서를 저장할 수 없어요.',
      helper: '잠시 후 다시 시도해주세요.',
    });
  });

  it('shows the conflict message and discards the unsaved order after a 409 response', () => {
    assert.deepEqual(buildDayItineraryReorderConflictViewModel(), {
      reorderFeedback: DAY_ITINERARY_REORDER_CONFLICT_MESSAGE,
      reorderState: { status: 'idle' },
    });
  });
});
