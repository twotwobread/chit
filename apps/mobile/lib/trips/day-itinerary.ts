import type { Href } from 'expo-router';

import type { GetDayScheduleItemsResponse, ScheduleItem, TripPlaceType } from '@i-um/api-contract';

import { theme } from '../design/theme';
import { formatTripDayDate } from './days';

export type DayItineraryRowViewModel = {
  id: string;
  version: number;
  orderLabel: string;
  isLodging?: boolean;
  placeId?: string;
  placeName: string;
  placeType: TripPlaceType;
  placeTypeLabel: string;
  address: string;
};

export type DayItineraryViewModel =
  | {
      status: 'success';
      dayLabel: string;
      formattedDate: string;
      items: DayItineraryRowViewModel[];
    }
  | {
      status: 'empty';
      dayLabel: string;
      formattedDate: string;
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

export function buildDayItineraryRoute(tripId: string, tripDayId: string): Href {
  return `/trips/${tripId}/days/${tripDayId}` as Href;
}

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
      title: '아직 등록된 장소가 없어요.',
      helper: '장소 추가를 눌러 방문할 장소를 검색해보세요.',
    };
  }

  return {
    status: 'success',
    dayLabel,
    formattedDate,
    items: [...scheduleItems]
      .sort((left, right) => left.itemOrder - right.itemOrder)
      .map((item) => ({
        id: item.id,
        version: item.version,
        orderLabel: String(item.itemOrder),
        isLodging: item.isLodging,
        placeId: item.place.id,
        placeName: item.place.name,
        placeType: item.place.placeType,
        placeTypeLabel: getPlaceTypeLabel(item.place.placeType),
        address: item.place.address,
      })),
  };
}

export function getScheduleItems(response: GetDayScheduleItemsResponse): ScheduleItem[] {
  return response.scheduleItems ?? ((response as unknown as { items?: ScheduleItem[] }).items || []);
}

export function buildDayItineraryPlaceAccessibilityLabel(item: DayItineraryRowViewModel): string {
  return `${item.orderLabel}번째 장소 ${item.placeName}. ${item.placeTypeLabel}. ${item.address}`;
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
