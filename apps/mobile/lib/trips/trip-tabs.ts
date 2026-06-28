import type { GetTripDetailResponse, TripDay, TripListItem } from '@i-um/api-contract';

import type { AppBarMember } from '../trip-ui/AppBar';
import type { SwitchableTrip } from '../trip-ui/TripSwitcherSheet';
import { formatTripDayDate } from './days';
import { tripDetailPath, tripItineraryPath } from './routes';

export type TripTabUnavailableSurface = 'today' | 'map' | 'settle';

export type TripTabUnavailableViewModel = {
  title: string;
  helper: string;
  primaryAction: {
    label: string;
    route: ReturnType<typeof tripItineraryPath>;
  };
  secondaryAction: {
    label: string;
    route: ReturnType<typeof tripDetailPath>;
  };
};

const unavailableCopy: Record<TripTabUnavailableSurface, { title: string; helper: string }> = {
  today: {
    title: '오늘 일정을 찾을 수 없어요.',
    helper: '이 여행에는 오늘 날짜에 해당하는 Day가 없어요. 전체 일정에서 날짜별 계획을 확인해 주세요.',
  },
  map: {
    title: '오늘 지도에 표시할 일정이 없어요.',
    helper: '지도 탭은 오늘 날짜의 장소를 기준으로 보여줘요. 전체 일정에서 여행 날짜를 확인해 주세요.',
  },
  settle: {
    title: '오늘 정산할 지출을 찾을 수 없어요.',
    helper: '정산 탭은 오늘 날짜의 지출을 기준으로 보여줘요. 전체 일정에서 날짜별 지출을 확인해 주세요.',
  },
};

export function buildTripTabUnavailableViewModel(
  surface: TripTabUnavailableSurface,
  tripId: string,
): TripTabUnavailableViewModel {
  const copy = unavailableCopy[surface];

  return {
    ...copy,
    primaryAction: {
      label: '일정 보기',
      route: tripItineraryPath(tripId),
    },
    secondaryAction: {
      label: '여행 정보 보기',
      route: tripDetailPath(tripId),
    },
  };
}

export function findTripCalendarDay(days: TripDay[], localToday: string): TripDay | null {
  return days.find((day) => day.date === localToday) ?? null;
}

export function buildTripAppBarMembers(detail: GetTripDetailResponse | null): AppBarMember[] {
  if (!detail) {
    return [];
  }

  return detail.participantSummary.previewNames.map((name) => ({ name: name.trim() || '여행자' }));
}

export function buildSwitchableTrips(trips: TripListItem[], currentTripId: string): SwitchableTrip[] {
  return trips.map((trip) => ({
    id: trip.id,
    name: trip.name.trim() || '이름 없는 여행',
    dates: formatTripDateRange(trip.startDate, trip.endDate),
    current: trip.id === currentTripId,
  }));
}

export function formatTripDateRange(startDate: string, endDate: string): string {
  return `${formatTripDayDate(startDate)} ~ ${formatTripDayDate(endDate)}`;
}
