import type { GetDayScheduleItemsResponse, ReorderScheduleItemsRequest } from '@i-um/api-contract';

import { buildDayItineraryViewModel, type DayItineraryRowViewModel, type DayItineraryViewModel } from './day-itinerary';

export type DayItineraryReorderActionViewModel = { status: 'hidden' } | { status: 'enabled'; label: '순서 변경' };

export type DayItineraryReorderRowViewModel = DayItineraryRowViewModel & {
  dragHandleLabel: '드래그';
};

export type DayItineraryReorderDraftViewModel = {
  title: '순서 변경';
  helper: '핸들을 잡고 위아래로 끌어서 순서를 바꿔요.';
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
    dragHandleLabel: '드래그',
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
    helper: '핸들을 잡고 위아래로 끌어서 순서를 바꿔요.',
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

  return moves.length > 0 ? { moves } : null;
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
