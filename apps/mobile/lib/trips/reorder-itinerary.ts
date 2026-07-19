import type { GetDayScheduleItemsResponse, ReorderScheduleItemsRequest } from '@i-um/api-contract';

import { buildDayItineraryViewModel, type DayItineraryRowViewModel, type DayItineraryViewModel } from './day-itinerary';
import { formatScheduleMinutes, parseScheduleTimeToMinutes } from './schedule-item-ordering';

export type DayItineraryReorderActionViewModel = { status: 'hidden' } | { status: 'enabled'; label: '순서 변경' };

export type DayItineraryReorderRowViewModel = DayItineraryRowViewModel & {
  dragHandleLabel: '순서 변경';
};

export type DayItineraryReorderDraftViewModel = {
  title: '순서 변경';
  helper: string;
  originalItems: DayItineraryReorderRowViewModel[];
  items: DayItineraryReorderRowViewModel[];
};

export type DayItineraryReorderSubmitState = {
  disabled: boolean;
  label: '저장' | '저장 중...';
};

export type DayItineraryReorderFailureViewModel = {
  title: '순서를 저장할 수 없어요.';
  helper: '잠시 후 다시 시도해주세요.';
};

export const DAY_ITINERARY_REORDER_CONFLICT_MESSAGE =
  '다른 변경이 있어 저장되지 않았어요. 최신 일정으로 다시 불러왔어요.';

const defaultReorderHelper = '핸들을 잡고 위아래로 끌어서 순서를 바꿔요.';
const timedReorderHelper =
  '시간 범위가 있는 일정은 순서를 바꾸면 각 일정의 길이와 기존 빈 시간을 유지해 시작/종료 시간이 함께 조정돼요.';

export type DayItineraryReorderSuccessViewModel = {
  reorderFeedback: null;
  reorderState: { status: 'idle' };
  itinerary: DayItineraryViewModel;
};

export type DayItineraryReorderConflictViewModel = {
  reorderFeedback: typeof DAY_ITINERARY_REORDER_CONFLICT_MESSAGE;
  reorderState: { status: 'idle' };
};

function buildDraftRows(items: DayItineraryRowViewModel[]): DayItineraryReorderRowViewModel[] {
  return items.map((item, index) => ({
    ...item,
    orderLabel: String(index + 1),
    dragHandleLabel: '순서 변경',
  }));
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function buildDayItineraryReorderAction(viewModel: DayItineraryViewModel): DayItineraryReorderActionViewModel {
  if (viewModel.status !== 'success' || viewModel.items.length < 2) {
    return { status: 'hidden' };
  }

  return { status: 'enabled', label: '순서 변경' };
}

export function buildDayItineraryReorderDraft(
  viewModel: DayItineraryViewModel,
): DayItineraryReorderDraftViewModel | null {
  if (viewModel.status !== 'success' || viewModel.items.length < 2) {
    return null;
  }

  return {
    title: '순서 변경',
    helper: viewModel.items.some((item) => item.startTime) ? timedReorderHelper : defaultReorderHelper,
    originalItems: buildDraftRows(viewModel.items),
    items: buildDraftRows(viewModel.items),
  };
}

export function moveDayItineraryReorderItem(
  draft: DayItineraryReorderDraftViewModel,
  fromIndex: number,
  toIndex: number,
): DayItineraryReorderDraftViewModel {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= draft.items.length || toIndex >= draft.items.length) {
    return draft;
  }

  return {
    ...draft,
    items: buildDraftRows(moveItem(draft.items, fromIndex, toIndex)),
  };
}

export function hasDayItineraryReorderChanges(draft: DayItineraryReorderDraftViewModel): boolean {
  return draft.items.some((item, index) => item.id !== draft.originalItems[index]?.id);
}

export function buildDayItineraryReorderSubmitState(
  isSaving: boolean,
  draft: DayItineraryReorderDraftViewModel,
): DayItineraryReorderSubmitState {
  if (isSaving) {
    return { disabled: true, label: '저장 중...' };
  }

  return hasDayItineraryReorderChanges(draft) ? { disabled: false, label: '저장' } : { disabled: true, label: '저장' };
}

type TimedRangeReorderRow = {
  item: DayItineraryReorderRowViewModel;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
};

function toTimedRangeReorderRow(item: DayItineraryReorderRowViewModel): TimedRangeReorderRow | null {
  const startMinutes = parseScheduleTimeToMinutes(item.startTime);
  const endMinutes = parseScheduleTimeToMinutes(item.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return null;
  }

  return { item, startMinutes, endMinutes, durationMinutes: endMinutes - startMinutes };
}

function buildTimedRangeReorderTimeUpdates(
  draft: DayItineraryReorderDraftViewModel,
): ReorderScheduleItemsRequest['timeUpdates'] | undefined {
  const originalRanges = draft.originalItems.map(toTimedRangeReorderRow).filter((row) => row !== null);
  if (originalRanges.length < 2) {
    return undefined;
  }

  const finalRanges = draft.items.map(toTimedRangeReorderRow).filter((row) => row !== null);
  if (
    finalRanges.length !== originalRanges.length ||
    finalRanges.every((row, index) => row.item.id === originalRanges[index]?.item.id)
  ) {
    return undefined;
  }

  const updates: NonNullable<ReorderScheduleItemsRequest['timeUpdates']> = [];
  let nextStartMinutes = originalRanges[0].startMinutes;
  for (const [index, finalRange] of finalRanges.entries()) {
    const startTime = formatScheduleMinutes(nextStartMinutes);
    const endTime = formatScheduleMinutes(nextStartMinutes + finalRange.durationMinutes);
    if (!startTime || !endTime) {
      return undefined;
    }

    if (startTime !== finalRange.item.startTime || endTime !== finalRange.item.endTime) {
      updates.push({
        scheduleItemId: finalRange.item.id,
        expectedStartTime: finalRange.item.startTime ?? null,
        expectedEndTime: finalRange.item.endTime ?? null,
        startTime,
        endTime,
      });
    }

    const nextOriginalRange = originalRanges[index + 1];
    if (nextOriginalRange) {
      const originalGapMinutes = nextOriginalRange.startMinutes - originalRanges[index].endMinutes;
      nextStartMinutes = nextStartMinutes + finalRange.durationMinutes + originalGapMinutes;
    }
  }

  return updates.length > 0 ? updates : undefined;
}

export function buildReorderScheduleItemsRequest(
  draft: DayItineraryReorderDraftViewModel,
): ReorderScheduleItemsRequest | null {
  if (!hasDayItineraryReorderChanges(draft)) {
    return null;
  }

  const workingIds = draft.originalItems.map((item) => item.id);
  const versionByItemId = new Map(draft.originalItems.map((item) => [item.id, item.version]));
  const moves: ReorderScheduleItemsRequest['moves'] = [];

  for (const [targetIndex, finalItem] of draft.items.entries()) {
    const currentIndex = workingIds.indexOf(finalItem.id);
    if (currentIndex === -1 || currentIndex === targetIndex) {
      continue;
    }

    workingIds.splice(currentIndex, 1);
    workingIds.splice(targetIndex, 0, finalItem.id);

    moves.push({
      scheduleItemId: finalItem.id,
      beforeScheduleItemId: targetIndex === 0 ? null : workingIds[targetIndex - 1],
      afterScheduleItemId: targetIndex === workingIds.length - 1 ? null : workingIds[targetIndex + 1],
      clientVersion: versionByItemId.get(finalItem.id) ?? finalItem.version,
    });
  }

  if (moves.length === 0) {
    return null;
  }

  const timeUpdates = buildTimedRangeReorderTimeUpdates(draft);
  return timeUpdates ? { moves, timeUpdates } : { moves };
}

export async function submitDayItineraryReorder<T>(
  draft: DayItineraryReorderDraftViewModel,
  submit: (request: ReorderScheduleItemsRequest) => Promise<T>,
): Promise<T | null> {
  const request = buildReorderScheduleItemsRequest(draft);
  if (!request) {
    return null;
  }

  return submit(request);
}

export function buildDayItineraryReorderSuccessViewModel(
  response: GetDayScheduleItemsResponse,
): DayItineraryReorderSuccessViewModel {
  return {
    reorderFeedback: null,
    reorderState: { status: 'idle' },
    itinerary: buildDayItineraryViewModel(response),
  };
}

export function buildDayItineraryReorderConflictViewModel(): DayItineraryReorderConflictViewModel {
  return {
    reorderFeedback: DAY_ITINERARY_REORDER_CONFLICT_MESSAGE,
    reorderState: { status: 'idle' },
  };
}

export function dayItineraryReorderFailureState(): DayItineraryReorderFailureViewModel {
  return {
    title: '순서를 저장할 수 없어요.',
    helper: '잠시 후 다시 시도해주세요.',
  };
}
