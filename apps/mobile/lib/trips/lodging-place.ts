import type {
  CreateManualDayLodgingPlaceRequest,
  ListTripPlacesResponse,
  SetDayLodgingPlaceRequest,
  TripDay,
  TripPlaceSummary,
} from '@i-um/api-contract';

export const dayLodgingCopy = {
  badge: '대표 숙소',
  setAction: '숙소로 지정',
  clearAction: '숙소 해제',
  setting: '숙소로 지정 중...',
  clearing: '숙소 해제 중...',
  detailLabel: '숙소',
  emptyHelper: '이 Day에 지정된 숙소가 없어요.',
  selectExistingAction: '기존 장소에서 선택',
  manualRegisterAction: '숙소 직접 등록',
  manualSubmit: '숙소 등록',
  manualSubmitting: '숙소 등록 중...',
  loadingPlaces: '장소를 불러오는 중...',
  emptyPlaces: '선택할 수 있는 장소가 없어요. 숙소를 직접 등록해 주세요.',
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

export type DayLodgingPanelViewModel = {
  label: string;
  placeName: string | null;
  address: string | null;
  helper: string | null;
  canClear: boolean;
};

export type DayLodgingPlaceOptionViewModel = {
  id: string;
  name: string;
  address: string;
  placeType: string;
  selected: boolean;
};

export type DayLodgingManualFormValues = {
  name: string;
  address: string;
};

export type DayLodgingManualFormErrors = {
  name?: string;
  address?: string;
  form?: string;
};

export type DayLodgingManualValidationResult =
  | { ok: true; request: CreateManualDayLodgingPlaceRequest }
  | { ok: false; errors: DayLodgingManualFormErrors };

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

export function buildDayLodgingPanel(place: TripPlaceSummary | null | undefined): DayLodgingPanelViewModel {
  if (!place) {
    return {
      label: dayLodgingCopy.detailLabel,
      placeName: null,
      address: null,
      helper: dayLodgingCopy.emptyHelper,
      canClear: false,
    };
  }

  return {
    label: dayLodgingCopy.detailLabel,
    placeName: place.name,
    address: place.address,
    helper: null,
    canClear: true,
  };
}

export function buildDayLodgingPlaceOptions(
  response: ListTripPlacesResponse,
  currentPlaceId?: string | null,
): DayLodgingPlaceOptionViewModel[] {
  return response.places.map((place) => ({
    id: place.id,
    name: place.name,
    address: place.address,
    placeType: place.placeType,
    selected: place.id === currentPlaceId,
  }));
}

export function validateManualDayLodgingPlaceForm(
  values: DayLodgingManualFormValues,
): DayLodgingManualValidationResult {
  const name = values.name.trim();
  const address = values.address.trim();
  const errors: DayLodgingManualFormErrors = {};

  if (name.length === 0) {
    errors.name = '숙소명을 입력해주세요.';
  } else if ([...name].length > 120) {
    errors.name = '숙소명은 120자 이하로 입력해주세요.';
  }

  if (address.length === 0) {
    errors.address = '주소를 입력해주세요.';
  } else if ([...address].length > 300) {
    errors.address = '주소는 300자 이하로 입력해주세요.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, request: { name, address } };
}

export function buildManualDayLodgingPlaceSubmitState(isSubmitting: boolean): { disabled: boolean; label: string } {
  return isSubmitting
    ? { disabled: true, label: dayLodgingCopy.manualSubmitting }
    : { disabled: false, label: dayLodgingCopy.manualSubmit };
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
