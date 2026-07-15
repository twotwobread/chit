import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TripDay } from '@i-um/api-contract';

import type { DayItineraryRowViewModel, DayItineraryViewModel } from './day-itinerary';
import {
  DAY_ITINERARY_MOVE_CONFLICT_MESSAGE,
  buildDayItineraryMoveAction,
  buildDayItineraryMoveConflictViewModel,
  buildDayItineraryMoveFailureState,
  buildDayItineraryMoveRequest,
  buildDayItineraryMoveTargetOptions,
  requiresDayItineraryMoveStatusResetConfirmation,
} from './move-itinerary';

const days: TripDay[] = [
  { id: 'day-1', date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
  { id: 'day-2', date: '2026-07-11', dayOrder: 2, lodgingPlace: null },
  { id: 'day-3', date: '2026-07-12', dayOrder: 3, lodgingPlace: null },
];

function row(overrides: Partial<DayItineraryRowViewModel> = {}): DayItineraryRowViewModel {
  return {
    id: 'item-1',
    version: 3,
    orderLabel: '1',
    placeName: '우메다 공중정원',
    placeType: 'sights',
    placeTypeLabel: '관광지',
    address: 'Umeda',
    ...overrides,
  };
}

function successViewModel(items: DayItineraryRowViewModel[]): DayItineraryViewModel {
  return {
    status: 'success',
    dayLabel: '1일차',
    formattedDate: '2026.07.10',
    lodgingPlace: null,
    items,
  };
}

describe('move itinerary helpers', () => {
  it('hides move action without another active day or without success items', () => {
    const emptyViewModel: DayItineraryViewModel = {
      status: 'empty',
      dayLabel: '1일차',
      formattedDate: '2026.07.10',
      lodgingPlace: null,
      title: '아직 등록된 일정이 없어요.',
      helper: '일정 추가를 눌러 방문할 장소를 등록해보세요.',
    };

    assert.deepEqual(buildDayItineraryMoveAction(emptyViewModel, days, 'day-1'), { status: 'hidden' });
    assert.deepEqual(buildDayItineraryMoveAction(successViewModel([row()]), [days[0]], 'day-1'), { status: 'hidden' });
  });

  it('enables move action when a success day has at least one other active day', () => {
    assert.deepEqual(buildDayItineraryMoveAction(successViewModel([row()]), days, 'day-1'), {
      status: 'enabled',
      label: '이동',
    });
  });

  it('builds target options excluding the source day and including empty days', () => {
    assert.deepEqual(buildDayItineraryMoveTargetOptions(days, 'day-1'), [
      { tripDayId: 'day-2', dayLabel: '2일차', formattedDate: '2026.07.11' },
      { tripDayId: 'day-3', dayLabel: '3일차', formattedDate: '2026.07.12' },
    ]);
  });

  it('builds a single item move request from the row version and selected target day', () => {
    assert.deepEqual(buildDayItineraryMoveRequest(row({ id: 'item-7', version: 9 }), 'day-3'), {
      targetTripDayId: 'day-3',
      clientVersion: 9,
    });
  });

  it('requires reset confirmation only for arrived or skipped rows', () => {
    assert.equal(requiresDayItineraryMoveStatusResetConfirmation(row()), false);
    assert.equal(requiresDayItineraryMoveStatusResetConfirmation(row({ statusLabel: '완료' })), true);
    assert.equal(requiresDayItineraryMoveStatusResetConfirmation(row({ statusLabel: '건너뜀' })), true);
  });

  it('builds conflict and retryable failure view models', () => {
    assert.equal(
      DAY_ITINERARY_MOVE_CONFLICT_MESSAGE,
      '다른 변경이 있어 이동하지 못했어요. 최신 일정으로 다시 불러왔어요.',
    );
    assert.deepEqual(buildDayItineraryMoveConflictViewModel(), {
      moveFeedback: DAY_ITINERARY_MOVE_CONFLICT_MESSAGE,
      moveState: { status: 'idle' },
    });
    assert.deepEqual(buildDayItineraryMoveFailureState(), {
      title: '일정을 이동할 수 없어요.',
      helper: '잠시 후 다시 시도해주세요.',
    });
  });
});
