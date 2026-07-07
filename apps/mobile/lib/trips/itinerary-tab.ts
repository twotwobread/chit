import type { ItineraryTimelineItem } from '../trip-ui/itinerary-segments';
import type { DayItineraryViewModel } from './day-itinerary';

export const ITINERARY_TAB_EMPTY_TITLE = '이 Day에 등록된 일정이 없어요.';
export const ITINERARY_TAB_EMPTY_HELPER = '일정 추가에서 장소를 검색하거나 장소 없이 일정을 등록해 주세요.';
export const ITINERARY_TAB_ADD_CTA_LABEL = '일정 추가';
export const ITINERARY_TAB_REORDER_CTA_LABEL = '순서 변경';

export function buildItineraryTimelineItems(viewModel: DayItineraryViewModel): ItineraryTimelineItem[] {
  if (viewModel.status !== 'success') {
    return [];
  }

  return viewModel.items.map((item) => ({
    id: item.id,
    order: Number(item.orderLabel),
    type: item.placeType,
    name: item.placeName,
    area: item.address || item.placeTypeLabel,
    startTime: item.startTime,
    endTime: item.endTime,
    status: dayItineraryStatusToTimelineStatus(item.statusLabel),
    isLodging: item.isLodging,
  }));
}

function dayItineraryStatusToTimelineStatus(statusLabel?: string): ItineraryTimelineItem['status'] {
  switch (statusLabel) {
    case '완료':
      return 'done';
    case '건너뜀':
      return 'skipped';
    default:
      return 'todo';
  }
}
