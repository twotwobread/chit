import type { SetDayLodgingPlaceRequest, TripDay } from '@i-um/api-contract';

export const dayLodgingCopy = {
  badge: '대표 숙소',
  setAction: '숙소로 지정',
  clearAction: '숙소 해제',
  setting: '숙소로 지정 중...',
  clearing: '숙소 해제 중...',
  detailLabel: '숙소',
  mutationError: '숙소 정보를 저장할 수 없어요. 잠시 후 다시 시도해주세요.',
} as const;

export type DayLodgingMutationKind = 'set' | 'clear';

export type DayLodgingSubmittingState = {
  kind: DayLodgingMutationKind;
  itemId: string;
};

export type DayLodgingRowActionViewModel = {
  kind: DayLodgingMutationKind;
  label: string;
  disabled: boolean;
  isSubmitting: boolean;
};

export type DayLodgingRowViewModel = {
  isLodging: boolean;
  badgeLabel: string | null;
  action: DayLodgingRowActionViewModel;
};

export type TripDayLodgingSummaryViewModel = {
  label: string;
  placeName: string;
  address: string;
};

export type DayLodgingMutationFailureViewModel = {
  title: string;
  helper: string;
};

export function buildDayLodgingRowViewModel(
  item: { id: string; isLodging?: boolean },
  submitting?: DayLodgingSubmittingState | null,
): DayLodgingRowViewModel {
  const isLodging = item.isLodging ?? false;
  const kind: DayLodgingMutationKind = isLodging ? 'clear' : 'set';
  const isSubmitting = submitting?.itemId === item.id && submitting.kind === kind;

  return {
    isLodging,
    badgeLabel: isLodging ? dayLodgingCopy.badge : null,
    action: {
      kind,
      label: isSubmitting
        ? kind === 'set'
          ? dayLodgingCopy.setting
          : dayLodgingCopy.clearing
        : kind === 'set'
          ? dayLodgingCopy.setAction
          : dayLodgingCopy.clearAction,
      disabled: Boolean(submitting),
      isSubmitting,
    },
  };
}

export function buildSetDayLodgingPlaceRequest(tripPlaceId: string): SetDayLodgingPlaceRequest {
  return { tripPlaceId };
}

export function buildTripDayLodgingSummary(day: Pick<TripDay, 'lodgingPlace'>): TripDayLodgingSummaryViewModel | null {
  if (!day.lodgingPlace) {
    return null;
  }

  return {
    label: dayLodgingCopy.detailLabel,
    placeName: day.lodgingPlace.name,
    address: day.lodgingPlace.address,
  };
}

export function dayLodgingMutationFailureState(): DayLodgingMutationFailureViewModel {
  return {
    title: dayLodgingCopy.mutationError,
    helper: '기존 일정은 그대로 유지했어요.',
  };
}
