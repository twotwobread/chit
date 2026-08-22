import type { Href } from 'expo-router';

import type { GetMySettlementSummaryResponse, MeetingListItem, TripListItem } from '@i-um/api-contract';

import { toTripCardViewModel, type MyTripCardViewModel, formatTripDateRange } from './mypage';
import { formatMoney } from './quick-expense';
import { tripSettlePath, tripTodayPath } from './routes';
import { groupTripsByStatus, localDateString, type TripStatusSection } from './status';

export type HomeTripCardViewModel = MyTripCardViewModel & {
  detailPath: Href;
  meetingContextLabel: string;
};

export type HomeCurrentTripViewModel = HomeTripCardViewModel & {
  resumePath: Href;
  resumeLabel: string;
};

export type HomeTripStatusSectionViewModel = Omit<TripStatusSection, 'trips'> & {
  trips: HomeTripCardViewModel[];
};

export type HomeSavedMeetingViewModel = MeetingListItem & {
  memberCountLabel: string;
  roleLabel: string;
};

export type HomeSettlementTaskViewModel = {
  tripId: string;
  tripName: string;
  dateRangeLabel: string;
  route: Href;
  summaryLabels: string[];
};

export type HomeDashboardInput = {
  trips: TripListItem[];
  meetings?: MeetingListItem[];
  settlementSummary?: GetMySettlementSummaryResponse;
};

export type HomeViewModel = {
  currentTrip: HomeCurrentTripViewModel | null;
  ongoingTrips: HomeCurrentTripViewModel[];
  hasVisibleTrips: boolean;
  isEmpty: boolean;
  sections: HomeTripStatusSectionViewModel[];
  savedMeetings: HomeSavedMeetingViewModel[];
  settlementTasks: HomeSettlementTaskViewModel[];
};

export type HomeRootInput =
  | { status: 'loading'; explicitHomeIntent?: boolean }
  | { status: 'needsLogin'; message?: string }
  | { status: 'homeDashboardError'; explicitHomeIntent?: boolean }
  | { status: 'tripListError'; explicitHomeIntent?: boolean }
  | {
      status: 'ready';
      trips: TripListItem[];
      meetings?: MeetingListItem[];
      settlementSummary?: GetMySettlementSummaryResponse;
      explicitHomeIntent?: boolean;
      today?: string;
    };

export type HomeRootViewModel =
  | {
      status: 'loading';
      surface: 'root' | 'home';
      title: string;
      helper: string;
      showBottomMenu: boolean;
    }
  | {
      status: 'needsLogin';
      title: string;
      helper: string;
      loginPath: '/login';
      showBottomMenu: false;
    }
  | {
      status: 'rootError' | 'homeError';
      title: string;
      helper: string;
      retryLabel: string;
      showBottomMenu: boolean;
    }
  | {
      status: 'home';
      home: HomeViewModel;
      showBottomMenu: true;
    };

export function buildHomeRootRefreshStartViewModel(
  current: HomeRootViewModel,
  explicitHomeIntent: boolean,
): HomeRootViewModel {
  if (current.status === 'home') {
    return current;
  }

  return buildHomeRootViewModel({ explicitHomeIntent, status: 'loading' });
}

export function buildHomeRootRefreshFailureViewModel(
  current: HomeRootViewModel,
  explicitHomeIntent: boolean,
): HomeRootViewModel {
  if (current.status === 'home') {
    return current;
  }

  return buildHomeRootViewModel({ explicitHomeIntent, status: 'homeDashboardError' });
}

export function buildHomeRootViewModel(input: HomeRootInput): HomeRootViewModel {
  const explicitHomeIntent = input.status === 'needsLogin' ? false : input.explicitHomeIntent === true;

  if (input.status === 'loading') {
    return explicitHomeIntent
      ? {
          status: 'loading',
          surface: 'home',
          title: '일정을 불러오는 중...',
          helper: '다가오는 일정과 모임을 확인하고 있어요.',
          showBottomMenu: true,
        }
      : {
          status: 'loading',
          surface: 'root',
          title: '일정을 불러오는 중...',
          helper: '다가오는 일정과 모임을 확인하고 있어요.',
          showBottomMenu: false,
        };
  }

  if (input.status === 'needsLogin') {
    return {
      status: 'needsLogin',
      title: '로그인이 필요해요.',
      helper: input.message ?? '내 일정과 모임을 보려면 로그인해주세요.',
      loginPath: '/login',
      showBottomMenu: false,
    };
  }

  if (input.status === 'homeDashboardError' || input.status === 'tripListError') {
    return explicitHomeIntent
      ? {
          status: 'homeError',
          title: '홈을 불러올 수 없어요.',
          helper: '일정과 모임 정보를 다시 확인해주세요.',
          retryLabel: '다시 시도',
          showBottomMenu: true,
        }
      : {
          status: 'rootError',
          title: '홈을 불러올 수 없어요.',
          helper: '일정과 모임 정보를 다시 확인해주세요.',
          retryLabel: '다시 시도',
          showBottomMenu: false,
        };
  }

  if (input.status === 'ready') {
    const today = input.today ?? localDateString();

    return {
      status: 'home',
      home: buildHomeViewModel(
        {
          meetings: input.meetings ?? [],
          settlementSummary: input.settlementSummary,
          trips: input.trips,
        },
        today,
      ),
      showBottomMenu: true,
    };
  }

  const exhaustive: never = input;
  throw new Error(`Unsupported Home root input: ${exhaustive}`);
}

export function buildHomeViewModel(
  input: HomeDashboardInput | TripListItem[],
  today = localDateString(),
): HomeViewModel {
  const dashboardInput = Array.isArray(input) ? { trips: input } : input;
  const trips = dashboardInput.trips;
  const groupedSections = groupTripsByStatus(trips, today);
  const ongoingTrips =
    groupedSections.find((section) => section.status === 'ongoing')?.trips.map(toHomeCurrentTripViewModel) ?? [];
  const sections = groupedSections
    .filter((section) => section.status === 'upcoming' || section.status === 'past')
    .map((section) => ({
      ...section,
      title: homeScheduleSectionTitle(section.status),
      trips: section.trips.map(toHomeTripCardViewModel),
    }))
    .filter((section) => section.trips.length > 0);
  const savedMeetings = (dashboardInput.meetings ?? [])
    .filter((meeting) => meeting.visibility === 'saved')
    .map(toHomeSavedMeetingViewModel);
  const settlementTasks = (dashboardInput.settlementSummary?.trips ?? []).map((trip) => ({
    tripId: trip.tripId,
    tripName: trip.tripName,
    dateRangeLabel: formatTripDateRange(trip.startDate, trip.endDate),
    route: tripSettlePath(trip.tripId),
    summaryLabels: trip.currencySummaries.map(
      (summary) =>
        `${mySettlementDirectionLabel(summary.direction)} ${formatMoney(summary.netMinor, summary.currency)}`,
    ),
  }));
  const hasVisibleTrips = ongoingTrips.length > 0 || sections.length > 0;

  return {
    currentTrip: ongoingTrips[0] ?? null,
    ongoingTrips,
    hasVisibleTrips,
    isEmpty: !hasVisibleTrips && savedMeetings.length === 0 && settlementTasks.length === 0,
    sections,
    savedMeetings,
    settlementTasks,
  };
}

export function toHomeTripCardViewModel(trip: TripListItem): HomeTripCardViewModel {
  const base = toTripCardViewModel(trip);
  const meetingContextLabel = tripMeetingContextLabel(trip);

  return {
    ...base,
    detailPath: tripTodayPath(trip.id),
    meetingContextLabel,
    metaLabels: [...base.metaLabels, meetingContextLabel],
  };
}

function toHomeCurrentTripViewModel(trip: TripListItem): HomeCurrentTripViewModel {
  return {
    ...toHomeTripCardViewModel(trip),
    resumeLabel: '일정 이어가기',
    resumePath: tripTodayPath(trip.id),
  };
}

function toHomeSavedMeetingViewModel(meeting: MeetingListItem): HomeSavedMeetingViewModel {
  return {
    ...meeting,
    memberCountLabel: `멤버 ${meeting.memberCount}명`,
    roleLabel: meeting.myRole === 'owner' ? '내가 만든 모임' : '함께하는 모임',
  };
}

function tripMeetingContextLabel(trip: TripListItem): string {
  if (trip.eventContext?.meetingVisibility === 'one_off') {
    return '이번만 함께하기';
  }
  return trip.eventContext?.meetingName?.trim() || '모임 미지정';
}

function homeScheduleSectionTitle(status: TripStatusSection['status']): string {
  switch (status) {
    case 'upcoming':
      return '다가오는 일정';
    case 'past':
      return '지난 일정';
    case 'ongoing':
      return '진행 중인 일정';
    default: {
      const exhaustive: never = status;
      throw new Error(`Unsupported home schedule section: ${exhaustive}`);
    }
  }
}

function mySettlementDirectionLabel(direction: 'send' | 'receive'): string {
  switch (direction) {
    case 'send':
      return '보낼 금액';
    case 'receive':
      return '받을 금액';
    default: {
      const exhaustive: never = direction;
      throw new Error(`Unsupported settlement direction: ${exhaustive}`);
    }
  }
}
