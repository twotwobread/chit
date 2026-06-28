import type { ItineraryTimelineItem } from '../trip-ui/itinerary-segments';
import type { DayItineraryViewModel } from './day-itinerary';

export const ITINERARY_TAB_EMPTY_TITLE = '이 Day에 등록된 일정이 없어요.';
export const ITINERARY_TAB_EMPTY_HELPER = '장소를 추가하려면 일정 자세히 보기로 이동해 주세요.';
export const ITINERARY_TAB_DETAIL_CTA_LABEL = '일정 자세히 보기';

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
    status: 'todo',
    isLodging: item.isLodging,
  }));
}
