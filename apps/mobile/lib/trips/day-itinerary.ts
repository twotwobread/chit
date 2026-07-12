import type {
  GetDayScheduleItemsResponse,
  NonPlaceScheduleItemCategory,
  NonPlaceTransportMode,
  ScheduleItem,
  TripPlaceSummary,
  TripPlaceType,
} from '@i-um/api-contract';

import { theme } from '../design/theme';
import { formatTripDayDate } from './days';

export type DayItineraryRowViewModel = {
  id: string;
  version: number;
  orderLabel: string;
  isLodging?: boolean;
  statusLabel?: string;
  startTime?: string | null;
  endTime?: string | null;
  timeLabel?: string;
  itemType?: 'place' | 'non_place';
  placeId?: string;
  placeName: string;
  placeType: TripPlaceType;
  placeTypeLabel: string;
  address: string;
  nonPlaceCategory?: NonPlaceScheduleItemCategory;
  nonPlaceCategoryLabel?: string;
  nonPlaceDetailLabel?: string;
  nonPlaceMemo?: string;
  nonPlaceLink?: string;
  transportMode?: NonPlaceTransportMode;
  referenceNumber?: string;
  bookingReference?: string;
  originText?: string;
  destinationText?: string;
  terminalText?: string;
  gateText?: string;
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
      helper: '일정 추가를 눌러 방문할 장소나 장소 없는 일정을 등록해보세요.',
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

export function getScheduleItems(response: GetDayScheduleItemsResponse): ScheduleItem[] {
  return response.scheduleItems ?? ((response as unknown as { items?: ScheduleItem[] }).items || []);
}

export function buildDayItineraryPlaceAccessibilityLabel(item: DayItineraryRowViewModel): string {
  const timeText = item.timeLabel ? `${item.timeLabel}. ` : '';
  const rowKind = item.itemType === 'non_place' ? '일정' : '장소';
  return `${item.orderLabel}번째 ${rowKind} ${timeText}${item.placeName}. ${item.placeTypeLabel}`;
}

export function getNonPlaceCategoryLabel(category: NonPlaceScheduleItemCategory): string {
  switch (category) {
    case 'transport':
      return '이동';
    case 'rest':
      return '휴식';
    case 'memo':
      return '메모';
    case 'reminder':
      return '알림';
  }
}

export function getTransportModeLabel(mode: NonPlaceTransportMode): string {
  switch (mode) {
    case 'flight':
      return '비행기';
    case 'train':
      return '기차';
    case 'bus':
      return '버스';
    case 'ferry':
      return '페리';
    case 'other':
      return '기타';
  }
}

export function buildNonPlaceDetailLabel(item: ScheduleItem): string | undefined {
  const details = item.nonPlace;
  if (!details) {
    return undefined;
  }
  if (details.category === 'transport') {
    const parts: string[] = [];
    if (details.transportMode) {
      parts.push(getTransportModeLabel(details.transportMode));
    }
    const route = [details.originText, details.destinationText].filter(Boolean).join(' → ');
    if (route) {
      parts.push(route);
    }
    const meta = [details.referenceNumber, details.terminalText, details.gateText].filter(Boolean).join(' · ');
    if (meta) {
      parts.push(meta);
    }
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }
  return details.memo ?? undefined;
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

function scheduleItemToDayItineraryRow(item: ScheduleItem): DayItineraryRowViewModel {
  if (item.itemType === 'non_place' && item.nonPlace) {
    const categoryLabel = getNonPlaceCategoryLabel(item.nonPlace.category);
    const statusLabel = buildScheduleItemStatusLabel(item);
    return {
      id: item.id,
      version: item.version,
      orderLabel: String(item.itemOrder),
      itemType: 'non_place',
      isLodging: false,
      ...(statusLabel ? { statusLabel } : {}),
      startTime: item.startTime,
      endTime: item.endTime,
      timeLabel: formatScheduleItemTimeLabel(item.startTime, item.endTime),
      placeName: item.nonPlace.title,
      placeType: 'etc',
      placeTypeLabel: categoryLabel,
      address: buildNonPlaceDetailLabel(item) ?? '',
      nonPlaceCategory: item.nonPlace.category,
      nonPlaceCategoryLabel: categoryLabel,
      nonPlaceDetailLabel: buildNonPlaceDetailLabel(item),
      ...(item.nonPlace.memo ? { nonPlaceMemo: item.nonPlace.memo } : {}),
      ...(item.nonPlace.link ? { nonPlaceLink: item.nonPlace.link } : {}),
      ...(item.nonPlace.transportMode ? { transportMode: item.nonPlace.transportMode } : {}),
      ...(item.nonPlace.referenceNumber ? { referenceNumber: item.nonPlace.referenceNumber } : {}),
      ...(item.nonPlace.bookingReference ? { bookingReference: item.nonPlace.bookingReference } : {}),
      ...(item.nonPlace.originText ? { originText: item.nonPlace.originText } : {}),
      ...(item.nonPlace.destinationText ? { destinationText: item.nonPlace.destinationText } : {}),
      ...(item.nonPlace.terminalText ? { terminalText: item.nonPlace.terminalText } : {}),
      ...(item.nonPlace.gateText ? { gateText: item.nonPlace.gateText } : {}),
    };
  }

  if (!item.place) {
    const statusLabel = buildScheduleItemStatusLabel(item);
    return {
      id: item.id,
      version: item.version,
      orderLabel: String(item.itemOrder),
      itemType: 'non_place',
      isLodging: false,
      ...(statusLabel ? { statusLabel } : {}),
      startTime: item.startTime,
      endTime: item.endTime,
      timeLabel: formatScheduleItemTimeLabel(item.startTime, item.endTime),
      placeName: '장소 없는 일정',
      placeType: 'etc',
      placeTypeLabel: '일정',
      address: '',
    };
  }

  const statusLabel = buildScheduleItemStatusLabel(item);
  const placeScheduleTitle = item.placeSchedule?.title?.trim();
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
