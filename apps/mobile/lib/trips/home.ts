import type { Href } from 'expo-router';

import type { TripListItem } from '@i-um/api-contract';

import { toTripCardViewModel, type MyTripCardViewModel } from './mypage';
import { tripDetailPath, tripTodayPath } from './routes';
import { groupTripsByStatus, localDateString, selectCurrentTrip, type TripStatusSection } from './status';

export type HomeTripCardViewModel = MyTripCardViewModel & {
  detailPath: Href;
};

export type HomeCurrentTripViewModel = HomeTripCardViewModel & {
  resumePath: Href;
  resumeLabel: string;
};

export type HomeTripStatusSectionViewModel = Omit<TripStatusSection, 'trips'> & {
  trips: HomeTripCardViewModel[];
};

export type HomeViewModel = {
  currentTrip: HomeCurrentTripViewModel | null;
  isEmpty: boolean;
  sections: HomeTripStatusSectionViewModel[];
};

export type HomeRootInput =
  | { status: 'loading'; explicitHomeIntent?: boolean }
  | { status: 'needsLogin'; message?: string }
  | { status: 'tripListError'; explicitHomeIntent?: boolean }
  | { status: 'ready'; trips: TripListItem[]; explicitHomeIntent?: boolean; today?: string };

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

  return buildHomeRootViewModel({ explicitHomeIntent, status: 'tripListError' });
}

export function buildHomeRootViewModel(input: HomeRootInput): HomeRootViewModel {
  const explicitHomeIntent = input.status === 'needsLogin' ? false : input.explicitHomeIntent === true;

  if (input.status === 'loading') {
    return explicitHomeIntent
      ? {
          status: 'loading',
          surface: 'home',
          title: '내 여행을 불러오는 중...',
          helper: '여행 목록을 확인하고 있어요.',
          showBottomMenu: true,
        }
      : {
          status: 'loading',
          surface: 'root',
          title: '내 여행을 불러오는 중...',
          helper: '여행 목록을 확인하고 있어요.',
          showBottomMenu: false,
        };
  }

  if (input.status === 'needsLogin') {
    return {
      status: 'needsLogin',
      title: '로그인이 필요해요.',
      helper: input.message ?? '내 여행을 보려면 로그인해주세요.',
      loginPath: '/login',
      showBottomMenu: false,
    };
  }

  if (input.status === 'tripListError') {
    return explicitHomeIntent
      ? {
          status: 'homeError',
          title: '내 여행을 불러올 수 없어요.',
          helper: '잠시 후 다시 시도해주세요.',
          retryLabel: '다시 시도',
          showBottomMenu: true,
        }
      : {
          status: 'rootError',
          title: '내 여행을 불러올 수 없어요.',
          helper: '잠시 후 다시 시도해주세요.',
          retryLabel: '다시 시도',
          showBottomMenu: false,
        };
  }

  const today = input.today ?? localDateString();

  return {
    status: 'home',
    home: buildHomeViewModel(input.trips, today),
    showBottomMenu: true,
  };
}

export function buildHomeViewModel(trips: TripListItem[], today = localDateString()): HomeViewModel {
  const currentTrip = selectCurrentTrip(trips, today);
  const currentTripId = currentTrip?.id ?? null;
  const sections = groupTripsByStatus(trips, today)
    .map((section) => ({
      ...section,
      trips: section.trips.filter((trip) => trip.id !== currentTripId).map(toHomeTripCardViewModel),
    }))
    .filter((section) => section.trips.length > 0);

  return {
    currentTrip: currentTrip ? toHomeCurrentTripViewModel(currentTrip) : null,
    isEmpty: trips.length === 0,
    sections,
  };
}

export function toHomeTripCardViewModel(trip: TripListItem): HomeTripCardViewModel {
  return {
    ...toTripCardViewModel(trip),
    detailPath: tripDetailPath(trip.id),
  };
}

function toHomeCurrentTripViewModel(trip: TripListItem): HomeCurrentTripViewModel {
  return {
    ...toHomeTripCardViewModel(trip),
    resumeLabel: '여행 이어가기',
    resumePath: tripTodayPath(trip.id),
  };
}
