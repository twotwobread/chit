import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { type GetTripDetailResponse, type TripParticipantListItem } from '@i-um/api-contract';

import { isApiStatus, isMobileAuthSessionError } from '../auth/errors';
import { getStoredSession } from '../auth/session';
import { getTripDetail, listTripParticipants } from '../trips/trip-api';

export type TripDetailState =
  | { status: 'loading' }
  | {
      status: 'success';
      detail: GetTripDetailResponse;
      participants: TripParticipantListItem[];
      participantsLoadFailed: boolean;
      currentUserId?: string;
    }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export function useTripDetailController() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [state, setState] = useState<TripDetailState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    setState({ status: 'loading' });
    try {
      const [detail, participantsResult, session] = await Promise.all([
        getTripDetail(tripId),
        listTripParticipants(tripId).then(
          (response) => ({ status: 'fulfilled' as const, participants: response.participants }),
          () => ({ status: 'rejected' as const, participants: [] as TripParticipantListItem[] }),
        ),
        getStoredSession(),
      ]);
      setState({
        status: 'success',
        detail,
        participants: participantsResult.participants,
        participantsLoadFailed: participantsResult.status === 'rejected',
        currentUserId: session?.user.id,
      });
    } catch (error) {
      setState(tripDetailFailureState(error));
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const goHome = () => {
    router.replace('/');
  };

  const goLogin = () => {
    router.replace('/login');
  };

  return {
    goHome,
    goLogin,
    load,
    state,
  };
}

function tripDetailFailureState(error: unknown): TripDetailState {
  if (isMobileAuthSessionError(error) || isApiStatus(error, 401)) {
    return { status: 'auth' };
  }
  if (isApiStatus(error, 400, 403, 404)) {
    return { status: 'notFound' };
  }
  return { status: 'error' };
}
