import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { isApiStatus, isMobileAuthSessionError } from '../auth/errors';
import type { RouteMapPlace, RouteMapPolyline } from './RouteMap';
import type { GetDayScheduleItemsResponse, TripDay } from '@i-um/api-contract';
import { createGoogleTripPlaceBookmark, deleteTripPlaceBookmark, listTripPlaceBookmarks } from '../places/client';
import { tripPlaceBookmarkToGoogleSearchRow } from '../places/bookmarks';
import {
  addingGooglePlaceState,
  errorGooglePlaceAddState,
  idleGooglePlaceAddState,
  type GooglePlaceAddViewState,
  type GooglePlaceSearchRowViewModel,
  type GooglePlaceTripDestination,
} from '../places/google-search';
import { listTripScheduleItems } from '../trips/itinerary-api';
import { beginStaleWhileRevalidate, resolveStaleWhileRevalidateFailure } from '../trips/stale-refresh';
import { resolveTripShellDetail } from '../trips/trip-shell-detail';
import { useTripShellState } from '../trips/trip-shell-context';
import { buildDayItineraryViewModel, type DayItineraryViewModel } from '../trips/day-itinerary';
import {
  dayItineraryMapActionFailureState,
  dayItineraryMapActionSuccessState,
  type DayItineraryMapActionFeedback,
} from '../trips/day-itinerary-map-actions';
import { localDateString } from '../trips/status';
import {
  buildTripItinerariesFromTripScheduleItems,
  buildTripMapDayRoutes,
  buildTripMapRouteLayerChips,
  buildTripMapRouteLayerViewModel,
  buildTripMapScheduleMarkerDetail,
  emptyTripMapRouteLayerSelection,
  resolveTripMapSelectedDay,
  toggleTripMapRouteLayer,
  tripMapRouteLayerChipId,
  type TripMapDayRoute,
  type TripMapRouteLayerChipId,
  type TripMapRouteLayerSelection,
  type TripMapRouteNotice,
  type TripMapScheduleMarkerDetail,
} from '../trips/trip-map';
import { buildTripTabUnavailableViewModel, type TripTabUnavailableViewModel } from '../trips/trip-tabs';

export type TripMapState =
  | { status: 'loading' }
  | {
      status: 'success';
      allBookmarkResults: GooglePlaceSearchRowViewModel[];
      bookmarkLayerVisible: boolean;
      bookmarkResults: GooglePlaceSearchRowViewModel[];
      dayRoutes: TripMapDayRoute[];
      mapPlaces: RouteMapPlace[];
      routeChips: ReturnType<typeof buildTripMapRouteLayerChips>;
      routeLayer: TripMapRouteLayerSelection;
      routeNotice: TripMapRouteNotice | null;
      routePolylines: RouteMapPolyline[];
      selectedDayId: string;
      selectedRouteLayerChipId: TripMapRouteLayerChipId | null;
      tripDestinations: GooglePlaceTripDestination[];
      selectedRoutePlaceId: string | null;
      scheduleMarkerDetail: TripMapScheduleMarkerDetail | null;
      viewModel: DayItineraryViewModel;
    }
  | { status: 'unavailable'; viewModel: TripTabUnavailableViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export function useTripMapController() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const shellState = useTripShellState();
  const routeLayerRef = useRef<TripMapRouteLayerSelection>(emptyTripMapRouteLayerSelection);
  const selectedDayIdRef = useRef<string | null>(null);
  const bookmarkLayerVisibleRef = useRef(true);
  const selectedRoutePlaceIdRef = useRef<string | null>(null);
  const [state, setState] = useState<TripMapState>({ status: 'loading' });
  const [feedback, setFeedback] = useState<DayItineraryMapActionFeedback | null>(null);
  const [bookmarkActionState, setBookmarkActionState] = useState<GooglePlaceAddViewState>(idleGooglePlaceAddState());

  const load = useCallback(
    async (preferredDayId: string | null = selectedDayIdRef.current) => {
      if (!tripId) {
        setState({ status: 'notFound' });
        return;
      }

      setFeedback(null);
      setState((current) => beginStaleWhileRevalidate(current, { status: 'loading' }, ['success', 'unavailable']));

      const shellDetail = resolveTripShellDetail(shellState, tripId);
      if (shellDetail.status === 'pending') {
        return;
      }
      if (shellDetail.status !== 'success') {
        setState(mapShellFailureState(shellDetail.status));
        return;
      }

      try {
        const detail = shellDetail.detail;
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

        const [scheduleResponse, bookmarkResponse] = await Promise.all([
          listTripScheduleItems(tripId),
          listTripPlaceBookmarks(tripId),
        ]);
        const itineraries = buildTripItinerariesFromTripScheduleItems(detail.days, scheduleResponse);
        const dayRoutes = buildTripMapDayRoutes(itineraries);
        const routeLayer = resolveAvailableRouteLayer(routeLayerRef.current, dayRoutes);
        const routeViewModel = buildTripMapRouteLayerViewModel(dayRoutes, routeLayer);
        const selectedItinerary = resolveSelectedItinerary(itineraries, selectedDay.id);
        routeLayerRef.current = routeLayer;
        selectedDayIdRef.current = selectedDay.id;
        const viewModel = buildDayItineraryViewModel(selectedItinerary);
        const selectedRoutePlaceId = selectedRoutePlaceIdRef.current;
        const bookmarkResults = bookmarkResponse.bookmarks.flatMap((bookmark) => {
          const row = tripPlaceBookmarkToGoogleSearchRow(bookmark);
          return row ? [row] : [];
        });
        setState({
          status: 'success',
          allBookmarkResults: bookmarkResults,
          bookmarkLayerVisible: bookmarkLayerVisibleRef.current,
          bookmarkResults: bookmarkLayerVisibleRef.current ? bookmarkResults : [],
          dayRoutes,
          mapPlaces: routeViewModel.places,
          routeChips: buildTripMapRouteLayerChips(detail.days),
          routeLayer,
          routeNotice: routeViewModel.notice,
          routePolylines: routeViewModel.polylines,
          selectedDayId: selectedDay.id,
          selectedRouteLayerChipId: tripMapRouteLayerChipId(routeLayer),
          selectedRoutePlaceId,
          tripDestinations: detail.trip.destinations,
          scheduleMarkerDetail: buildTripMapScheduleMarkerDetail(viewModel, selectedRoutePlaceId),
          viewModel,
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
    [shellState, tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggleRouteLayer = useCallback((chipId: TripMapRouteLayerChipId) => {
    setFeedback(null);
    selectedRoutePlaceIdRef.current = null;
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
        selectedRoutePlaceId: null,
        scheduleMarkerDetail: null,
      };
    });
  }, []);

  const toggleBookmarkLayer = useCallback(() => {
    setState((current) => {
      if (current.status !== 'success') {
        return current;
      }
      const bookmarkLayerVisible = !current.bookmarkLayerVisible;
      bookmarkLayerVisibleRef.current = bookmarkLayerVisible;
      return {
        ...current,
        bookmarkLayerVisible,
        bookmarkResults: bookmarkLayerVisible ? current.allBookmarkResults : [],
      };
    });
  }, []);

  const selectRoutePlace = useCallback((place: RouteMapPlace) => {
    selectedRoutePlaceIdRef.current = place.id;
    setState((current) => {
      if (current.status !== 'success') {
        return current;
      }
      return {
        ...current,
        selectedRoutePlaceId: place.id,
        scheduleMarkerDetail: buildTripMapScheduleMarkerDetail(current.viewModel, place.id),
      };
    });
  }, []);

  const clearRoutePlaceSelection = useCallback(() => {
    selectedRoutePlaceIdRef.current = null;
    setState((current) => {
      if (current.status !== 'success') {
        return current;
      }
      return {
        ...current,
        selectedRoutePlaceId: null,
        scheduleMarkerDetail: null,
      };
    });
  }, []);

  const resetBookmarkActionState = useCallback(() => {
    setBookmarkActionState(idleGooglePlaceAddState());
  }, []);

  const createBookmark = useCallback(
    async (result: GooglePlaceSearchRowViewModel) => {
      if (!tripId || bookmarkActionState.status === 'adding') {
        return;
      }
      setBookmarkActionState(addingGooglePlaceState(result.id));
      try {
        await createGoogleTripPlaceBookmark(tripId, { googlePlaceId: result.id });
        setBookmarkActionState(idleGooglePlaceAddState());
        bookmarkLayerVisibleRef.current = true;
        await load();
      } catch {
        setBookmarkActionState(errorGooglePlaceAddState());
      }
    },
    [bookmarkActionState.status, load, tripId],
  );

  const deleteBookmark = useCallback(
    async (result: GooglePlaceSearchRowViewModel) => {
      if (!tripId || !result.bookmarkId || bookmarkActionState.status === 'adding') {
        return;
      }
      setBookmarkActionState(addingGooglePlaceState(result.id));
      try {
        await deleteTripPlaceBookmark(tripId, result.bookmarkId);
        setBookmarkActionState(idleGooglePlaceAddState());
        await load();
      } catch {
        setBookmarkActionState(errorGooglePlaceAddState());
      }
    },
    [bookmarkActionState.status, load, tripId],
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
    bookmarkActionState,
    clearRoutePlaceSelection,
    copyAddress,
    createBookmark,
    deleteBookmark,
    feedback,
    goHome,
    goLogin,
    load,
    openMap,
    resetBookmarkActionState,
    selectRoutePlace,
    state,
    toggleBookmarkLayer,
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

function mapShellFailureState(status: 'auth' | 'notFound' | 'error'): TripMapState {
  return { status };
}
