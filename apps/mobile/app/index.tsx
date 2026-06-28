import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';

import {
  ApiError,
  type GetDayScheduleItemsResponse,
  type GetTripDetailResponse,
  type TripListItem,
} from '@i-um/api-contract';

import { MobileAuthError } from '../lib/auth/client';
import { clearStoredSession, readStoredSession } from '../lib/auth/session';
import { theme } from '../lib/design';
import { BottomMenu } from '../lib/navigation/BottomMenu';
import { NextPlaceHeroCard, type NextPlace } from '../lib/trip-ui/NextPlaceHeroCard';
import {
  createRoutePreview,
  getTripDayItinerary,
  getTripDetail,
  listMyTrips,
  markScheduleItemArrived,
  markScheduleItemSkipped,
  restoreScheduleItem,
} from '../lib/trips/client';
import { localDateString } from '../lib/trips/status';
import {
  applyTravelModeToTodayViewModel,
  buildTodayExecutionViewModel,
  buildTodayNoOngoingTripViewModel,
  buildTodayRetryableErrorViewModel,
  buildTodayUnavailableViewModel,
  findTodayTripDay,
  selectTodayTrip,
  type TodayAction,
  type TodayExecutionViewModel,
  type TodayLodgingNavigationActionViewModel,
} from '../lib/trips/today-execution';
import { openTodayNavigationDestination, type TodayNavigationDestination } from '../lib/trips/today-navigation';
import {
  buildTodayNavigationFallbackPanel,
  copyTodayNavigationFallbackDestination,
  resetTodayNavigationFallbackState,
  todayNavigationFallbackStateForResult,
  type TodayNavigationFallbackState,
} from '../lib/trips/today-navigation-fallback';
import {
  buildRoutePreviewRequest,
  buildTodayRoutePreviewHeroChip,
  routePreviewEligibility,
  todayRoutePreviewCacheKey,
  todayRoutePreviewLoadingState,
  todayRoutePreviewPermissionNeededState,
  todayRoutePreviewSuccessState,
  todayRoutePreviewUnavailableState,
  todayRoutePreviewUnsupportedState,
  type TodayRoutePreviewOrigin,
  type TodayRoutePreviewState,
  type TodayRoutePreviewViewModel,
} from '../lib/trips/today-route-preview';
import {
  defaultTravelMode,
  readStoredTravelMode,
  saveSelectedTravelMode,
  travelModeDisplayLabel,
  travelModeDisplayOptions,
  travelModeFromDisplayLabel,
  type TravelMode,
} from '../lib/trips/travel-mode';

type TodayExecutionContext = {
  selectedTrip: TripListItem;
  tripDetail: GetTripDetailResponse;
  today: string;
  ongoingTripCount: number;
};

type TodayState =
  | { status: 'loading' }
  | { status: 'needsLogin'; message?: string }
  | { status: 'ready'; viewModel: TodayExecutionViewModel; context?: TodayExecutionContext };

export default function HomeScreen() {
  const [todayState, setTodayState] = useState<TodayState>({ status: 'loading' });
  const [arrivingItemId, setArrivingItemId] = useState<string | null>(null);
  const [skippingItemId, setSkippingItemId] = useState<string | null>(null);
  const [restoringItemId, setRestoringItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [navigationFallback, setNavigationFallback] = useState<TodayNavigationFallbackState | null>(null);
  const [navigationRetrying, setNavigationRetrying] = useState(false);
  const [routePreviewState, setRoutePreviewState] = useState<TodayRoutePreviewState>({ status: 'idle' });
  const routePreviewCacheRef = useRef(new Map<string, TodayRoutePreviewState>());

  const handleAuthError = useCallback(async (error: unknown) => {
    if (error instanceof MobileAuthError && (error.code === 'INVALID_REFRESH_TOKEN' || error.code === 'UNAUTHORIZED')) {
      await clearStoredSession();
      setTodayState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
      return true;
    }
    if (error instanceof ApiError && error.status === 401) {
      await clearStoredSession();
      setTodayState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async () => {
    setArrivingItemId(null);
    setSkippingItemId(null);
    setRestoringItemId(null);
    setActionError(null);
    setNavigationFallback(resetTodayNavigationFallbackState());
    setNavigationRetrying(false);
    setRoutePreviewState({ status: 'idle' });
    setTodayState({ status: 'loading' });

    try {
      const stored = await readStoredSession();
      if (stored.status === 'missing') {
        setTodayState({ status: 'needsLogin' });
        return;
      }
      if (stored.status === 'corrupt') {
        setTodayState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
        return;
      }

      const currentTravelMode = (await readStoredTravelMode()).mode;
      const today = localDateString();
      const trips = await listMyTrips();
      const selectedTrip = selectTodayTrip(trips.trips, today);
      if (!selectedTrip) {
        setTodayState({ status: 'ready', viewModel: buildTodayNoOngoingTripViewModel() });
        return;
      }

      let detail;
      try {
        detail = await getTripDetail(selectedTrip.trip.id);
      } catch (error) {
        if (await handleAuthError(error)) {
          return;
        }
        setTodayState({
          status: 'ready',
          viewModel: isUnavailableError(error)
            ? buildTodayUnavailableViewModel(selectedTrip.trip.id)
            : buildTodayRetryableErrorViewModel(),
        });
        return;
      }

      const currentDay = findTodayTripDay(detail.days, today);
      if (!currentDay) {
        setTodayState({ status: 'ready', viewModel: buildTodayUnavailableViewModel(selectedTrip.trip.id) });
        return;
      }

      try {
        const itinerary = await getTripDayItinerary(selectedTrip.trip.id, currentDay.id);
        const context: TodayExecutionContext = {
          selectedTrip: selectedTrip.trip,
          tripDetail: detail,
          today,
          ongoingTripCount: selectedTrip.ongoingTripCount,
        };
        setTodayState({
          status: 'ready',
          context,
          viewModel: buildTodayExecutionViewModel({
            selectedTrip: context.selectedTrip,
            tripDetail: context.tripDetail,
            itinerary,
            today: context.today,
            ongoingTripCount: context.ongoingTripCount,
            travelMode: currentTravelMode,
          }),
        });
      } catch (error) {
        if (await handleAuthError(error)) {
          return;
        }
        setTodayState({
          status: 'ready',
          viewModel: isUnavailableError(error)
            ? buildTodayUnavailableViewModel(selectedTrip.trip.id)
            : buildTodayRetryableErrorViewModel(selectedTrip.trip.id),
        });
      }
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      setTodayState({ status: 'ready', viewModel: buildTodayRetryableErrorViewModel() });
    }
  }, [handleAuthError]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const applyTodayItineraryResponse = useCallback(
    (
      context: TodayExecutionContext,
      response: Pick<GetDayScheduleItemsResponse, 'day' | 'scheduleItems'>,
      travelMode: TravelMode = defaultTravelMode,
    ) => {
      const itinerary: GetDayScheduleItemsResponse = { day: response.day, scheduleItems: response.scheduleItems };
      setTodayState({
        status: 'ready',
        context,
        viewModel: buildTodayExecutionViewModel({
          selectedTrip: context.selectedTrip,
          tripDetail: context.tripDetail,
          itinerary,
          today: context.today,
          ongoingTripCount: context.ongoingTripCount,
          travelMode,
        }),
      });
    },
    [],
  );

  const loadRoutePreview = useCallback(
    async (viewModel: Extract<TodayExecutionViewModel, { status: 'success' }>, options?: { force?: boolean }) => {
      const destination = { itemId: viewModel.nextPlace.itemId, routablePlace: viewModel.nextPlace.routablePlace };
      if (routePreviewEligibility(destination) === 'unsupported' || !viewModel.nextPlace.routablePlace) {
        setRoutePreviewState(todayRoutePreviewUnsupportedState());
        return;
      }

      setRoutePreviewState(todayRoutePreviewLoadingState());
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setRoutePreviewState(todayRoutePreviewPermissionNeededState());
          return;
        }

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const origin: TodayRoutePreviewOrigin = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const cacheKey = todayRoutePreviewCacheKey({
          itemId: viewModel.nextPlace.itemId,
          origin,
          routablePlace: viewModel.nextPlace.routablePlace,
        });
        if (!options?.force) {
          const cached = routePreviewCacheRef.current.get(cacheKey);
          if (cached) {
            setRoutePreviewState(cached);
            return;
          }
        }

        const response = await createRoutePreview(
          viewModel.arrivalAction.tripId,
          viewModel.arrivalAction.date,
          viewModel.nextPlace.itemId,
          buildRoutePreviewRequest(origin),
        );
        const successState = todayRoutePreviewSuccessState(response);
        routePreviewCacheRef.current.set(cacheKey, successState);
        setRoutePreviewState(successState);
      } catch (error) {
        if (await handleAuthError(error)) {
          return;
        }
        if (error instanceof ApiError && error.body?.error?.code === 'ROUTE_PREVIEW_UNSUPPORTED_PLACE') {
          setRoutePreviewState(todayRoutePreviewUnsupportedState());
          return;
        }
        setRoutePreviewState(todayRoutePreviewUnavailableState());
      }
    },
    [handleAuthError],
  );

  useEffect(() => {
    if (todayState.status !== 'ready' || todayState.viewModel.status !== 'success') {
      setRoutePreviewState({ status: 'idle' });
      return;
    }

    void loadRoutePreview(todayState.viewModel);
  }, [loadRoutePreview, todayState]);

  const handleRoutePreviewRetry = useCallback(() => {
    if (todayState.status !== 'ready' || todayState.viewModel.status !== 'success') {
      return;
    }
    void loadRoutePreview(todayState.viewModel, { force: true });
  }, [loadRoutePreview, todayState]);

  const handleArrive = useCallback(
    async (action: Extract<TodayAction, { kind: 'arrive' }>) => {
      if (arrivingItemId) {
        return;
      }

      const context = todayState.status === 'ready' ? todayState.context : undefined;
      if (!context) {
        setActionError('도착 처리할 수 없어요. 다시 시도해주세요.');
        return;
      }

      const currentTravelMode =
        todayState.status === 'ready' && todayState.viewModel.status === 'success'
          ? todayState.viewModel.nextPlace.navigationAction.travelMode
          : defaultTravelMode;

      setArrivingItemId(action.itemId);
      setActionError(null);
      setNavigationFallback(resetTodayNavigationFallbackState());
      setNavigationRetrying(false);
      setRoutePreviewState({ status: 'idle' });
      try {
        const response = await markScheduleItemArrived(action.tripId, action.date, action.itemId);
        applyTodayItineraryResponse(context, response, currentTravelMode);
      } catch (error) {
        if (await handleAuthError(error)) {
          return;
        }
        if (error instanceof ApiError && error.status === 409) {
          setActionError('일정 순서가 바뀌었어요. 다시 불러와주세요.');
          return;
        }
        if (isUnavailableError(error)) {
          setTodayState({ status: 'ready', context, viewModel: buildTodayUnavailableViewModel(action.tripId) });
          return;
        }
        setActionError('도착 처리할 수 없어요. 다시 시도해주세요.');
      } finally {
        setArrivingItemId(null);
      }
    },
    [applyTodayItineraryResponse, arrivingItemId, handleAuthError, todayState],
  );

  const handleSkip = useCallback(
    async (action: Extract<TodayAction, { kind: 'skip' }>) => {
      if (skippingItemId) {
        return;
      }

      const context = todayState.status === 'ready' ? todayState.context : undefined;
      if (!context) {
        setActionError('스킵 처리할 수 없어요. 다시 시도해주세요.');
        return;
      }

      const currentTravelMode =
        todayState.status === 'ready' && todayState.viewModel.status === 'success'
          ? todayState.viewModel.nextPlace.navigationAction.travelMode
          : defaultTravelMode;

      setSkippingItemId(action.itemId);
      setActionError(null);
      setNavigationFallback(resetTodayNavigationFallbackState());
      setNavigationRetrying(false);
      try {
        const response = await markScheduleItemSkipped(action.tripId, action.date, action.itemId);
        applyTodayItineraryResponse(context, response, currentTravelMode);
      } catch (error) {
        if (await handleAuthError(error)) {
          return;
        }
        if (error instanceof ApiError && error.status === 409) {
          setActionError('일정 순서가 바뀌었어요. 다시 불러와주세요.');
          return;
        }
        if (isUnavailableError(error)) {
          setTodayState({ status: 'ready', context, viewModel: buildTodayUnavailableViewModel(action.tripId) });
          return;
        }
        setActionError('스킵 처리할 수 없어요. 다시 시도해주세요.');
      } finally {
        setSkippingItemId(null);
      }
    },
    [applyTodayItineraryResponse, handleAuthError, skippingItemId, todayState],
  );

  const handleRestore = useCallback(
    async (action: Extract<TodayAction, { kind: 'restore' }>) => {
      if (restoringItemId) {
        return;
      }

      const context = todayState.status === 'ready' ? todayState.context : undefined;
      if (!context) {
        setActionError('스킵한 장소를 복구할 수 없어요. 다시 시도해주세요.');
        return;
      }

      const currentTravelMode =
        todayState.status === 'ready' && todayState.viewModel.status === 'success'
          ? todayState.viewModel.nextPlace.navigationAction.travelMode
          : defaultTravelMode;

      setRestoringItemId(action.itemId);
      setActionError(null);
      setNavigationFallback(resetTodayNavigationFallbackState());
      setNavigationRetrying(false);
      try {
        const response = await restoreScheduleItem(action.tripId, action.date, action.itemId);
        applyTodayItineraryResponse(context, response, currentTravelMode);
      } catch (error) {
        if (await handleAuthError(error)) {
          return;
        }
        if (error instanceof ApiError && error.status === 409) {
          setActionError('이미 완료된 장소예요. 다시 불러와주세요.');
          return;
        }
        if (isUnavailableError(error)) {
          setTodayState({ status: 'ready', context, viewModel: buildTodayUnavailableViewModel(action.tripId) });
          return;
        }
        setActionError('스킵한 장소를 복구할 수 없어요. 다시 시도해주세요.');
      } finally {
        setRestoringItemId(null);
      }
    },
    [applyTodayItineraryResponse, handleAuthError, restoringItemId, todayState],
  );

  const openNavigationDestination = useCallback(
    async (destination: TodayNavigationDestination, travelMode: TravelMode, options?: { retry?: boolean }) => {
      const retry = options?.retry === true;
      setActionError(null);

      if (retry) {
        setNavigationRetrying(true);
      } else {
        setNavigationFallback(resetTodayNavigationFallbackState());
      }

      try {
        const result = await openTodayNavigationDestination({
          destination,
          launcher: Linking,
          platform: Platform.OS,
          travelMode,
        });
        setNavigationFallback(todayNavigationFallbackStateForResult(result, destination, travelMode));
      } finally {
        if (retry) {
          setNavigationRetrying(false);
        }
      }
    },
    [],
  );

  const handleNavigate = useCallback(
    async (action: Extract<TodayAction, { kind: 'navigate' }>) => {
      await openNavigationDestination(action.destination, action.travelMode);
    },
    [openNavigationDestination],
  );

  const handleNavigationFallbackCopy = useCallback(async (destination: TodayNavigationDestination) => {
    const result = await copyTodayNavigationFallbackDestination(destination, Clipboard);
    if (!result.feedback) {
      return;
    }

    setNavigationFallback((current) => (current ? { ...current, feedback: result.feedback } : current));
  }, []);

  const handleNavigationFallbackRetry = useCallback(
    async (destination: TodayNavigationDestination, travelMode?: TravelMode) => {
      if (navigationRetrying) {
        return;
      }

      await openNavigationDestination(destination, travelMode ?? defaultTravelMode, { retry: true });
    },
    [navigationRetrying, openNavigationDestination],
  );

  const handleNavigationFallbackOpenItinerary = useCallback((action: Extract<TodayAction, { kind: 'route' }>) => {
    setNavigationFallback(resetTodayNavigationFallbackState());
    setNavigationRetrying(false);
    router.push(action.route);
  }, []);

  const handleTravelModeSelect = useCallback((travelMode: TravelMode) => {
    setActionError(null);
    setNavigationFallback(resetTodayNavigationFallbackState());
    setNavigationRetrying(false);
    setTodayState((current) => {
      if (current.status !== 'ready') {
        return current;
      }

      return {
        ...current,
        viewModel: applyTravelModeToTodayViewModel(current.viewModel, travelMode),
      };
    });
    void saveSelectedTravelMode(travelMode);
  }, []);

  const runAction = useCallback(
    (action: TodayAction) => {
      if (action.kind === 'retry') {
        void load();
        return;
      }
      if (action.kind === 'arrive') {
        void handleArrive(action);
        return;
      }
      if (action.kind === 'skip') {
        void handleSkip(action);
        return;
      }
      if (action.kind === 'restore') {
        void handleRestore(action);
        return;
      }
      if (action.kind === 'navigate') {
        void handleNavigate(action);
        return;
      }
      router.push(action.route);
    },
    [handleArrive, handleNavigate, handleRestore, handleSkip, load],
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>오늘</Text>
          <Text style={styles.subtitle}>다음 장소를 바로 확인해요.</Text>
        </View>

        {todayState.status === 'loading' ? (
          <View style={styles.card}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>오늘 일정을 불러오는 중...</Text>
          </View>
        ) : null}

        {todayState.status === 'needsLogin' ? (
          <View style={styles.card}>
            <Text style={styles.message}>{todayState.message ?? '로그인이 필요합니다.'}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
              <Text style={styles.buttonText}>로그인하기</Text>
            </Pressable>
          </View>
        ) : null}

        {todayState.status === 'ready' ? (
          <TodayContent
            actionError={actionError}
            arrivingItemId={arrivingItemId}
            restoringItemId={restoringItemId}
            skippingItemId={skippingItemId}
            navigationFallback={navigationFallback}
            navigationRetrying={navigationRetrying}
            routePreviewState={routePreviewState}
            onAction={runAction}
            onNavigationFallbackCopy={handleNavigationFallbackCopy}
            onNavigationFallbackOpenItinerary={handleNavigationFallbackOpenItinerary}
            onNavigationFallbackRetry={handleNavigationFallbackRetry}
            onRoutePreviewRetry={handleRoutePreviewRetry}
            onTravelModeSelect={handleTravelModeSelect}
            viewModel={todayState.viewModel}
          />
        ) : null}
      </ScrollView>

      {todayState.status === 'ready' ? <BottomMenu selected="home" /> : null}
    </View>
  );
}

function TodayContent({
  actionError,
  arrivingItemId,
  restoringItemId,
  skippingItemId,
  navigationFallback,
  navigationRetrying,
  routePreviewState,
  onAction,
  onNavigationFallbackCopy,
  onNavigationFallbackOpenItinerary,
  onNavigationFallbackRetry,
  onRoutePreviewRetry,
  onTravelModeSelect,
  viewModel,
}: {
  actionError: string | null;
  arrivingItemId: string | null;
  restoringItemId: string | null;
  skippingItemId: string | null;
  navigationFallback: TodayNavigationFallbackState | null;
  navigationRetrying: boolean;
  routePreviewState: TodayRoutePreviewState;
  onAction: (action: TodayAction) => void;
  onNavigationFallbackCopy: (destination: TodayNavigationDestination) => void;
  onNavigationFallbackOpenItinerary: (action: Extract<TodayAction, { kind: 'route' }>) => void;
  onNavigationFallbackRetry: (destination: TodayNavigationDestination, travelMode?: TravelMode) => void;
  onRoutePreviewRetry: () => void;
  onTravelModeSelect: (travelMode: TravelMode) => void;
  viewModel: TodayExecutionViewModel;
}) {
  if (viewModel.status === 'noOngoingTrip') {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyTitle}>{viewModel.title}</Text>
        <Text style={styles.message}>{viewModel.helper}</Text>
        <View style={styles.actionRow}>
          <ActionButton action={viewModel.primaryAction} onAction={onAction} />
          <ActionButton action={viewModel.secondaryAction} onAction={onAction} variant="secondary" />
        </View>
      </View>
    );
  }

  if (viewModel.status === 'retryableError' || viewModel.status === 'unavailable') {
    return (
      <View style={styles.card}>
        <Text style={styles.errorTitle}>{viewModel.title}</Text>
        <Text style={styles.message}>{viewModel.helper}</Text>
        <View style={styles.actionRow}>
          <ActionButton action={viewModel.primaryAction} onAction={onAction} />
          {viewModel.secondaryAction ? (
            <ActionButton action={viewModel.secondaryAction} onAction={onAction} variant="secondary" />
          ) : null}
        </View>
      </View>
    );
  }

  if (viewModel.status === 'emptyItinerary') {
    return (
      <View style={styles.card}>
        <TodayDayHeader
          dayLabel={viewModel.dayLabel}
          formattedDate={viewModel.formattedDate}
          tripName={viewModel.tripName}
        />
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>{viewModel.title}</Text>
          <Text style={styles.message}>{viewModel.helper}</Text>
        </View>
        <ActionButton action={viewModel.primaryAction} onAction={onAction} />
        <LodgingNavigationActionBlock action={viewModel.lodgingNavigationAction} onAction={onAction} />
        <NavigationFallbackSlot
          itineraryAction={viewModel.primaryAction}
          navigationFallback={navigationFallback}
          navigationRetrying={navigationRetrying}
          onCopy={onNavigationFallbackCopy}
          onOpenItinerary={onNavigationFallbackOpenItinerary}
          onRetry={onNavigationFallbackRetry}
        />
        <MultipleOngoingNotice notice={viewModel.multipleOngoingTripNotice} onAction={onAction} />
      </View>
    );
  }

  if (viewModel.status === 'completed') {
    return (
      <View style={styles.card}>
        <TodayDayHeader
          dayLabel={viewModel.dayLabel}
          formattedDate={viewModel.formattedDate}
          tripName={viewModel.tripName}
        />
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>{viewModel.title}</Text>
          <Text style={styles.message}>{viewModel.helper}</Text>
          <Text style={styles.completedCount}>{viewModel.completedCountLabel}</Text>
        </View>
        <ActionButton action={viewModel.quickExpenseAction} onAction={onAction} />
        <ActionButton action={viewModel.primaryAction} onAction={onAction} variant="secondary" />
        <LodgingNavigationActionBlock action={viewModel.lodgingNavigationAction} onAction={onAction} />
        <NavigationFallbackSlot
          itineraryAction={viewModel.primaryAction}
          navigationFallback={navigationFallback}
          navigationRetrying={navigationRetrying}
          onCopy={onNavigationFallbackCopy}
          onOpenItinerary={onNavigationFallbackOpenItinerary}
          onRetry={onNavigationFallbackRetry}
        />
        <MultipleOngoingNotice notice={viewModel.multipleOngoingTripNotice} onAction={onAction} />
      </View>
    );
  }

  if (viewModel.status === 'recoverNeeded') {
    return (
      <View style={styles.card}>
        <TodayDayHeader
          dayLabel={viewModel.dayLabel}
          formattedDate={viewModel.formattedDate}
          tripName={viewModel.tripName}
        />
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>{viewModel.title}</Text>
          <Text style={styles.message}>{viewModel.helper}</Text>
        </View>
        <SkippedPlacesSection
          onAction={onAction}
          restoringItemId={restoringItemId}
          section={viewModel.skippedSection}
        />
        {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
        <ActionButton action={viewModel.primaryAction} onAction={onAction} />
        <LodgingNavigationActionBlock action={viewModel.lodgingNavigationAction} onAction={onAction} />
        <NavigationFallbackSlot
          itineraryAction={viewModel.primaryAction}
          navigationFallback={navigationFallback}
          navigationRetrying={navigationRetrying}
          onCopy={onNavigationFallbackCopy}
          onOpenItinerary={onNavigationFallbackOpenItinerary}
          onRetry={onNavigationFallbackRetry}
        />
        <MultipleOngoingNotice notice={viewModel.multipleOngoingTripNotice} onAction={onAction} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <TodayDayHeader
        dayLabel={viewModel.dayLabel}
        formattedDate={viewModel.formattedDate}
        tripName={viewModel.tripName}
      />
      <TodayNextPlaceHero
        arrivingItemId={arrivingItemId}
        onAction={onAction}
        onTravelModeSelect={onTravelModeSelect}
        routePreviewState={routePreviewState}
        skippingItemId={skippingItemId}
        viewModel={viewModel}
      />
      <ActionButton action={viewModel.quickExpenseAction} onAction={onAction} />
      <NavigationFallbackSlot
        itineraryAction={viewModel.primaryAction}
        navigationFallback={navigationFallback}
        navigationRetrying={navigationRetrying}
        onCopy={onNavigationFallbackCopy}
        onOpenItinerary={onNavigationFallbackOpenItinerary}
        onRetry={onNavigationFallbackRetry}
      />
      {viewModel.skippedSection ? (
        <SkippedPlacesSection
          onAction={onAction}
          restoringItemId={restoringItemId}
          section={viewModel.skippedSection}
        />
      ) : null}
      {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
      <TodayRoutePreviewCard
        onDetail={() => onAction(viewModel.nextPlace.navigationAction)}
        onRetry={onRoutePreviewRetry}
        state={routePreviewState}
      />
      <ActionButton action={viewModel.primaryAction} onAction={onAction} variant="secondary" />
      <MultipleOngoingNotice notice={viewModel.multipleOngoingTripNotice} onAction={onAction} />
    </View>
  );
}

function TodayNextPlaceHero({
  arrivingItemId,
  onAction,
  onTravelModeSelect,
  routePreviewState,
  skippingItemId,
  viewModel,
}: {
  arrivingItemId: string | null;
  onAction: (action: TodayAction) => void;
  onTravelModeSelect: (travelMode: TravelMode) => void;
  routePreviewState: TodayRoutePreviewState;
  skippingItemId: string | null;
  viewModel: Extract<TodayExecutionViewModel, { status: 'success' }>;
}) {
  const selectedTravelMode = viewModel.nextPlace.navigationAction.travelMode;
  const lodgingAction = viewModel.lodgingNavigationAction.action;
  const place: NextPlace = {
    order: viewModel.nextPlace.order,
    type: viewModel.nextPlace.placeType,
    name: viewModel.nextPlace.placeName,
    address: viewModel.nextPlace.address,
    legText: `${viewModel.nextPlace.orderLabel}번째 장소 · ${viewModel.nextPlace.placeTypeLabel}`,
  };
  const arriveDisabled = arrivingItemId === viewModel.arrivalAction.itemId;
  const skipDisabled = skippingItemId === viewModel.skipAction.itemId;
  const lodgingDisabled = viewModel.lodgingNavigationAction.disabled || !lodgingAction;

  return (
    <NextPlaceHeroCard
      arriveDisabled={arriveDisabled}
      arriveLabel={arriveDisabled ? '도착 처리 중...' : '도착'}
      lodgingDisabled={lodgingDisabled}
      lodgingHelper={viewModel.lodgingNavigationAction.helper ?? ''}
      onArrive={() => onAction(viewModel.arrivalAction)}
      onLodging={() => {
        if (lodgingAction) {
          onAction(lodgingAction);
        }
      }}
      onNavigate={() => onAction(viewModel.nextPlace.navigationAction)}
      onSkip={() => onAction(viewModel.skipAction)}
      onTravelMode={(label) => {
        const travelMode = travelModeFromDisplayLabel(label);
        if (travelMode) {
          onTravelModeSelect(travelMode);
        }
      }}
      place={place}
      routeChip={buildTodayRoutePreviewHeroChip(routePreviewState)}
      skipDisabled={skipDisabled}
      skipLabel={skipDisabled ? '스킵 처리 중...' : '건너뛰기'}
      travelMode={travelModeDisplayLabel(selectedTravelMode)}
      travelOptions={travelModeDisplayOptions}
    />
  );
}

function TodayDayHeader({
  dayLabel,
  formattedDate,
  tripName,
}: {
  dayLabel: string;
  formattedDate: string;
  tripName: string;
}) {
  return (
    <View style={styles.dayHeader}>
      <Text style={styles.tripName}>{tripName}</Text>
      <Text style={styles.dayText}>
        {dayLabel} · {formattedDate}
      </Text>
    </View>
  );
}

function SkippedPlacesSection({
  onAction,
  restoringItemId,
  section,
}: {
  onAction: (action: TodayAction) => void;
  restoringItemId: string | null;
  section: NonNullable<Extract<TodayExecutionViewModel, { status: 'success' }>['skippedSection']>;
}) {
  return (
    <View style={styles.skippedSection}>
      <View style={styles.skippedHeader}>
        <Text style={styles.skippedTitle}>{section.title}</Text>
        <Text style={styles.skippedCount}>{section.countLabel}</Text>
      </View>
      <View style={styles.skippedList}>
        {section.items.map((item) => {
          const isRestoring = restoringItemId === item.itemId;
          return (
            <View key={item.itemId} style={styles.skippedRow}>
              <View style={styles.placeMetaRow}>
                <Text style={styles.orderBadge}>{item.orderLabel}</Text>
                <Text style={styles.placeType}>{item.placeTypeLabel}</Text>
              </View>
              <Text style={styles.skippedPlaceName}>{item.placeName}</Text>
              <Text style={styles.address}>{item.address}</Text>
              <ActionButton
                action={item.restoreAction}
                disabled={isRestoring}
                label={isRestoring ? '복구 중...' : undefined}
                onAction={onAction}
                variant="secondary"
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TodayRoutePreviewCard({
  onDetail,
  onRetry,
  state,
}: {
  onDetail: () => void;
  onRetry: () => void;
  state: TodayRoutePreviewState;
}) {
  if (state.status === 'idle') {
    return null;
  }

  if (state.status === 'loading') {
    return (
      <View style={styles.routePreviewCard}>
        <ActivityIndicator color={theme.color.primary} />
        <Text style={styles.routePreviewHelper}>{state.message}</Text>
      </View>
    );
  }

  if (state.status === 'success') {
    return <TodayRoutePreviewSuccessCard onDetail={onDetail} viewModel={state.viewModel} />;
  }

  const canRetry = state.status === 'permissionNeeded' || state.status === 'unavailable';
  return (
    <View style={styles.routePreviewCard}>
      <Text style={styles.routePreviewTitle}>{state.title}</Text>
      <Text style={styles.routePreviewHelper}>{state.helper}</Text>
      <View style={styles.routePreviewActions}>
        {canRetry ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={[styles.secondaryButton, styles.routePreviewAction]}
          >
            <Text style={styles.secondaryButtonText}>{state.retryLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onDetail} style={[styles.button, styles.routePreviewAction]}>
          <Text style={styles.buttonText}>Google Maps에서 자세히</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TodayRoutePreviewSuccessCard({
  onDetail,
  viewModel,
}: {
  onDetail: () => void;
  viewModel: TodayRoutePreviewViewModel;
}) {
  return (
    <View style={styles.routePreviewCard}>
      <View style={styles.routePreviewHeader}>
        <Text style={styles.routePreviewTitle}>이동 미리보기</Text>
        <Text style={styles.routePreviewMode}>{viewModel.modeLabel}</Text>
      </View>
      {viewModel.map ? <TodayRoutePreviewMap viewModel={viewModel} /> : null}
      <View style={styles.routePreviewSummaryRow}>
        <Text style={styles.routePreviewMetric}>{viewModel.durationLabel}</Text>
        <Text style={styles.routePreviewMetric}>{viewModel.distanceLabel}</Text>
      </View>
      <Text style={styles.routePreviewHelper}>{viewModel.summaryText}</Text>
      <Pressable accessibilityRole="button" onPress={onDetail} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{viewModel.detailActionLabel}</Text>
      </Pressable>
    </View>
  );
}

function TodayRoutePreviewMap({ viewModel }: { viewModel: TodayRoutePreviewViewModel }) {
  if (!viewModel.map) {
    return null;
  }
  const latitudeDelta = Math.max(
    0.01,
    Math.abs(viewModel.map.bounds.northeast.latitude - viewModel.map.bounds.southwest.latitude) * 1.25,
  );
  const longitudeDelta = Math.max(
    0.01,
    Math.abs(viewModel.map.bounds.northeast.longitude - viewModel.map.bounds.southwest.longitude) * 1.25,
  );
  const region = {
    latitude: (viewModel.map.bounds.northeast.latitude + viewModel.map.bounds.southwest.latitude) / 2,
    longitude: (viewModel.map.bounds.northeast.longitude + viewModel.map.bounds.southwest.longitude) / 2,
    latitudeDelta,
    longitudeDelta,
  };

  return (
    <MapView
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      initialRegion={region}
      pointerEvents="none"
      style={styles.routePreviewMap}
    >
      <Marker coordinate={viewModel.map.origin} />
      <Marker coordinate={viewModel.map.destination} />
      <Polyline coordinates={viewModel.map.coordinates} strokeColor={theme.color.primary} strokeWidth={4} />
    </MapView>
  );
}

function TodayNavigationFallbackPanel({
  itineraryAction,
  onCopy,
  onOpenItinerary,
  onRetry,
  retrying,
  state,
}: {
  itineraryAction: Extract<TodayAction, { kind: 'route' }>;
  onCopy: (destination: TodayNavigationDestination) => void;
  onOpenItinerary: (action: Extract<TodayAction, { kind: 'route' }>) => void;
  onRetry: (destination: TodayNavigationDestination, travelMode?: TravelMode) => void;
  retrying: boolean;
  state: TodayNavigationFallbackState;
}) {
  const panel = buildTodayNavigationFallbackPanel({
    destination: state.destination,
    feedback: state.feedback,
    retrying,
  });

  return (
    <View style={styles.navigationFallbackPanel}>
      <Text style={styles.navigationFallbackMessage}>{panel.message}</Text>
      {panel.feedback ? (
        <Text
          style={
            panel.feedback.kind === 'success'
              ? styles.navigationFallbackFeedbackSuccess
              : styles.navigationFallbackFeedbackError
          }
        >
          {panel.feedback.message}
        </Text>
      ) : null}
      <View style={styles.navigationFallbackActions}>
        <Pressable
          accessibilityHint={panel.copyAction.disabled ? panel.copyAction.disabledHelper : undefined}
          accessibilityRole="button"
          accessibilityState={{ disabled: panel.copyAction.disabled }}
          disabled={panel.copyAction.disabled}
          onPress={() => onCopy(state.destination)}
          style={[
            styles.button,
            styles.navigationFallbackAction,
            panel.copyAction.disabled ? styles.disabledButton : null,
          ]}
        >
          <Text style={styles.buttonText}>{panel.copyAction.label}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: panel.retryAction.disabled }}
          disabled={panel.retryAction.disabled}
          onPress={() => onRetry(state.destination, state.travelMode)}
          style={[
            styles.secondaryButton,
            styles.navigationFallbackAction,
            panel.retryAction.disabled ? styles.disabledButton : null,
          ]}
        >
          <Text style={styles.secondaryButtonText}>{panel.retryAction.label}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpenItinerary(itineraryAction)}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>{panel.itineraryAction.label}</Text>
      </Pressable>
    </View>
  );
}

function NavigationFallbackSlot({
  itineraryAction,
  navigationFallback,
  navigationRetrying,
  onCopy,
  onOpenItinerary,
  onRetry,
}: {
  itineraryAction: Extract<TodayAction, { kind: 'route' }>;
  navigationFallback: TodayNavigationFallbackState | null;
  navigationRetrying: boolean;
  onCopy: (destination: TodayNavigationDestination) => void;
  onOpenItinerary: (action: Extract<TodayAction, { kind: 'route' }>) => void;
  onRetry: (destination: TodayNavigationDestination, travelMode?: TravelMode) => void;
}) {
  if (!navigationFallback) {
    return null;
  }

  return (
    <TodayNavigationFallbackPanel
      itineraryAction={itineraryAction}
      onCopy={onCopy}
      onOpenItinerary={onOpenItinerary}
      onRetry={onRetry}
      retrying={navigationRetrying}
      state={navigationFallback}
    />
  );
}

function LodgingNavigationActionBlock({
  action,
  onAction,
}: {
  action: TodayLodgingNavigationActionViewModel;
  onAction: (action: TodayAction) => void;
}) {
  const runnableAction = action.action;
  const disabled = action.disabled || !runnableAction;

  return (
    <View style={styles.lodgingActionBlock}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={runnableAction ? () => onAction(runnableAction) : undefined}
        style={[styles.secondaryButton, disabled ? styles.disabledButton : null]}
      >
        <Text style={styles.secondaryButtonText}>{action.label}</Text>
      </Pressable>
      {action.helper ? <Text style={styles.lodgingHelper}>{action.helper}</Text> : null}
    </View>
  );
}

function MultipleOngoingNotice({
  notice,
  onAction,
}: {
  notice: Extract<
    TodayExecutionViewModel,
    { status: 'success' | 'emptyItinerary' | 'completed' | 'recoverNeeded' }
  >['multipleOngoingTripNotice'];
  onAction: (action: TodayAction) => void;
}) {
  if (!notice) {
    return null;
  }

  return (
    <View style={styles.noticeBox}>
      <Text style={styles.noticeText}>{notice.message}</Text>
      <Pressable accessibilityRole="button" onPress={() => onAction(notice.action)} style={styles.noticeButton}>
        <Text style={styles.secondaryButtonText}>{notice.action.label}</Text>
      </Pressable>
    </View>
  );
}

function ActionButton({
  action,
  disabled = false,
  label,
  onAction,
  variant = 'primary',
}: {
  action: TodayAction;
  disabled?: boolean;
  label?: string;
  onAction: (action: TodayAction) => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onAction(action)}
      style={[variant === 'primary' ? styles.button : styles.secondaryButton, disabled ? styles.disabledButton : null]}
    >
      <Text style={variant === 'primary' ? styles.buttonText : styles.secondaryButtonText}>
        {label ?? action.label}
      </Text>
    </Pressable>
  );
}

function isUnavailableError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[4],
    padding: theme.space[7],
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    gap: theme.space[3],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
  },
  card: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.sm,
  },
  dayHeader: {
    gap: theme.space[2],
  },
  tripName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  dayText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  placeMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  orderBadge: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
    overflow: 'hidden',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  placeType: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  address: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  skippedSection: {
    gap: theme.space[4],
  },
  skippedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skippedTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  skippedCount: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  skippedList: {
    gap: theme.space[3],
  },
  skippedRow: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  skippedPlaceName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  emptyPanel: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  actionError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  lodgingActionBlock: {
    gap: theme.space[2],
  },
  lodgingHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    textAlign: 'center',
  },
  routePreviewCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[3],
    overflow: 'hidden',
    padding: theme.space[4],
  },
  routePreviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  routePreviewTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  routePreviewMode: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  routePreviewHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
  },
  routePreviewSummaryRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  routePreviewMetric: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  routePreviewActions: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  routePreviewAction: {
    flex: 1,
  },
  routePreviewMap: {
    borderRadius: theme.radius.md,
    height: 148,
    overflow: 'hidden',
  },
  navigationFallbackPanel: {
    backgroundColor: theme.color.accentSoft,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  navigationFallbackMessage: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  navigationFallbackFeedbackSuccess: {
    color: theme.color.success,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  navigationFallbackFeedbackError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  navigationFallbackActions: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  navigationFallbackAction: {
    flex: 1,
  },
  completedCount: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.space[4],
  },
  button: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  noticeBox: {
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.md,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  noticeText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  noticeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
  },
});
