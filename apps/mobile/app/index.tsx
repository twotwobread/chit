import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';

import {
  ApiError,
  type GetDayItineraryResponse,
  type GetTripDetailResponse,
  type TripListItem,
} from '@i-um/api-contract';

import { MobileAuthError } from '../lib/auth/client';
import { clearStoredSession, readStoredSession } from '../lib/auth/session';
import { theme } from '../lib/design';
import { BottomMenu } from '../lib/navigation/BottomMenu';
import {
  getTripDayItinerary,
  getTripDetail,
  listMyTrips,
  markDayItineraryItemArrived,
  markDayItineraryItemSkipped,
  restoreDayItineraryItem,
} from '../lib/trips/client';
import { localDateString } from '../lib/trips/status';
import {
  buildTodayExecutionViewModel,
  buildTodayNoOngoingTripViewModel,
  buildTodayRetryableErrorViewModel,
  buildTodayUnavailableViewModel,
  findTodayTripDay,
  selectTodayTrip,
  type TodayAction,
  type TodayExecutionViewModel,
} from '../lib/trips/today-execution';
import { openTodayNavigationDestination, type TodayNavigationDestination } from '../lib/trips/today-navigation';
import {
  buildTodayNavigationFallbackPanel,
  copyTodayNavigationFallbackDestination,
  resetTodayNavigationFallbackState,
  todayNavigationFallbackStateForResult,
  type TodayNavigationFallbackState,
} from '../lib/trips/today-navigation-fallback';

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
        const itinerary = await getTripDayItinerary(selectedTrip.trip.id, currentDay.date);
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
    (context: TodayExecutionContext, response: Pick<GetDayItineraryResponse, 'day' | 'items'>) => {
      const itinerary: GetDayItineraryResponse = { day: response.day, items: response.items };
      setTodayState({
        status: 'ready',
        context,
        viewModel: buildTodayExecutionViewModel({
          selectedTrip: context.selectedTrip,
          tripDetail: context.tripDetail,
          itinerary,
          today: context.today,
          ongoingTripCount: context.ongoingTripCount,
        }),
      });
    },
    [],
  );

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

      setArrivingItemId(action.itemId);
      setActionError(null);
      setNavigationFallback(resetTodayNavigationFallbackState());
      setNavigationRetrying(false);
      try {
        const response = await markDayItineraryItemArrived(action.tripId, action.date, action.itemId);
        applyTodayItineraryResponse(context, response);
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

      setSkippingItemId(action.itemId);
      setActionError(null);
      setNavigationFallback(resetTodayNavigationFallbackState());
      setNavigationRetrying(false);
      try {
        const response = await markDayItineraryItemSkipped(action.tripId, action.date, action.itemId);
        applyTodayItineraryResponse(context, response);
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

      setRestoringItemId(action.itemId);
      setActionError(null);
      setNavigationFallback(resetTodayNavigationFallbackState());
      setNavigationRetrying(false);
      try {
        const response = await restoreDayItineraryItem(action.tripId, action.date, action.itemId);
        applyTodayItineraryResponse(context, response);
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
    async (destination: TodayNavigationDestination, options?: { retry?: boolean }) => {
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
        });
        setNavigationFallback(todayNavigationFallbackStateForResult(result, destination));
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
      await openNavigationDestination(action.destination);
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
    async (destination: TodayNavigationDestination) => {
      if (navigationRetrying) {
        return;
      }

      await openNavigationDestination(destination, { retry: true });
    },
    [navigationRetrying, openNavigationDestination],
  );

  const handleNavigationFallbackOpenItinerary = useCallback((action: Extract<TodayAction, { kind: 'route' }>) => {
    setNavigationFallback(resetTodayNavigationFallbackState());
    setNavigationRetrying(false);
    router.push(action.route);
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
            onAction={runAction}
            onNavigationFallbackCopy={handleNavigationFallbackCopy}
            onNavigationFallbackOpenItinerary={handleNavigationFallbackOpenItinerary}
            onNavigationFallbackRetry={handleNavigationFallbackRetry}
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
  onAction,
  onNavigationFallbackCopy,
  onNavigationFallbackOpenItinerary,
  onNavigationFallbackRetry,
  viewModel,
}: {
  actionError: string | null;
  arrivingItemId: string | null;
  restoringItemId: string | null;
  skippingItemId: string | null;
  navigationFallback: TodayNavigationFallbackState | null;
  navigationRetrying: boolean;
  onAction: (action: TodayAction) => void;
  onNavigationFallbackCopy: (destination: TodayNavigationDestination) => void;
  onNavigationFallbackOpenItinerary: (action: Extract<TodayAction, { kind: 'route' }>) => void;
  onNavigationFallbackRetry: (destination: TodayNavigationDestination) => void;
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
      <View style={styles.nextPlaceCard}>
        <Text style={styles.overline}>다음 장소</Text>
        <Text style={styles.nextPlaceName}>{viewModel.nextPlace.placeName}</Text>
        <View style={styles.placeMetaRow}>
          <Text style={styles.orderBadge}>{viewModel.nextPlace.orderLabel}</Text>
          <Text style={styles.placeType}>{viewModel.nextPlace.placeTypeLabel}</Text>
        </View>
        <Text style={styles.address}>{viewModel.nextPlace.address}</Text>
        <ActionButton action={viewModel.nextPlace.navigationAction} onAction={onAction} />
      </View>
      <ActionButton action={viewModel.quickExpenseAction} onAction={onAction} />
      {navigationFallback ? (
        <TodayNavigationFallbackPanel
          itineraryAction={viewModel.primaryAction}
          onCopy={onNavigationFallbackCopy}
          onOpenItinerary={onNavigationFallbackOpenItinerary}
          onRetry={onNavigationFallbackRetry}
          retrying={navigationRetrying}
          state={navigationFallback}
        />
      ) : null}
      <RemainingPlacesSection section={viewModel.remainingSection} />
      {viewModel.skippedSection ? (
        <SkippedPlacesSection
          onAction={onAction}
          restoringItemId={restoringItemId}
          section={viewModel.skippedSection}
        />
      ) : null}
      {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
      <ActionButton
        action={viewModel.arrivalAction}
        disabled={arrivingItemId === viewModel.arrivalAction.itemId}
        label={arrivingItemId === viewModel.arrivalAction.itemId ? '도착 처리 중...' : undefined}
        onAction={onAction}
      />
      <ActionButton
        action={viewModel.skipAction}
        disabled={skippingItemId === viewModel.skipAction.itemId}
        label={skippingItemId === viewModel.skipAction.itemId ? '스킵 처리 중...' : undefined}
        onAction={onAction}
        variant="secondary"
      />
      <ActionButton action={viewModel.primaryAction} onAction={onAction} variant="secondary" />
      <MultipleOngoingNotice notice={viewModel.multipleOngoingTripNotice} onAction={onAction} />
    </View>
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

function RemainingPlacesSection({
  section,
}: {
  section: Extract<TodayExecutionViewModel, { status: 'success' }>['remainingSection'];
}) {
  return (
    <View style={styles.remainingSection}>
      <View style={styles.remainingHeader}>
        <Text style={styles.remainingTitle}>{section.title}</Text>
        {section.status === 'list' ? <Text style={styles.remainingCount}>{section.countLabel}</Text> : null}
      </View>

      {section.status === 'empty' ? (
        <View style={styles.remainingEmptyPanel}>
          <Text style={styles.remainingEmptyTitle}>{section.emptyTitle}</Text>
          <Text style={styles.remainingHelper}>{section.helper}</Text>
        </View>
      ) : null}

      {section.status === 'list' ? (
        <View style={styles.remainingList}>
          {section.items.map((item) => (
            <View key={item.itemId} style={styles.remainingRow}>
              <View style={styles.placeMetaRow}>
                <Text style={styles.orderBadge}>{item.orderLabel}</Text>
                {item.timeLabel ? <Text style={styles.timeLabel}>{item.timeLabel}</Text> : null}
                <Text style={styles.placeType}>{item.placeTypeLabel}</Text>
              </View>
              <Text style={styles.remainingPlaceName}>{item.placeName}</Text>
              <Text style={styles.address}>{item.address}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
    <View style={styles.remainingSection}>
      <View style={styles.remainingHeader}>
        <Text style={styles.remainingTitle}>{section.title}</Text>
        <Text style={styles.remainingCount}>{section.countLabel}</Text>
      </View>
      <View style={styles.remainingList}>
        {section.items.map((item) => {
          const isRestoring = restoringItemId === item.itemId;
          return (
            <View key={item.itemId} style={styles.remainingRow}>
              <View style={styles.placeMetaRow}>
                <Text style={styles.orderBadge}>{item.orderLabel}</Text>
                <Text style={styles.placeType}>{item.placeTypeLabel}</Text>
              </View>
              <Text style={styles.remainingPlaceName}>{item.placeName}</Text>
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
  onRetry: (destination: TodayNavigationDestination) => void;
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
          onPress={() => onRetry(state.destination)}
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
  nextPlaceCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  overline: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  nextPlaceName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
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
  remainingSection: {
    gap: theme.space[4],
  },
  remainingHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  remainingTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  remainingCount: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  remainingEmptyPanel: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  remainingEmptyTitle: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  remainingHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
  },
  remainingList: {
    gap: theme.space[3],
  },
  remainingRow: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  remainingPlaceName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  timeLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
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
