import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { type GetTripDetailResponse, type TripParticipantListItem } from '@i-um/api-contract';

import { apiErrorStatus, isApiStatus, isMobileAuthSessionError } from '../auth/errors';
import { getStoredSession } from '../auth/session';
import {
  buildPromoteMeetingSuccessMessage,
  promoteMeetingFailureMessage,
  validatePromoteMeetingName,
  type PromoteMeetingState,
} from '../trips/promote-meeting';
import { beginStaleWhileRevalidate, resolveStaleWhileRevalidateFailure } from '../trips/stale-refresh';
import { resolveTripShellDetail } from '../trips/trip-shell-detail';
import { useTripShellState } from '../trips/trip-shell-context';
import { listTripParticipants, promoteTripMeeting } from '../trips/trip-api';

export type TripDetailState =
  | { status: 'loading' }
  | {
      status: 'success';
      detail: GetTripDetailResponse;
      participants: TripParticipantListItem[];
      participantsLoadFailed: boolean;
      currentUserId?: string;
      promotionState: PromoteMeetingState;
    }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export function useTripDetailController() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const shellState = useTripShellState();
  const [state, setState] = useState<TripDetailState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    setState((current) => beginStaleWhileRevalidate(current, { status: 'loading' }, ['success']));
    const shellDetail = resolveTripShellDetail(shellState, tripId);
    if (shellDetail.status === 'pending') {
      return;
    }
    if (shellDetail.status !== 'success') {
      setState(tripDetailShellFailureState(shellDetail.status));
      return;
    }

    try {
      const detail = shellDetail.detail;
      const [participantsResult, session] = await Promise.all([
        listTripParticipants(tripId).then(
          (response) => ({ status: 'fulfilled' as const, participants: response.participants }),
          () => ({ status: 'rejected' as const, participants: [] as TripParticipantListItem[] }),
        ),
        getStoredSession(),
      ]);
      setState((current) => ({
        status: 'success',
        detail,
        participants: participantsResult.participants,
        participantsLoadFailed: participantsResult.status === 'rejected',
        currentUserId: session?.user.id,
        promotionState:
          detail.trip.eventContext?.meetingVisibility === 'one_off'
            ? previousPromotionState(current)
            : { status: 'idle' },
      }));
    } catch (error) {
      const failureState = tripDetailFailureState(error);
      setState((current) =>
        resolveStaleWhileRevalidateFailure(current, failureState, {
          shouldKeepStale: (state) => state.status === 'error',
          staleStatuses: ['success'],
        }),
      );
    }
  }, [shellState, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const promoteMeeting = useCallback(
    async (meetingName: string) => {
      if (!tripId) {
        return;
      }
      const validationMessage = validatePromoteMeetingName(meetingName);
      if (validationMessage) {
        setState((current) => withPromotionState(current, { status: 'error', message: validationMessage }));
        return;
      }

      const trimmedName = meetingName.trim();
      setState((current) => withPromotionState(current, { status: 'submitting' }));
      try {
        const response = await promoteTripMeeting(tripId, { meetingName: trimmedName });
        setState((current) => {
          if (current.status !== 'success') {
            return current;
          }
          return {
            ...current,
            detail: { ...current.detail, trip: response.trip },
            promotionState: { status: 'success', message: buildPromoteMeetingSuccessMessage(response.meeting.name) },
          };
        });
      } catch (error) {
        const status = apiErrorStatus(error);
        setState((current) =>
          withPromotionState(current, { status: 'error', message: promoteMeetingFailureMessage(status) }),
        );
      }
    },
    [tripId],
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
    promoteMeeting,
    state,
  };
}

function previousPromotionState(state: TripDetailState): PromoteMeetingState {
  if (state.status === 'success') {
    return state.promotionState;
  }
  return { status: 'idle' };
}

function withPromotionState(state: TripDetailState, promotionState: PromoteMeetingState): TripDetailState {
  if (state.status !== 'success') {
    return state;
  }
  return { ...state, promotionState };
}

function tripDetailShellFailureState(status: 'auth' | 'notFound' | 'error'): TripDetailState {
  return { status };
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
