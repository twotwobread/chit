import type { MoveScheduleItemToDayRequest, TripDay } from '@i-um/api-contract';

import type { DayItineraryRowViewModel, DayItineraryViewModel } from './day-itinerary';
import { formatTripDayDate, formatTripDayLabel } from './days';

export type DayItineraryMoveActionViewModel = { status: 'hidden' } | { status: 'enabled'; label: '이동' };

export type DayItineraryMoveTargetOption = {
  tripDayId: string;
  dayLabel: string;
  formattedDate: string;
};

export type DayItineraryMoveConflictViewModel = {
  moveFeedback: typeof DAY_ITINERARY_MOVE_CONFLICT_MESSAGE;
  moveState: { status: 'idle' };
};

export type DayItineraryMoveFailureViewModel = {
  title: '일정을 이동할 수 없어요.';
  helper: '잠시 후 다시 시도해주세요.';
};

export const DAY_ITINERARY_MOVE_CONFLICT_MESSAGE = '다른 변경이 있어 이동하지 못했어요. 최신 일정으로 다시 불러왔어요.';

export function buildDayItineraryMoveAction(
  viewModel: DayItineraryViewModel,
  days: readonly TripDay[],
  sourceTripDayId: string,
): DayItineraryMoveActionViewModel {
  if (viewModel.status !== 'success' || viewModel.items.length === 0) {
    return { status: 'hidden' };
  }
  if (buildDayItineraryMoveTargetOptions(days, sourceTripDayId).length === 0) {
    return { status: 'hidden' };
  }
  return { status: 'enabled', label: '이동' };
}

export function buildDayItineraryMoveTargetOptions(
  days: readonly TripDay[],
  sourceTripDayId: string,
): DayItineraryMoveTargetOption[] {
  return days
    .filter((day) => day.id !== sourceTripDayId)
    .map((day) => ({
      tripDayId: day.id,
      dayLabel: formatTripDayLabel(day.dayOrder),
      formattedDate: formatTripDayDate(day.date),
    }));
}

export function buildDayItineraryMoveRequest(
  item: Pick<DayItineraryRowViewModel, 'version'>,
  targetTripDayId: string,
): MoveScheduleItemToDayRequest {
  return {
    targetTripDayId,
    clientVersion: item.version,
  };
}

export function requiresDayItineraryMoveStatusResetConfirmation(
  item: Pick<DayItineraryRowViewModel, 'statusLabel'>,
): boolean {
  return item.statusLabel === '완료' || item.statusLabel === '건너뜀';
}

export function buildDayItineraryMoveConflictViewModel(): DayItineraryMoveConflictViewModel {
  return {
    moveFeedback: DAY_ITINERARY_MOVE_CONFLICT_MESSAGE,
    moveState: { status: 'idle' },
  };
}

export function buildDayItineraryMoveFailureState(): DayItineraryMoveFailureViewModel {
  return {
    title: '일정을 이동할 수 없어요.',
    helper: '잠시 후 다시 시도해주세요.',
  };
}
