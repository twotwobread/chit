import type { GetDayScheduleItemsResponse, ScheduleItem, TripPlaceSummary, TripPlaceType } from '@i-um/api-contract';

import { theme } from '../design/theme';
import { formatTripDayDate } from './days';

export type PlaceBackedScheduleItem = ScheduleItem;

export type DayItineraryRowViewModel = {
  id: string;
  version: number;
  orderLabel: string;
  isLodging?: boolean;
  statusLabel?: string;
  startTime?: string | null;
  endTime?: string | null;
  timeLabel?: string;
  placeId?: string;
  placeName: string;
  placeType: TripPlaceType;
  placeTypeLabel: string;
  address: string;
  placeMemo?: string;
};

export type DayItineraryViewModel =
  | {
      status: 'success';
      dayLabel: string;
      formattedDate: string;
      lodgingPlace: TripPlaceSummary | null;
      items: DayItineraryRowViewModel[];
    }
  | {
      status: 'empty';
      dayLabel: string;
      formattedDate: string;
      lodgingPlace: TripPlaceSummary | null;
      title: string;
      helper: string;
    };

export type DayItineraryFailureViewModel =
  | {
      status: 'notFound';
      title: string;
      helper: string;
    }
  | {
      status: 'retryableError';
      title: string;
      helper: string;
    };

export function getPlaceTypeLabel(placeType: TripPlaceType): string {
  return theme.placeType[placeType].label;
}

export function buildDayItineraryViewModel(response: GetDayScheduleItemsResponse): DayItineraryViewModel {
  const dayLabel = `Day ${response.day.dayOrder}`;
  const formattedDate = formatTripDayDate(response.day.date);
  const scheduleItems = getScheduleItems(response);

  if (scheduleItems.length === 0) {
    return {
      status: 'empty',
      dayLabel,
      formattedDate,
      lodgingPlace: response.day.lodgingPlace,
      title: '아직 등록된 일정이 없어요.',
      helper: '일정 추가를 눌러 방문할 장소를 등록해보세요.',
    };
  }

  return {
    status: 'success',
    dayLabel,
    formattedDate,
    lodgingPlace: response.day.lodgingPlace,
    items: [...scheduleItems]
      .sort((left, right) => left.itemOrder - right.itemOrder)
      .map(scheduleItemToDayItineraryRow),
  };
}

export function getScheduleItems(response: GetDayScheduleItemsResponse): PlaceBackedScheduleItem[] {
  return response.scheduleItems ?? ((response as unknown as { items?: ScheduleItem[] }).items || []);
}

export function buildDayItineraryPlaceAccessibilityLabel(item: DayItineraryRowViewModel): string {
  const timeText = item.timeLabel ? `${item.timeLabel}. ` : '';
  return `${item.orderLabel}번째 장소 ${timeText}${item.placeName}. ${item.placeTypeLabel}`;
}

function buildScheduleItemStatusLabel(item: ScheduleItem): string | undefined {
  if (item.arrivedAt) {
    return '완료';
  }
  if (item.skippedAt) {
    return '건너뜀';
  }
  return undefined;
}

function scheduleItemToDayItineraryRow(item: PlaceBackedScheduleItem): DayItineraryRowViewModel {
  const statusLabel = buildScheduleItemStatusLabel(item);
  const placeScheduleTitle = item.placeSchedule?.title?.trim();
  const placeScheduleMemo = item.placeSchedule?.memo?.trim();
  return {
    id: item.id,
    version: item.version,
    orderLabel: String(item.itemOrder),
    isLodging: item.isLodging,
    ...(statusLabel ? { statusLabel } : {}),
    startTime: item.startTime,
    endTime: item.endTime,
    timeLabel: formatScheduleItemTimeLabel(item.startTime, item.endTime),
    placeId: item.place.id,
    placeName: placeScheduleTitle || item.place.name,
    placeType: item.place.placeType,
    placeTypeLabel: getPlaceTypeLabel(item.place.placeType),
    address: item.place.address,
    ...(placeScheduleMemo ? { placeMemo: placeScheduleMemo } : {}),
  };
}

export function formatScheduleItemTimeLabel(startTime?: string | null, endTime?: string | null): string | undefined {
  if (!startTime) {
    return undefined;
  }
  return endTime ? `${startTime}–${endTime}` : startTime;
}

export function dayItineraryFailureState(status?: number): DayItineraryFailureViewModel {
  if (status === 403 || status === 404) {
    return {
      status: 'notFound',
      title: '일정을 찾을 수 없어요.',
      helper: '삭제되었거나 접근할 수 없는 여행 일정이에요.',
    };
  }

  return {
    status: 'retryableError',
    title: '일정을 불러올 수 없어요.',
    helper: '잠시 후 다시 시도해주세요.',
  };
}
