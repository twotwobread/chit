import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { isApiStatus, isMobileAuthSessionError } from '../auth/errors';
import type { RouteMapPlace, RouteMapPolyline } from './RouteMap';
import type { GetDayScheduleItemsResponse, TripDay } from '@i-um/api-contract';
import { getTripDayItinerary } from '../trips/itinerary-api';
import { beginStaleWhileRevalidate, resolveStaleWhileRevalidateFailure } from '../trips/stale-refresh';
import { getTripDetail } from '../trips/trip-api';
import { buildDayItineraryViewModel, type DayItineraryViewModel } from '../trips/day-itinerary';
import {
  dayItineraryMapActionFailureState,
  dayItineraryMapActionSuccessState,
  type DayItineraryMapActionFeedback,
} from '../trips/day-itinerary-map-actions';
import { localDateString } from '../trips/status';
import {
  buildTripMapDayRoutes,
  buildTripMapRouteLayerChips,
  buildTripMapRouteLayerViewModel,
  emptyTripMapRouteLayerSelection,
  resolveTripMapSelectedDay,
  toggleTripMapRouteLayer,
  tripMapRouteLayerChipId,
  type TripMapDayRoute,
  type TripMapRouteLayerChipId,
  type TripMapRouteLayerSelection,
  type TripMapRouteNotice,
} from '../trips/trip-map';
import { buildTripTabUnavailableViewModel, type TripTabUnavailableViewModel } from '../trips/trip-tabs';

export type TripMapState =
  | { status: 'loading' }
  | {
      status: 'success';
      dayRoutes: TripMapDayRoute[];
      mapPlaces: RouteMapPlace[];
      routeChips: ReturnType<typeof buildTripMapRouteLayerChips>;
      routeLayer: TripMapRouteLayerSelection;
      routeNotice: TripMapRouteNotice | null;
      routePolylines: RouteMapPolyline[];
      selectedDayId: string;
      selectedRouteLayerChipId: TripMapRouteLayerChipId | null;
      viewModel: DayItineraryViewModel;
    }
  | { status: 'unavailable'; viewModel: TripTabUnavailableViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export function useTripMapController() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const routeLayerRef = useRef<TripMapRouteLayerSelection>(emptyTripMapRouteLayerSelection);
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

        const itineraries = await Promise.all(
          detail.days
            .slice()
            .sort((left, right) => left.dayOrder - right.dayOrder)
            .map((day) => getTripDayItinerary(tripId, day.id)),
        );
        const dayRoutes = buildTripMapDayRoutes(itineraries);
        const routeLayer = resolveAvailableRouteLayer(routeLayerRef.current, dayRoutes);
        const routeViewModel = buildTripMapRouteLayerViewModel(dayRoutes, routeLayer);
        const selectedItinerary = resolveSelectedItinerary(itineraries, selectedDay.id);
        routeLayerRef.current = routeLayer;
        selectedDayIdRef.current = selectedDay.id;
        setState({
          status: 'success',
          dayRoutes,
          mapPlaces: routeViewModel.places,
          routeChips: buildTripMapRouteLayerChips(detail.days),
          routeLayer,
          routeNotice: routeViewModel.notice,
          routePolylines: routeViewModel.polylines,
          selectedDayId: selectedDay.id,
          selectedRouteLayerChipId: tripMapRouteLayerChipId(routeLayer),
          viewModel: buildDayItineraryViewModel(selectedItinerary),
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

  const toggleRouteLayer = useCallback((chipId: TripMapRouteLayerChipId) => {
    setFeedback(null);
    setState((current) => {
      if (current.status !== 'success') {
        return current;
      }

      const routeLayer = toggleTripMapRouteLayer(current.routeLayer, chipId);
      const routeViewModel = buildTripMapRouteLayerViewModel(current.dayRoutes, routeLayer);
      const selectedDayId = routeLayer.kind === 'day' ? routeLayer.dayId : current.selectedDayId;
      routeLayerRef.current = routeLayer;
      selectedDayIdRef.current = selectedDayId;

      return {
        ...current,
        mapPlaces: routeViewModel.places,
        routeLayer,
        routeNotice: routeViewModel.notice,
        routePolylines: routeViewModel.polylines,
        selectedDayId,
        selectedRouteLayerChipId: tripMapRouteLayerChipId(routeLayer),
      };
    });
  }, []);

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
    toggleRouteLayer,
    tripId,
  };
}

function resolveAvailableRouteLayer(
  routeLayer: TripMapRouteLayerSelection,
  dayRoutes: TripMapDayRoute[],
): TripMapRouteLayerSelection {
  if (routeLayer.kind !== 'day') {
    return routeLayer;
  }
  return dayRoutes.some((route) => route.dayId === routeLayer.dayId) ? routeLayer : emptyTripMapRouteLayerSelection;
}

function resolveSelectedItinerary(
  itineraries: GetDayScheduleItemsResponse[],
  selectedDayId: string,
): GetDayScheduleItemsResponse {
  return (
    itineraries.find((itinerary) => itinerary.day.id === selectedDayId) ??
    itineraries[0] ??
    emptyItinerary(selectedDayId)
  );
}

function emptyItinerary(dayId: string): GetDayScheduleItemsResponse {
  return {
    day: { date: '', dayOrder: 1, id: dayId, lodgingPlace: null } satisfies TripDay,
    scheduleItems: [],
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
