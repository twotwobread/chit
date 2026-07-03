import type { Href } from 'expo-router';

import type {
  ScheduleItem,
  GetDayScheduleItemsResponse,
  GetTripDetailResponse,
  RoutablePlace,
  TripDay,
  TripListItem,
  TripPlaceSummary,
  TripPlaceType,
} from '@i-um/api-contract';

import {
  buildNonPlaceDetailLabel,
  getNonPlaceCategoryLabel,
  getPlaceTypeLabel,
  getScheduleItems,
} from './day-itinerary';
import { formatTripDayDate } from './days';
import { tripDetailPath } from './mypage';
import { tripItineraryDayPath } from './routes';
import { buildQuickExpenseRoute } from './quick-expense';
import { groupTripsByStatus } from './status';
import {
  buildTravelModeSelectorViewModel,
  defaultTravelMode,
  type TravelMode,
  type TravelModeSelectorViewModel,
} from './travel-mode';

export type TodayRouteAction = {
  kind: 'route';
  label: string;
  route: Href;
};

export type TodayRetryAction = {
  kind: 'retry';
  label: string;
};

export type TodayArriveAction = {
  kind: 'arrive';
  label: string;
  tripId: string;
  date: string;
  itemId: string;
};

export type TodaySkipAction = {
  kind: 'skip';
  label: string;
  tripId: string;
  date: string;
  itemId: string;
};

export type TodayRestoreAction = {
  kind: 'restore';
  label: string;
  tripId: string;
  date: string;
  itemId: string;
};

export type TodayNavigateAction = {
  kind: 'navigate';
  label: string;
  destination: {
    placeName: string;
    address: string;
  };
  travelMode: TravelMode;
};

export type TodayLodgingNavigationActionViewModel = {
  label: string;
  disabled: boolean;
  helper: string | null;
  action: TodayNavigateAction | null;
};

const todayLodgingNavigationCopy = {
  action: '숙소로 이동',
  missingHelper: '오늘 일정에서 대표 숙소를 지정하면 바로 이동할 수 있어요.',
} as const;

export type TodayAction =
  | TodayRouteAction
  | TodayRetryAction
  | TodayArriveAction
  | TodaySkipAction
  | TodayRestoreAction
  | TodayNavigateAction;

export type TodayMultipleOngoingTripNotice = {
  message: string;
  action: TodayRouteAction;
};

export type TodayTripSelection = {
  trip: TripListItem;
  ongoingTripCount: number;
  hasMultipleOngoingTrips: boolean;
};

export type TodayNoOngoingTripViewModel = {
  status: 'noOngoingTrip';
  title: string;
  helper: string;
  primaryAction: TodayRouteAction;
  secondaryAction: TodayRouteAction;
};

export type TodayUnavailableViewModel = {
  status: 'unavailable';
  title: string;
  helper: string;
  primaryAction: TodayRetryAction;
  secondaryAction?: TodayRouteAction;
};

export type TodayRetryableErrorViewModel = {
  status: 'retryableError';
  title: string;
  helper: string;
  primaryAction: TodayRetryAction;
  secondaryAction?: TodayRouteAction;
};

export type TodayEmptyItineraryViewModel = {
  status: 'emptyItinerary';
  tripName: string;
  dayLabel: string;
  formattedDate: string;
  title: string;
  helper: string;
  primaryAction: TodayRouteAction;
  lodgingNavigationAction: TodayLodgingNavigationActionViewModel;
  multipleOngoingTripNotice: TodayMultipleOngoingTripNotice | null;
};

export type TodayCompletedViewModel = {
  status: 'completed';
  tripName: string;
  dayLabel: string;
  formattedDate: string;
  title: string;
  helper: string;
  completedCountLabel: string;
  quickExpenseAction: TodayRouteAction;
  primaryAction: TodayRouteAction;
  lodgingNavigationAction: TodayLodgingNavigationActionViewModel;
  multipleOngoingTripNotice: TodayMultipleOngoingTripNotice | null;
};

export type TodaySkippedPlaceRowViewModel = {
  itemId: string;
  orderLabel: string;
  placeName: string;
  placeTypeLabel: string;
  address: string;
  restoreAction: TodayRestoreAction;
};

export type TodaySkippedPlacesSectionViewModel = {
  title: string;
  countLabel: string;
  items: TodaySkippedPlaceRowViewModel[];
};

export type TodaySuccessViewModel = {
  status: 'success';
  tripName: string;
  dayLabel: string;
  formattedDate: string;
  nextPlace: {
    itemId: string;
    order: number;
    orderLabel: string;
    placeName: string;
    placeType: TripPlaceType;
    placeTypeLabel: string;
    address: string;
    routablePlace: RoutablePlace | null;
    navigationAction: TodayNavigateAction;
    travelModeSelector: TravelModeSelectorViewModel;
  };
  skippedSection: TodaySkippedPlacesSectionViewModel | null;
  arrivalAction: TodayArriveAction;
  quickExpenseAction: TodayRouteAction;
  skipAction: TodaySkipAction;
  primaryAction: TodayRouteAction;
  lodgingNavigationAction: TodayLodgingNavigationActionViewModel;
  multipleOngoingTripNotice: TodayMultipleOngoingTripNotice | null;
};

export type TodayRecoverNeededViewModel = {
  status: 'recoverNeeded';
  tripName: string;
  dayLabel: string;
  formattedDate: string;
  title: string;
  helper: string;
  skippedSection: TodaySkippedPlacesSectionViewModel;
  primaryAction: TodayRouteAction;
  lodgingNavigationAction: TodayLodgingNavigationActionViewModel;
  multipleOngoingTripNotice: TodayMultipleOngoingTripNotice | null;
};

export type TodayExecutionViewModel =
  | TodayNoOngoingTripViewModel
  | TodayUnavailableViewModel
  | TodayRetryableErrorViewModel
  | TodayEmptyItineraryViewModel
  | TodayCompletedViewModel
  | TodayRecoverNeededViewModel
  | TodaySuccessViewModel;

export function selectTodayTrip(trips: TripListItem[], today: string): TodayTripSelection | null {
  const ongoingTrips = groupTripsByStatus(trips, today).find((section) => section.status === 'ongoing')?.trips ?? [];
  const selectedTrip = ongoingTrips[0];
  if (!selectedTrip) {
    return null;
  }

  return {
    trip: selectedTrip,
    ongoingTripCount: ongoingTrips.length,
    hasMultipleOngoingTrips: ongoingTrips.length > 1,
  };
}

export function buildTodayNoOngoingTripViewModel(): TodayNoOngoingTripViewModel {
  return {
    status: 'noOngoingTrip',
    title: '오늘 진행 중인 여행이 없어요.',
    helper: '내 여행에서 예정된 여행을 확인하거나 새 여행을 만들어보세요.',
    primaryAction: routeAction('내 여행 보기', '/mypage'),
    secondaryAction: routeAction('새 여행 만들기', '/trips/new'),
  };
}

export function buildTodayExecutionViewModel({
  selectedTrip,
  tripDetail,
  itinerary,
  today,
  ongoingTripCount,
  travelMode = defaultTravelMode,
}: {
  selectedTrip: TripListItem;
  tripDetail: GetTripDetailResponse;
  itinerary: GetDayScheduleItemsResponse;
  today: string;
  ongoingTripCount: number;
  travelMode?: TravelMode;
}):
  | TodayUnavailableViewModel
  | TodayEmptyItineraryViewModel
  | TodayCompletedViewModel
  | TodayRecoverNeededViewModel
  | TodaySuccessViewModel {
  const currentDay = findTodayTripDay(tripDetail.days, today);
  if (!currentDay) {
    return buildTodayUnavailableViewModel(selectedTrip.id);
  }

  const dayRoute = tripItineraryDayPath(selectedTrip.id, currentDay.id);
  const orderedItems = orderedItineraryItems(getScheduleItems(itinerary));
  const lodgingSourceDay = itinerary.day.date === currentDay.date ? itinerary.day : currentDay;
  const common = {
    tripName: tripDetail.trip.name,
    dayLabel: `Day ${currentDay.dayOrder}`,
    formattedDate: formatTripDayDate(currentDay.date),
    primaryAction: routeAction(orderedItems.length === 0 ? '오늘 일정 열기' : '오늘 일정 보기', dayRoute),
    lodgingNavigationAction: buildLodgingNavigationAction(lodgingSourceDay.lodgingPlace, travelMode),
    multipleOngoingTripNotice: buildMultipleOngoingTripNotice(ongoingTripCount),
  };

  if (orderedItems.length === 0) {
    return {
      status: 'emptyItinerary',
      ...common,
      title: '오늘 일정에 아직 장소가 없어요.',
      helper: '오늘 일정 화면에서 첫 장소를 추가해보세요.',
    };
  }

  const pendingItems = orderedItems.filter(isPendingItem);
  const skippedItems = orderedItems.filter(isSkippedItem);
  const nextItem = pendingItems[0];
  if (!nextItem) {
    if (skippedItems.length > 0) {
      return {
        status: 'recoverNeeded',
        ...common,
        title: '진행할 장소가 없어요.',
        helper: '스킵한 장소를 복구하면 다시 진행할 수 있어요.',
        skippedSection: buildSkippedSection(skippedItems, selectedTrip.id, currentDay.id),
      };
    }

    return {
      status: 'completed',
      ...common,
      title: '오늘 일정을 모두 완료했어요.',
      helper: '오늘 일정 화면에서 장소를 확인할 수 있어요.',
      completedCountLabel: `완료한 장소 ${orderedItems.length}곳`,
      quickExpenseAction: routeAction('지출 등록', buildQuickExpenseRoute(selectedTrip.id, currentDay.id)),
    };
  }

  const placeBackedNext = nextItem.place;
  const nonPlaceDetails = nextItem.nonPlace;
  const nonPlaceDetailLabel = buildNonPlaceDetailLabel(nextItem);

  return {
    status: 'success',
    ...common,
    nextPlace: placeBackedNext
      ? {
          itemId: nextItem.id,
          order: nextItem.itemOrder,
          orderLabel: String(nextItem.itemOrder),
          placeName: placeBackedNext.name,
          placeType: placeBackedNext.placeType,
          placeTypeLabel: getPlaceTypeLabel(placeBackedNext.placeType),
          address: placeBackedNext.address,
          routablePlace: placeBackedNext.routablePlace ?? null,
          navigationAction: navigateAction('길찾기', placeBackedNext.name, placeBackedNext.address, travelMode),
          travelModeSelector: buildTravelModeSelectorViewModel(travelMode),
        }
      : {
          itemId: nextItem.id,
          order: nextItem.itemOrder,
          orderLabel: String(nextItem.itemOrder),
          placeName: nonPlaceDetails?.title ?? '장소 없는 일정',
          placeType: 'etc' as const,
          placeTypeLabel: nonPlaceDetails ? getNonPlaceCategoryLabel(nonPlaceDetails.category) : '일정',
          address: nonPlaceDetailLabel ?? '세부 정보 없음',
          routablePlace: null,
          navigationAction: navigateAction('', '', '', travelMode),
          travelModeSelector: buildTravelModeSelectorViewModel(travelMode),
        },
    skippedSection: skippedItems.length > 0 ? buildSkippedSection(skippedItems, selectedTrip.id, currentDay.id) : null,
    arrivalAction: arriveAction(selectedTrip.id, currentDay.id, nextItem.id, placeBackedNext ? undefined : '완료'),
    quickExpenseAction: routeAction(
      '지출 등록',
      buildQuickExpenseRoute(selectedTrip.id, currentDay.id, placeBackedNext ? nextItem.id : undefined),
    ),
    skipAction: skipAction(selectedTrip.id, currentDay.id, nextItem.id),
  };
}

export function applyTravelModeToTodayViewModel(
  viewModel: TodayExecutionViewModel,
  travelMode: TravelMode,
): TodayExecutionViewModel {
  if (viewModel.status !== 'success') {
    return viewModel;
  }

  return {
    ...viewModel,
    nextPlace: {
      ...viewModel.nextPlace,
      navigationAction: {
        ...viewModel.nextPlace.navigationAction,
        travelMode,
      },
      travelModeSelector: buildTravelModeSelectorViewModel(travelMode),
    },
    lodgingNavigationAction: applyTravelModeToLodgingNavigationAction(viewModel.lodgingNavigationAction, travelMode),
  };
}

export function buildTodayRetryableErrorViewModel(tripId?: string): TodayRetryableErrorViewModel {
  return {
    status: 'retryableError',
    title: '오늘 일정을 불러올 수 없어요.',
    helper: tripId ? '잠시 후 다시 시도하거나 여행 상세를 확인해주세요.' : '잠시 후 다시 시도해주세요.',
    primaryAction: retryAction(),
    ...(tripId ? { secondaryAction: routeAction('여행 상세로', tripDetailPath(tripId)) } : {}),
  };
}

export function buildTodayUnavailableViewModel(tripId?: string): TodayUnavailableViewModel {
  return {
    status: 'unavailable',
    title: '오늘 일정을 찾을 수 없어요.',
    helper: '여행 정보가 바뀌었을 수 있어요. 다시 시도하거나 여행 상세를 확인해주세요.',
    primaryAction: retryAction(),
    ...(tripId ? { secondaryAction: routeAction('여행 상세로', tripDetailPath(tripId)) } : {}),
  };
}

export function findTodayTripDay(days: TripDay[], today: string): TripDay | null {
  return days.find((day) => day.date === today) ?? null;
}

function orderedItineraryItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((left, right) => left.itemOrder - right.itemOrder);
}

function isPendingItem(item: ScheduleItem): boolean {
  return item.arrivedAt === null && item.skippedAt === null;
}

function isSkippedItem(item: ScheduleItem): boolean {
  return item.arrivedAt === null && item.skippedAt !== null;
}

function buildSkippedSection(items: ScheduleItem[], tripId: string, date: string): TodaySkippedPlacesSectionViewModel {
  return {
    title: '스킵한 장소',
    countLabel: `${items.length}곳을 나중에 다시 볼 수 있어요.`,
    items: items.map((item) => ({
      itemId: item.id,
      orderLabel: String(item.itemOrder),
      placeName: item.place?.name ?? item.nonPlace?.title ?? '장소 없는 일정',
      placeTypeLabel: item.place
        ? getPlaceTypeLabel(item.place.placeType)
        : item.nonPlace
          ? getNonPlaceCategoryLabel(item.nonPlace.category)
          : '일정',
      address: item.place?.address ?? '',
      restoreAction: restoreAction(tripId, date, item.id),
    })),
  };
}

function buildMultipleOngoingTripNotice(ongoingTripCount: number): TodayMultipleOngoingTripNotice | null {
  if (ongoingTripCount <= 1) {
    return null;
  }

  return {
    message: '다른 진행 중인 여행은 내 여행에서 볼 수 있어요.',
    action: routeAction('내 여행 보기', '/mypage'),
  };
}

function routeAction(label: string, route: Href): TodayRouteAction {
  return { kind: 'route', label, route };
}

function retryAction(): TodayRetryAction {
  return { kind: 'retry', label: '다시 시도' };
}

function arriveAction(tripId: string, date: string, itemId: string, label = '도착했어요'): TodayArriveAction {
  return { kind: 'arrive', label, tripId, date, itemId };
}

function skipAction(tripId: string, date: string, itemId: string): TodaySkipAction {
  return { kind: 'skip', label: '스킵하기', tripId, date, itemId };
}

function restoreAction(tripId: string, date: string, itemId: string): TodayRestoreAction {
  return { kind: 'restore', label: '복구', tripId, date, itemId };
}

function buildLodgingNavigationAction(
  lodgingPlace: TripPlaceSummary | null,
  travelMode: TravelMode,
): TodayLodgingNavigationActionViewModel {
  if (!lodgingPlace) {
    return {
      label: todayLodgingNavigationCopy.action,
      disabled: true,
      helper: todayLodgingNavigationCopy.missingHelper,
      action: null,
    };
  }

  return {
    label: todayLodgingNavigationCopy.action,
    disabled: false,
    helper: null,
    action: navigateAction(todayLodgingNavigationCopy.action, lodgingPlace.name, lodgingPlace.address, travelMode),
  };
}

function applyTravelModeToLodgingNavigationAction(
  lodgingNavigationAction: TodayLodgingNavigationActionViewModel,
  travelMode: TravelMode,
): TodayLodgingNavigationActionViewModel {
  if (!lodgingNavigationAction.action) {
    return lodgingNavigationAction;
  }

  return {
    ...lodgingNavigationAction,
    action: {
      ...lodgingNavigationAction.action,
      travelMode,
    },
  };
}

function navigateAction(
  label: string,
  placeName: string,
  address: string,
  travelMode: TravelMode,
): TodayNavigateAction {
  return { kind: 'navigate', label, destination: { placeName, address }, travelMode };
}
