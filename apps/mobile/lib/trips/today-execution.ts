import type { DayItineraryItem, GetDayItineraryResponse, GetTripDetailResponse, TripDay, TripListItem } from '@i-um/api-contract';

import { buildDayItineraryRoute, getPlaceTypeLabel } from './day-itinerary';
import { formatTripDayDate } from './days';
import { tripDetailPath } from './mypage';
import { groupTripsByStatus } from './status';

export type TodayRouteAction = {
  kind: 'route';
  label: string;
  route: string;
};

export type TodayRetryAction = {
  kind: 'retry';
  label: string;
};

export type TodayAction = TodayRouteAction | TodayRetryAction;

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
  multipleOngoingTripNotice: TodayMultipleOngoingTripNotice | null;
};

export type TodayRemainingPlaceRowViewModel = {
  itemId: string;
  orderLabel: string;
  placeName: string;
  placeTypeLabel: string;
  address: string;
  timeLabel: string | null;
};

export type TodayRemainingSectionViewModel =
  | {
      status: 'empty';
      title: string;
      emptyTitle: string;
      helper: string;
    }
  | {
      status: 'list';
      title: string;
      countLabel: string;
      items: TodayRemainingPlaceRowViewModel[];
    };

export type TodaySuccessViewModel = {
  status: 'success';
  tripName: string;
  dayLabel: string;
  formattedDate: string;
  nextPlace: {
    itemId: string;
    orderLabel: string;
    placeName: string;
    placeTypeLabel: string;
    address: string;
  };
  remainingSection: TodayRemainingSectionViewModel;
  primaryAction: TodayRouteAction;
  multipleOngoingTripNotice: TodayMultipleOngoingTripNotice | null;
};

export type TodayExecutionViewModel =
  | TodayNoOngoingTripViewModel
  | TodayUnavailableViewModel
  | TodayRetryableErrorViewModel
  | TodayEmptyItineraryViewModel
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
}: {
  selectedTrip: TripListItem;
  tripDetail: GetTripDetailResponse;
  itinerary: GetDayItineraryResponse;
  today: string;
  ongoingTripCount: number;
}): TodayUnavailableViewModel | TodayEmptyItineraryViewModel | TodaySuccessViewModel {
  const currentDay = findTodayTripDay(tripDetail.days, today);
  if (!currentDay) {
    return buildTodayUnavailableViewModel(selectedTrip.id);
  }

  const dayRoute = buildDayItineraryRoute(selectedTrip.id, currentDay.date);
  const common = {
    tripName: tripDetail.trip.name,
    dayLabel: `Day ${currentDay.dayOrder}`,
    formattedDate: formatTripDayDate(currentDay.date),
    primaryAction: routeAction(itinerary.items.length === 0 ? '오늘 일정 열기' : '오늘 일정 보기', dayRoute),
    multipleOngoingTripNotice: buildMultipleOngoingTripNotice(ongoingTripCount),
  };

  const orderedItems = orderedItineraryItems(itinerary.items);
  const nextItem = orderedItems[0];
  if (!nextItem) {
    return {
      status: 'emptyItinerary',
      ...common,
      title: '오늘 일정에 아직 장소가 없어요.',
      helper: '오늘 일정 화면에서 첫 장소를 추가해보세요.',
    };
  }

  return {
    status: 'success',
    ...common,
    nextPlace: {
      itemId: nextItem.id,
      orderLabel: String(nextItem.itemOrder),
      placeName: nextItem.place.name,
      placeTypeLabel: getPlaceTypeLabel(nextItem.place.placeType),
      address: nextItem.place.address,
    },
    remainingSection: buildRemainingSection(orderedItems.slice(1)),
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

function orderedItineraryItems(items: DayItineraryItem[]): DayItineraryItem[] {
  return [...items].sort((left, right) => left.itemOrder - right.itemOrder);
}

function buildRemainingSection(items: DayItineraryItem[]): TodayRemainingSectionViewModel {
  if (items.length === 0) {
    return {
      status: 'empty',
      title: '남은 장소',
      emptyTitle: '다음 장소 이후 남은 장소가 없어요.',
      helper: '도착하면 오늘 일정이 끝나요.',
    };
  }

  return {
    status: 'list',
    title: '남은 장소',
    countLabel: `${items.length}곳 남았어요`,
    items: items.map((item) => ({
      itemId: item.id,
      orderLabel: String(item.itemOrder),
      placeName: item.place.name,
      placeTypeLabel: getPlaceTypeLabel(item.place.placeType),
      address: item.place.address,
      timeLabel: null,
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

function routeAction(label: string, route: string): TodayRouteAction {
  return { kind: 'route', label, route };
}

function retryAction(): TodayRetryAction {
  return { kind: 'retry', label: '다시 시도' };
}
