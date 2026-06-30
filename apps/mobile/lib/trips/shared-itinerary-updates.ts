import type { GetDayScheduleItemsResponse } from '@i-um/api-contract';

import { getScheduleItems } from './day-itinerary';

export const DAY_ITINERARY_SHARED_UPDATE_POLL_INTERVAL_MS = 10_000;

export const DAY_ITINERARY_SHARED_UPDATE_BANNER = {
  message: '다른 참여자가 일정을 변경했어요.',
  actionLabel: '최신 내용 보기',
} as const;

export const DAY_ITINERARY_SHARED_UPDATE_RELOAD_CONFIRMATION = {
  title: '최신 일정으로 불러올까요?',
  helper: '현재 편집 중인 내용은 저장되지 않고 사라져요.',
  confirmLabel: '불러오기',
  cancelLabel: '계속 편집',
} as const;

export type DayItinerarySharedUpdateLocalState = {
  reorderStatus: 'idle' | 'editing' | 'saving';
  editStatus: 'idle' | 'editing' | 'saving';
  deleteStatus: 'idle' | 'confirming' | 'deleting';
  lodgingStatus: 'idle' | 'setting' | 'clearing' | 'error';
};

export type DayItinerarySharedUpdateState = {
  baselineSignature: string | null;
  pendingSignature: string | null;
};

export type DayItinerarySharedUpdateDecision = 'unchanged' | 'autoApply' | 'pending';

export type DayItinerarySharedUpdateReduction = {
  decision: DayItinerarySharedUpdateDecision;
  state: DayItinerarySharedUpdateState;
};

export function buildDayItinerarySharedUpdateSignature(response: GetDayScheduleItemsResponse): string {
  return JSON.stringify({
    day: {
      date: response.day.date,
      dayOrder: response.day.dayOrder,
    },
    items: [...getScheduleItems(response)]
      .sort((left, right) => {
        if (left.itemOrder !== right.itemOrder) {
          return left.itemOrder - right.itemOrder;
        }
        return left.id.localeCompare(right.id);
      })
      .map((item) => ({
        id: item.id,
        itemOrder: item.itemOrder,
        version: item.version,
        isLodging: item.isLodging,
        startTime: item.startTime,
        endTime: item.endTime,
        placeId: item.place.id,
        placeName: item.place.name,
        placeType: item.place.placeType,
        address: item.place.address,
      })),
  });
}

export function markDayItinerarySharedUpdateApplied(
  response: GetDayScheduleItemsResponse,
): DayItinerarySharedUpdateState {
  return {
    baselineSignature: buildDayItinerarySharedUpdateSignature(response),
    pendingSignature: null,
  };
}

export function isDayItinerarySharedUpdateProtected(localState: DayItinerarySharedUpdateLocalState): boolean {
  return (
    localState.reorderStatus === 'editing' ||
    localState.reorderStatus === 'saving' ||
    localState.editStatus === 'editing' ||
    localState.editStatus === 'saving' ||
    localState.deleteStatus === 'confirming' ||
    localState.deleteStatus === 'deleting' ||
    localState.lodgingStatus === 'setting' ||
    localState.lodgingStatus === 'clearing'
  );
}

export function isDayItinerarySharedUpdateReloadDisabled(localState: DayItinerarySharedUpdateLocalState): boolean {
  return (
    localState.reorderStatus === 'saving' ||
    localState.editStatus === 'saving' ||
    localState.deleteStatus === 'deleting' ||
    localState.lodgingStatus === 'setting' ||
    localState.lodgingStatus === 'clearing'
  );
}

export function reduceDayItinerarySharedUpdateFromResponse(
  state: DayItinerarySharedUpdateState,
  response: GetDayScheduleItemsResponse,
  localState: DayItinerarySharedUpdateLocalState,
): DayItinerarySharedUpdateReduction {
  const nextSignature = buildDayItinerarySharedUpdateSignature(response);

  if (state.baselineSignature === nextSignature) {
    return {
      decision: 'unchanged',
      state: state.pendingSignature === null ? state : { ...state, pendingSignature: null },
    };
  }

  if (isDayItinerarySharedUpdateProtected(localState)) {
    return {
      decision: 'pending',
      state: { ...state, pendingSignature: nextSignature },
    };
  }

  return {
    decision: 'autoApply',
    state: { baselineSignature: nextSignature, pendingSignature: null },
  };
}

export function buildDayItinerarySharedUpdateBanner(
  state: DayItinerarySharedUpdateState,
): typeof DAY_ITINERARY_SHARED_UPDATE_BANNER | null {
  return state.pendingSignature === null ? null : DAY_ITINERARY_SHARED_UPDATE_BANNER;
}

export function shouldReconcileDayItinerarySharedUpdate(
  state: DayItinerarySharedUpdateState,
  localState: DayItinerarySharedUpdateLocalState,
): boolean {
  return state.pendingSignature !== null && !isDayItinerarySharedUpdateProtected(localState);
}
