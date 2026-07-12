import type {
  CreateGoogleDayLodgingPlaceRequest,
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
  summaryEmptyPlaceName: '숙소 미지정',
  summarySetAction: '지정하기',
  summaryChangeAction: '변경',
  sheetEmptyTitle: '숙소 지정',
  sheetManageTitle: '숙소 관리',
  sheetEmptyHelper: '현재 여행에 저장된 장소 중 선택하거나 숙소를 직접 등록해 주세요.',
  addressCopyAction: '주소 복사',
  changeExistingAction: '다른 숙소로 변경',
  selectExistingAction: '기존 장소에서 선택',
  manualRegisterAction: '숙소 검색해서 등록',
  placeSearchPlaceholder: '숙소 이름을 검색해 주세요',
  placeSearchAction: '검색',
  placeSearchRegisterAction: '이 숙소로 등록',
  placeSearchInitial: '호텔명이나 숙소 이름을 검색해 주세요.',
  placeSearchCreating: '숙소 등록 중...',
  loadingPlaces: '장소를 불러오는 중...',
  emptyPlaces: '선택할 수 있는 장소가 없어요. 숙소를 직접 등록해 주세요.',
  mutationError: '숙소 정보를 저장할 수 없어요. 잠시 후 다시 시도해주세요.',
} as const;

export type DayLodgingMutationKind = 'set' | 'clear';

export type DayLodgingSubmittingState = {
  kind: DayLodgingMutationKind;
  itemId: string;
};

export type DayLodgingRowViewModel = {
  isLodging: boolean;
  badgeLabel: string | null;
  opensManagement: boolean;
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

export type DayLodgingSummaryViewModel = {
  label: string;
  placeName: string;
  actionLabel: string;
  address: null;
};

export type DayLodgingManagementSheetViewModel = {
  title: string;
  placeName: string | null;
  address: string | null;
  helper: string | null;
  canCopyAddress: boolean;
  canClear: boolean;
  selectExistingAction: string;
  manualRegisterAction: string;
  changeAction: string | null;
  clearAction: string | null;
  copyAddressAction: string | null;
};

export type DayLodgingPanelViewModel = {
  summary: DayLodgingSummaryViewModel;
  sheet: DayLodgingManagementSheetViewModel;
};

export type DayLodgingPlaceOptionViewModel = {
  id: string;
  name: string;
  address: string;
  placeType: string;
  selected: boolean;
};

export type DayLodgingPlaceOptionsPresentation = {
  isScrollable: boolean;
  visibleOptionCount: number;
};

export type DayLodgingManagementActionViewModel =
  | { kind: 'copyAddress'; label: string }
  | { kind: 'clear'; label: string; destructive: true }
  | { kind: 'change'; label: string }
  | { kind: 'searchRegister'; label: string };

export type DayLodgingManagementActionRowViewModel = {
  id: string;
  actions: DayLodgingManagementActionViewModel[];
};

const dayLodgingVisibleOptionCount = 4;

export function buildDayLodgingRowViewModel(
  item: { id: string; isLodging?: boolean },
  _submitting?: DayLodgingSubmittingState | null,
): DayLodgingRowViewModel {
  const isLodging = item.isLodging ?? false;

  return {
    isLodging,
    badgeLabel: isLodging ? dayLodgingCopy.badge : null,
    opensManagement: isLodging,
  };
}

export function buildSetDayLodgingPlaceRequest(tripPlaceId: string): SetDayLodgingPlaceRequest {
  return { tripPlaceId };
}

export function buildDayLodgingPanel(place: TripPlaceSummary | null | undefined): DayLodgingPanelViewModel {
  if (!place) {
    return {
      summary: {
        label: dayLodgingCopy.detailLabel,
        placeName: dayLodgingCopy.summaryEmptyPlaceName,
        actionLabel: dayLodgingCopy.summarySetAction,
        address: null,
      },
      sheet: {
        title: dayLodgingCopy.sheetEmptyTitle,
        placeName: null,
        address: null,
        helper: dayLodgingCopy.sheetEmptyHelper,
        canCopyAddress: false,
        canClear: false,
        selectExistingAction: dayLodgingCopy.selectExistingAction,
        manualRegisterAction: dayLodgingCopy.manualRegisterAction,
        changeAction: null,
        clearAction: null,
        copyAddressAction: null,
      },
    };
  }

  const hasAddress = place.address.trim().length > 0;

  return {
    summary: {
      label: dayLodgingCopy.detailLabel,
      placeName: place.name,
      actionLabel: dayLodgingCopy.summaryChangeAction,
      address: null,
    },
    sheet: {
      title: dayLodgingCopy.sheetManageTitle,
      placeName: place.name,
      address: place.address,
      helper: null,
      canCopyAddress: hasAddress,
      canClear: true,
      selectExistingAction: dayLodgingCopy.selectExistingAction,
      manualRegisterAction: dayLodgingCopy.manualRegisterAction,
      changeAction: dayLodgingCopy.changeExistingAction,
      clearAction: dayLodgingCopy.clearAction,
      copyAddressAction: hasAddress ? dayLodgingCopy.addressCopyAction : null,
    },
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

export function buildDayLodgingPlaceOptionsPresentation(
  options: readonly unknown[],
): DayLodgingPlaceOptionsPresentation {
  return {
    isScrollable: options.length > dayLodgingVisibleOptionCount,
    visibleOptionCount: Math.min(options.length, dayLodgingVisibleOptionCount),
  };
}

export function buildGoogleDayLodgingPlaceRequest(googlePlaceId: string): CreateGoogleDayLodgingPlaceRequest {
  return { googlePlaceId: googlePlaceId.trim() };
}

export function buildDayLodgingManagementActions(
  sheet: DayLodgingManagementSheetViewModel,
): DayLodgingManagementActionViewModel[] {
  const actions: DayLodgingManagementActionViewModel[] = [];

  if (sheet.canCopyAddress && sheet.copyAddressAction) {
    actions.push({ kind: 'copyAddress', label: sheet.copyAddressAction });
  }
  if (sheet.canClear && sheet.clearAction) {
    actions.push({ kind: 'clear', label: sheet.clearAction, destructive: true });
  }
  if (sheet.changeAction) {
    actions.push({ kind: 'change', label: sheet.changeAction });
  } else {
    actions.push({ kind: 'change', label: sheet.selectExistingAction });
  }
  actions.push({ kind: 'searchRegister', label: sheet.manualRegisterAction });

  return actions;
}

export function buildDayLodgingManagementActionRows(
  actions: DayLodgingManagementActionViewModel[],
): DayLodgingManagementActionRowViewModel[] {
  const currentPlaceActions = actions.filter((action) => action.kind === 'copyAddress' || action.kind === 'clear');
  const managementActions = actions.filter((action) => action.kind === 'change' || action.kind === 'searchRegister');
  const rows: DayLodgingManagementActionRowViewModel[] = [];

  if (currentPlaceActions.length > 0) {
    rows.push({ id: 'current-place-actions', actions: currentPlaceActions });
  }
  if (managementActions.length > 0) {
    rows.push({ id: 'management-actions', actions: managementActions });
  }

  return rows;
}

export function runDayLodgingSearchRegisterAction({
  closeSheet,
  openSearchRegister,
}: {
  closeSheet: () => void;
  openSearchRegister: () => void;
}) {
  closeSheet();
  openSearchRegister();
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
