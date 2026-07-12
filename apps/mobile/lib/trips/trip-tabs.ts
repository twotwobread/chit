import type { GetTripDetailResponse, TripDay, TripListItem } from '@i-um/api-contract';

import type { AppBarMember } from '../trip-ui/AppBar';
import type { SwitchableTrip } from '../trip-ui/TripSwitcherSheet';
import { formatTripDayDate } from './days';
import { tripDetailPath, tripItineraryPath, tripSettlePath } from './routes';
import { tripStatus } from './status';

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

export type TripTodayStatusLandingViewModel = {
  status: 'upcoming' | 'past';
  tone: 'amber' | 'muted';
  eyebrow: string;
  heroLabel: string;
  title: string;
  helper: string;
  primaryAction: {
    label: string;
    route: ReturnType<typeof tripItineraryPath> | ReturnType<typeof tripSettlePath>;
  };
  secondaryAction?: {
    label: string;
    route: ReturnType<typeof tripItineraryPath>;
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

export function buildTripTodayStatusLandingViewModel(
  detail: GetTripDetailResponse,
  localToday: string,
): TripTodayStatusLandingViewModel | null {
  const trip = detail.trip;
  const status = tripStatus(
    {
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      defaultCurrency: trip.defaultCurrency,
      createdAt: trip.createdAt,
      joinedAt: trip.createdAt,
      myRole: 'member',
      participantCount: detail.participantSummary.totalCount,
    },
    localToday,
  );
  const tripName = trip.name.trim() || '여행';

  if (status === 'upcoming') {
    const daysUntil = daysBetween(localToday, trip.startDate);
    return {
      status: 'upcoming',
      tone: 'amber',
      eyebrow: '다가오는 여행',
      heroLabel: `D-${daysUntil}`,
      title: `${tripName}까지 ${daysUntil}일 남았어요.`,
      helper: '여행 전 설레는 마음으로 Day별 일정을 준비해보세요.',
      primaryAction: { label: '일정 준비하기', route: tripItineraryPath(trip.id) },
    };
  }

  if (status === 'past') {
    return {
      status: 'past',
      tone: 'muted',
      eyebrow: '다녀온 여행',
      heroLabel: '여행 완료',
      title: `${tripName}은 다녀온 여행입니다.`,
      helper: '여행은 끝났지만 지출과 정산을 계속 확인할 수 있어요.',
      primaryAction: { label: '지출·정산 확인하기', route: tripSettlePath(trip.id) },
      secondaryAction: { label: '전체 일정 보기', route: tripItineraryPath(trip.id) },
    };
  }

  return null;
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

function daysBetween(fromDate: string, toDate: string): number {
  const diff = dateToUtcTimestamp(toDate) - dateToUtcTimestamp(fromDate);
  return Math.max(1, Math.round(diff / 86_400_000));
}

function dateToUtcTimestamp(date: string): number {
  const [year = '0', month = '1', day = '1'] = date.split('-');
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}
