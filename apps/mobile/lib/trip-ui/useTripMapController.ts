import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { isApiStatus, isMobileAuthSessionError } from '../auth/errors';
import type { RouteMapPlace } from './RouteMap';
import { getTripDayItinerary } from '../trips/itinerary-api';
import { beginStaleWhileRevalidate, resolveStaleWhileRevalidateFailure } from '../trips/stale-refresh';
import { getTripDetail } from '../trips/trip-api';
import { buildDayItineraryViewModel, getScheduleItems, type DayItineraryViewModel } from '../trips/day-itinerary';
import {
  dayItineraryMapActionFailureState,
  dayItineraryMapActionSuccessState,
  type DayItineraryMapActionFeedback,
} from '../trips/day-itinerary-map-actions';
import { localDateString } from '../trips/status';
import { buildRouteMapPlaces, buildTripMapDayChips, resolveTripMapSelectedDay } from '../trips/trip-map';
import { buildTripTabUnavailableViewModel, type TripTabUnavailableViewModel } from '../trips/trip-tabs';

export type TripMapState =
  | { status: 'loading' }
  | {
      status: 'success';
      dayChips: ReturnType<typeof buildTripMapDayChips>;
      selectedDayId: string;
      viewModel: DayItineraryViewModel;
      mapPlaces: RouteMapPlace[];
    }
  | { status: 'unavailable'; viewModel: TripTabUnavailableViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export function useTripMapController() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const selectedDayIdRef = useRef<string | null>(null);
  const [state, setState] = useState<TripMapState>({ status: 'loading' });
  const [feedback, setFeedback] = useState<DayItineraryMapActionFeedback | null>(null);

  const load = useCallback(
    async (preferredDayId: string | null = selectedDayIdRef.current) => {
      if (!tripId) {
        setState({ status: 'notFound' });
        return;
      }

      setFeedback(null);
      setState((current) => beginStaleWhileRevalidate(current, { status: 'loading' }, ['success', 'unavailable']));
      try {
        const detail = await getTripDetail(tripId);
        const selectedDay = resolveTripMapSelectedDay({
          days: detail.days,
          preferredDayId,
          today: localDateString(),
        });
        if (!selectedDay) {
          selectedDayIdRef.current = null;
          setState({ status: 'unavailable', viewModel: buildTripTabUnavailableViewModel('map', tripId) });
          return;
        }

        const itinerary = await getTripDayItinerary(tripId, selectedDay.id);
        selectedDayIdRef.current = selectedDay.id;
        setState({
          status: 'success',
          dayChips: buildTripMapDayChips(detail.days),
          selectedDayId: selectedDay.id,
          viewModel: buildDayItineraryViewModel(itinerary),
          mapPlaces: buildRouteMapPlaces(getScheduleItems(itinerary)),
        });
      } catch (error) {
        const failureState = mapFailureState(error);
        setState((current) =>
          resolveStaleWhileRevalidateFailure(current, failureState, {
            shouldKeepStale: (state) => state.status === 'error',
            staleStatuses: ['success', 'unavailable'],
          }),
        );
      }
    },
    [tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openMap = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
      setFeedback(dayItineraryMapActionSuccessState('map'));
    } catch {
      setFeedback(dayItineraryMapActionFailureState('map'));
    }
  }, []);

  const copyAddress = useCallback(async (address: string) => {
    try {
      await Clipboard.setStringAsync(address);
      setFeedback(dayItineraryMapActionSuccessState('copy'));
    } catch {
      setFeedback(dayItineraryMapActionFailureState('copy'));
    }
  }, []);

  const goHome = () => {
    router.replace('/');
  };

  const goLogin = () => {
    router.replace('/login');
  };

  return {
    copyAddress,
    feedback,
    goHome,
    goLogin,
    load,
    openMap,
    state,
    tripId,
  };
}

function mapFailureState(error: unknown): TripMapState {
  if (isMobileAuthSessionError(error) || isApiStatus(error, 401)) {
    return { status: 'auth' };
  }
  if (isApiStatus(error, 400, 403, 404)) {
    return { status: 'notFound' };
  }
  return { status: 'error' };
}
