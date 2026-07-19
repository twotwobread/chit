import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { isApiStatus, isMobileAuthSessionError } from '../auth/errors';
import type { RouteMapPlace, RouteMapPolyline } from './RouteMap';
import type { GetDayScheduleItemsResponse, TripDay } from '@i-um/api-contract';
import {
  createGooglePlaceScheduleItemsBatch,
  createGoogleTripPlaceBookmark,
  deleteTripPlaceBookmark,
  listTripPlaceBookmarks,
} from '../places/client';
import { tripPlaceBookmarkToGoogleSearchRow } from '../places/bookmarks';
import {
  addingGooglePlaceState,
  buildCreateGooglePlaceScheduleItemsBatchRequest,
  errorGooglePlaceAddState,
  googlePlaceAddFailureMessage,
  idleGooglePlaceAddState,
  removeGooglePlaceScheduleBatchSelection,
  toggleGooglePlaceScheduleBatchSelection,
  type GooglePlaceAddViewState,
  type GooglePlaceSearchRowViewModel,
  type GooglePlaceTripDestination,
} from '../places/google-search';
import { listTripScheduleItems } from '../trips/itinerary-api';
import { getTripDetail } from '../trips/trip-api';
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
  buildTripMapDayChips,
  buildTripMapDayRoutes,
  buildTripMapLodgingResults,
  buildTripMapRouteLayerChips,
  buildTripMapRouteLayerViewModel,
  buildTripMapScheduleMarkerDetail,
  emptyTripMapRouteLayerSelection,
  resolveTripMapBookmarkRefreshFailure,
  resolveTripMapSelectedDay,
  toggleTripMapRouteLayer,
  tripMapRouteLayerChipIds,
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
      dayRoutes: TripMapDayRoute[];
      lodgingResults: GooglePlaceSearchRowViewModel[];
      mapPlaces: RouteMapPlace[];
      routeChips: ReturnType<typeof buildTripMapRouteLayerChips>;
      routeLayer: TripMapRouteLayerSelection;
      routeNotice: TripMapRouteNotice | null;
      routePolylines: RouteMapPolyline[];
      scheduleTargetDayChips: ReturnType<typeof buildTripMapDayChips>;
      selectedDayId: string;
      selectedRouteLayerChipIds: TripMapRouteLayerChipId[];
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
  const allBookmarkResultsRef = useRef<GooglePlaceSearchRowViewModel[]>([]);
  const bookmarkResultsTripIdRef = useRef<string | null>(null);
  const selectedRoutePlaceIdRef = useRef<string | null>(null);
  const [state, setState] = useState<TripMapState>({ status: 'loading' });
  const [feedback, setFeedback] = useState<DayItineraryMapActionFeedback | null>(null);
  const [bookmarkActionState, setBookmarkActionState] = useState<GooglePlaceAddViewState>(idleGooglePlaceAddState());
  const [scheduleAddState, setScheduleAddState] = useState<GooglePlaceAddViewState>(idleGooglePlaceAddState());
  const [selectedScheduleResults, setSelectedScheduleResults] = useState<GooglePlaceSearchRowViewModel[]>([]);
  const [scheduleFeedbackMessage, setScheduleFeedbackMessage] = useState<string | null>(null);

  const load = useCallback(
    async (preferredDayId: string | null = selectedDayIdRef.current) => {
      if (!tripId) {
        allBookmarkResultsRef.current = [];
        bookmarkResultsTripIdRef.current = null;
        setState({ status: 'notFound' });
        return;
      }
      if (bookmarkResultsTripIdRef.current !== tripId) {
        allBookmarkResultsRef.current = [];
        bookmarkResultsTripIdRef.current = tripId;
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
        const [detailResult, scheduleResult, bookmarkResult] = await Promise.allSettled([
          getTripDetail(tripId),
          listTripScheduleItems(tripId),
          listTripPlaceBookmarks(tripId),
        ] as const);
        if (detailResult.status === 'rejected') {
          throw detailResult.reason;
        }
        if (scheduleResult.status === 'rejected') {
          throw scheduleResult.reason;
        }
        const detail = detailResult.value;
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
        let allBookmarkResults = allBookmarkResultsRef.current;
        if (bookmarkResult.status === 'fulfilled') {
          allBookmarkResults = bookmarkResult.value.bookmarks.flatMap((bookmark) => {
            const row = tripPlaceBookmarkToGoogleSearchRow(bookmark);
            return row ? [row] : [];
          });
          allBookmarkResultsRef.current = allBookmarkResults;
        } else {
          if (
            isMobileAuthSessionError(bookmarkResult.reason) ||
            isApiStatus(bookmarkResult.reason, 400, 401, 403, 404)
          ) {
            throw bookmarkResult.reason;
          }
          const fallback = resolveTripMapBookmarkRefreshFailure(
            allBookmarkResultsRef.current,
            bookmarkLayerVisibleRef.current,
          );
          allBookmarkResults = fallback.layer.allBookmarkResults;
          setFeedback(fallback.feedback);
        }
        const itineraries = buildTripItinerariesFromTripScheduleItems(detail.days, scheduleResult.value);
        const dayRoutes = buildTripMapDayRoutes(itineraries);
        const routeLayer = resolveAvailableRouteLayer(routeLayerRef.current, dayRoutes);
        const routeViewModel = buildTripMapRouteLayerViewModel(dayRoutes, routeLayer);
        const selectedItinerary = resolveSelectedItinerary(itineraries, selectedDay.id);
        routeLayerRef.current = routeLayer;
        selectedDayIdRef.current = selectedDay.id;
        const viewModel = buildDayItineraryViewModel(selectedItinerary);
        const selectedRoutePlaceId = selectedRoutePlaceIdRef.current;
        setState({
          status: 'success',
          allBookmarkResults,
          bookmarkLayerVisible: bookmarkLayerVisibleRef.current,
          dayRoutes,
          lodgingResults: buildTripMapLodgingResults(detail.days),
          mapPlaces: routeViewModel.places,
          routeChips: buildTripMapRouteLayerChips(detail.days),
          routeLayer,
          routeNotice: routeViewModel.notice,
          routePolylines: routeViewModel.polylines,
          scheduleTargetDayChips: buildTripMapDayChips(detail.days),
          selectedDayId: selectedDay.id,
          selectedRouteLayerChipIds: tripMapRouteLayerChipIds(routeLayer),
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
      routeLayerRef.current = routeLayer;

      return {
        ...current,
        mapPlaces: routeViewModel.places,
        routeLayer,
        routeNotice: routeViewModel.notice,
        routePolylines: routeViewModel.polylines,
        selectedRouteLayerChipIds: tripMapRouteLayerChipIds(routeLayer),
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

  const resetScheduleAddState = useCallback(() => {
    setScheduleAddState(idleGooglePlaceAddState());
    setScheduleFeedbackMessage(null);
  }, []);

  const selectScheduleResult = useCallback(
    (result: GooglePlaceSearchRowViewModel) => {
      if (scheduleAddState.status === 'adding') {
        return;
      }
      const update = toggleGooglePlaceScheduleBatchSelection(selectedScheduleResults, result);
      setSelectedScheduleResults(update.selectedResults);
      setScheduleFeedbackMessage(update.message);
      setScheduleAddState(idleGooglePlaceAddState());
    },
    [scheduleAddState.status, selectedScheduleResults],
  );

  const removeScheduleResult = useCallback(
    (googlePlaceId: string) => {
      if (scheduleAddState.status === 'adding') {
        return;
      }
      setSelectedScheduleResults(removeGooglePlaceScheduleBatchSelection(selectedScheduleResults, googlePlaceId));
      setScheduleFeedbackMessage(null);
      setScheduleAddState(idleGooglePlaceAddState());
    },
    [scheduleAddState.status, selectedScheduleResults],
  );

  const submitScheduleBatch = useCallback(
    async (targetDayId: string) => {
      if (!tripId || scheduleAddState.status === 'adding' || selectedScheduleResults.length === 0) {
        return;
      }
      setScheduleAddState(addingGooglePlaceState('batch'));
      setScheduleFeedbackMessage(null);
      try {
        await createGooglePlaceScheduleItemsBatch(
          tripId,
          targetDayId,
          buildCreateGooglePlaceScheduleItemsBatchRequest(selectedScheduleResults),
        );
        setSelectedScheduleResults([]);
        setScheduleAddState(idleGooglePlaceAddState());
        await load(targetDayId);
      } catch (error) {
        if (isMobileAuthSessionError(error) || isApiStatus(error, 401)) {
          router.replace('/login');
          return;
        }
        setScheduleFeedbackMessage(googlePlaceAddFailureMessage);
        setScheduleAddState(idleGooglePlaceAddState());
      }
    },
    [load, scheduleAddState.status, selectedScheduleResults, tripId],
  );

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
    removeScheduleResult,
    resetBookmarkActionState,
    resetScheduleAddState,
    scheduleAddState,
    scheduleFeedbackMessage,
    selectRoutePlace,
    selectScheduleResult,
    selectedScheduleResults,
    state,
    submitScheduleBatch,
    toggleBookmarkLayer,
    toggleRouteLayer,
    tripId,
  };
}

function resolveAvailableRouteLayer(
  routeLayer: TripMapRouteLayerSelection,
  dayRoutes: TripMapDayRoute[],
): TripMapRouteLayerSelection {
  if (routeLayer.kind !== 'days') {
    return routeLayer;
  }
  const availableDayIds = new Set(dayRoutes.map((route) => route.dayId));
  const dayIds = routeLayer.dayIds.filter((dayId) => availableDayIds.has(dayId));
  return dayIds.length > 0 ? { dayIds, kind: 'days' } : emptyTripMapRouteLayerSelection;
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
