import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  type DayExpenseListItem,
  type GetDayScheduleItemsResponse,
  type GetTripDetailResponse,
  type SupportedCurrency,
  type TripListItem,
  type TripParticipantListItem,
} from '@i-um/api-contract';

import { getStoredAuthUser } from '../auth/client';

import {
  apiErrorStatus,
  clearStoredSessionOnAnyMobileAuthOrApiAuthError,
  isAnyMobileAuthOrApiAuthError,
  isApiStatus,
  isMobileAuthSessionError,
} from '../auth/errors';
import { listTripFlights } from '../flights/flight-api';
import { buildTodayFlightCard, type TodayFlightCardViewModel } from '../flights/today';
import { getGooglePlaceDetails } from '../places/client';
import { createQuickExpense, listDayExpenses } from '../trips/expense-api';
import {
  createRoutePreview,
  getTripDayItinerary,
  markScheduleItemArrived,
  markScheduleItemSkipped,
  restoreScheduleItem,
} from '../trips/itinerary-api';
import { listTripParticipants, updateTrip } from '../trips/trip-api';
import { openTodayNavigationDestination } from '../trips/today-navigation';
import { buildTodaySpendSummaryViewModel, type TodaySpendSummaryViewModel } from '../trips/today-spend';
import {
  buildCreateQuickExpenseRequest,
  buildDefaultSplitParticipantIds,
  buildSavedEqualSplitSummary,
  type QuickExpenseSplitPolicy,
  parseQuickExpenseRoute,
  quickExpenseFailureMessage,
  resolveTodayQuickExpenseInitialItemId,
  type QuickExpenseRouteTarget,
} from '../trips/quick-expense';
import { offlineQuickExpenseStore } from '../trips/offline-quick-expense-async-storage';
import {
  buildOfflineQuickExpenseSyncSummary,
  newOfflineQuickExpenseClientMutationId,
  type OfflineQuickExpenseDraft,
  type OfflineQuickExpenseDraftInput,
  type OfflineQuickExpenseQueueItem,
  type OfflineQuickExpenseSyncSummary,
} from '../trips/offline-quick-expense-store';
import { syncOfflineQuickExpenses } from '../trips/offline-quick-expense-sync';
import { loadQuickExpensePreset, saveQuickExpensePreset } from '../trips/quick-expense-preset';
import type { QuickExpenseDraft as QuickExpenseFormDraft } from './QuickExpenseForm';
import {
  buildRoutePreviewRequest,
  buildTodayRoutePreviewSummarySuccessState,
  routePreviewEligibility,
  todayRoutePreviewLoadingState,
  todayRoutePreviewPermissionNeededState,
  todayRoutePreviewUnsupportedState,
  type TodayRoutePreviewSummaryState,
} from '../trips/today-route-preview';
import {
  applyLocalizedTodayNextPlaceDisplay,
  applyTravelModeToTodayViewModel,
  buildTodayExecutionViewModel,
  type TodayAction,
  type TodayExecutionViewModel,
} from '../trips/today-execution';
import {
  buildTripTabUnavailableViewModel,
  buildTripTodayStatusLandingViewModel,
  findTripCalendarDay,
  type TripTabUnavailableViewModel,
  type TripTodayStatusLandingViewModel,
} from '../trips/trip-tabs';
import { isTripDefaultTravelMode, travelModeFromDisplayLabel } from '../trips/travel-mode';
import { localDateString } from '../trips/status';
import { resolveTripShellDetail } from '../trips/trip-shell-detail';
import { useTripShellState } from '../trips/trip-shell-context';

export type TripTodayState =
  | { status: 'loading' }
  | {
      status: 'ready';
      viewModel: TodayExecutionViewModel;
      spendSummary: TodaySpendSummaryViewModel;
      flightCard: TodayFlightCardViewModel | null;
      quickExpenseSyncSummary: OfflineQuickExpenseSyncSummary;
      quickExpenseFailedItems: QuickExpenseRecoveryItem[];
    }
  | { status: 'statusLanding'; viewModel: TripTodayStatusLandingViewModel; flightCard: TodayFlightCardViewModel | null }
  | { status: 'unavailable'; viewModel: TripTabUnavailableViewModel; flightCard: TodayFlightCardViewModel | null }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export type QuickExpenseOverlayState =
  | { status: 'idle' }
  | { status: 'loading'; target: QuickExpenseRouteTarget }
  | {
      status: 'ready' | 'saving';
      target: QuickExpenseRouteTarget;
      tripName: string;
      currency: SupportedCurrency;
      itinerary: GetDayScheduleItemsResponse;
      participants: TripParticipantListItem[];
      selectedItemId: string | null;
      expenseKind: 'regular' | 'public_fund';
      includeInSettlement: boolean;
      payerParticipantId: string | null;
      selectedSplitParticipantIds: string[];
      ownerUserId: string;
      draft: OfflineQuickExpenseDraft | null;
      errorMessage: string | null;
      editingQueueItemId: string | null;
    }
  | { status: 'error'; target: QuickExpenseRouteTarget; message: string };

export type QuickExpenseRecoveryItem = {
  id: string;
  amountLabel: string;
  lastError: string | null;
};

export function useTripTodayController() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const shellState = useTripShellState();
  const [state, setState] = useState<TripTodayState>({ status: 'loading' });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [quickExpenseState, setQuickExpenseState] = useState<QuickExpenseOverlayState>({ status: 'idle' });
  const [routePreviewState, setRoutePreviewState] = useState<TodayRoutePreviewSummaryState>({ status: 'idle' });
  const quickExpenseSyncInFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    setActionMessage(null);
    setPendingItemId(null);
    setRoutePreviewState({ status: 'idle' });
    setState({ status: 'loading' });

    const shellDetail = resolveTripShellDetail(shellState, tripId);
    if (shellDetail.status === 'pending') {
      return;
    }
    if (shellDetail.status !== 'success') {
      setState(todayShellFailureState(shellDetail.status));
      return;
    }

    try {
      const detail = shellDetail.detail;
      const flightsResult = await listTripFlights(tripId).catch(() => null);
      const todayFlightCard = flightsResult ? buildTodayFlightCard(flightsResult.flights, new Date()) : null;
      const today = localDateString();
      const statusLanding = buildTripTodayStatusLandingViewModel(detail, today);
      if (statusLanding) {
        setState({ status: 'statusLanding', viewModel: statusLanding, flightCard: todayFlightCard });
        return;
      }

      const currentDay = findTripCalendarDay(detail.days, today);
      if (!currentDay) {
        setState({
          status: 'unavailable',
          viewModel: buildTripTabUnavailableViewModel('today', tripId),
          flightCard: todayFlightCard,
        });
        return;
      }

      const ownerUser = await getStoredAuthUser().catch(() => null);
      const [itinerary, expensesResponse, participantsResponse, offlineQueue] = await Promise.all([
        getTripDayItinerary(tripId, currentDay.id),
        listDayExpenses(tripId, currentDay.id),
        listTripParticipants(tripId),
        ownerUser ? offlineQuickExpenseStore.listQueue(tripId, ownerUser.id) : Promise.resolve([]),
      ]);
      const viewModel = buildTodayExecutionViewModel({
        itinerary,
        ongoingTripCount: 1,
        selectedTrip: selectedTripFromDetail(detail),
        today,
        tripDetail: detail,
      });

      if (viewModel.status === 'unavailable') {
        setState({
          status: 'unavailable',
          viewModel: buildTripTabUnavailableViewModel('today', tripId),
          flightCard: todayFlightCard,
        });
        return;
      }

      const visibleOfflineQueue = visibleOfflineQuickExpenseQueue(
        offlineQueue,
        currentDay.id,
        expensesResponse.expenses,
      );
      setState({
        status: 'ready',
        viewModel,
        flightCard: todayFlightCard,
        spendSummary: buildTodaySpendSummaryViewModel({
          actionRoute:
            'quickExpenseAction' in viewModel ? viewModel.quickExpenseAction.route : viewModel.primaryAction.route,
          currentUserParticipantId: participantsResponse.currentUserParticipantId,
          defaultCurrency: detail.trip.defaultCurrency,
          expenses: expensesResponse.expenses,
          participants: participantsResponse.participants,
          pendingExpenses: visibleOfflineQueue.map((item) => ({
            amountMinor: item.request.amountMinor,
            currency: item.request.currency ?? detail.trip.defaultCurrency,
            expenseKind: item.request.expenseKind ?? 'regular',
            includeInSettlement: item.request.includeInSettlement,
          })),
        }),
        quickExpenseSyncSummary: buildOfflineQuickExpenseSyncSummary(visibleOfflineQueue, currentDay.id),
        quickExpenseFailedItems: visibleOfflineQueue
          .filter((item) => item.status === 'failed')
          .map((item) => quickExpenseRecoveryItem(item, detail.trip.defaultCurrency)),
      });
    } catch (error) {
      setState(todayFailureState(error));
    }
  }, [shellState, tripId]);

  const syncPendingQuickExpenses = useCallback(
    async ({ reload = true, showMessage = true }: { reload?: boolean; showMessage?: boolean } = {}) => {
      if (!tripId || quickExpenseSyncInFlightRef.current) {
        return null;
      }
      quickExpenseSyncInFlightRef.current = true;
      try {
        const ownerUser = await getStoredAuthUser().catch(() => null);
        if (!ownerUser) {
          return null;
        }
        const result = await syncOfflineQuickExpenses({
          store: offlineQuickExpenseStore,
          tripId,
          ownerUserId: ownerUser.id,
          createQuickExpense,
        });
        if (reload && (result.syncedCount > 0 || result.failedCount > 0 || result.pendingCount > 0)) {
          await load();
        }
        if (showMessage && result.syncedCount > 0) {
          setActionMessage(`대기 중이던 지출 ${result.syncedCount}건을 저장했어요.`);
        } else if (showMessage && result.failedCount > 0) {
          setActionMessage('저장 대기 지출을 아직 서버에 저장하지 못했어요. 내용을 확인해주세요.');
        } else if (showMessage && result.pendingCount > 0) {
          setActionMessage('저장 대기 지출을 다시 보관했어요. 연결되면 자동 저장돼요.');
        }
        return result;
      } finally {
        quickExpenseSyncInFlightRef.current = false;
      }
    },
    [load, tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await syncPendingQuickExpenses({ reload: false, showMessage: false });
        await load();
      })();
    }, [load, syncPendingQuickExpenses]),
  );

  useEffect(() => {
    if (!tripId) {
      return undefined;
    }
    return NetInfo.addEventListener((networkState) => {
      if (networkState.isConnected === false || networkState.isInternetReachable === false) {
        return;
      }
      void syncPendingQuickExpenses({ reload: true, showMessage: true });
    });
  }, [syncPendingQuickExpenses, tripId]);

  const routePreviewTarget = state.status === 'ready' && state.viewModel.status === 'success' ? state.viewModel : null;
  const routePreviewTripDayId = routePreviewTarget?.arrivalAction.date ?? null;
  const routePreviewItemId = routePreviewTarget?.nextPlace.itemId ?? null;
  const routePreviewRoutablePlace = routePreviewTarget?.nextPlace.routablePlace ?? null;
  const routePreviewGooglePlaceId = routePreviewRoutablePlace?.googlePlaceId ?? null;
  const routePreviewTravelMode = routePreviewTarget?.nextPlace.navigationAction.travelMode ?? null;

  useEffect(() => {
    if (!tripId || !routePreviewTripDayId || !routePreviewItemId || !routePreviewTravelMode) {
      setRoutePreviewState({ status: 'idle' });
      return;
    }

    const destination = {
      itemId: routePreviewItemId,
      routablePlace: routePreviewRoutablePlace,
    };
    if (routePreviewEligibility(destination) === 'unsupported' || !destination.routablePlace) {
      setRoutePreviewState(todayRoutePreviewUnsupportedState());
      return;
    }

    let cancelled = false;
    const loadRoutePreview = async () => {
      setRoutePreviewState(todayRoutePreviewLoadingState());
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          if (!cancelled) {
            setRoutePreviewState(todayRoutePreviewPermissionNeededState());
          }
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const origin = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        let response: Awaited<ReturnType<typeof createRoutePreview>> | null = null;
        try {
          response = await createRoutePreview(
            tripId,
            routePreviewTripDayId,
            routePreviewItemId,
            buildRoutePreviewRequest(origin, routePreviewTravelMode),
          );
        } catch {
          response = null;
        }
        if (!cancelled) {
          setRoutePreviewState(buildTodayRoutePreviewSummarySuccessState([{ mode: routePreviewTravelMode, response }]));
        }
      } catch {
        if (!cancelled) {
          setRoutePreviewState(
            buildTodayRoutePreviewSummarySuccessState([{ mode: routePreviewTravelMode, response: null }]),
          );
        }
      }
    };

    void loadRoutePreview();
    return () => {
      cancelled = true;
    };
  }, [routePreviewItemId, routePreviewRoutablePlace, routePreviewTravelMode, routePreviewTripDayId, tripId]);

  useEffect(() => {
    if (!tripId || !routePreviewTripDayId || !routePreviewItemId || !routePreviewGooglePlaceId) {
      return;
    }

    let cancelled = false;
    const loadLocalizedPlace = async () => {
      try {
        const details = await getGooglePlaceDetails(tripId, routePreviewTripDayId, routePreviewGooglePlaceId);
        if (cancelled) {
          return;
        }
        setState((current) => {
          if (current.status !== 'ready' || current.viewModel.status !== 'success') {
            return current;
          }
          if (current.viewModel.nextPlace.itemId !== routePreviewItemId) {
            return current;
          }
          return {
            ...current,
            viewModel: applyLocalizedTodayNextPlaceDisplay(current.viewModel, {
              displayName: details.displayName,
              formattedAddress: details.formattedAddress,
            }),
          };
        });
      } catch {
        // Stored place copy remains the fallback when localized Google details are unavailable.
      }
    };

    void loadLocalizedPlace();
    return () => {
      cancelled = true;
    };
  }, [routePreviewGooglePlaceId, routePreviewItemId, routePreviewTripDayId, tripId]);

  const openQuickExpenseOverlay = useCallback(
    async (target: QuickExpenseRouteTarget) => {
      setActionMessage(null);
      setQuickExpenseState({ status: 'loading', target });
      try {
        const shellDetail = resolveTripShellDetail(shellState, target.tripId);
        if (shellDetail.status !== 'success') {
          throw new Error('trip detail is not ready');
        }
        const [itinerary, participantsResponse] = await Promise.all([
          getTripDayItinerary(target.tripId, target.date),
          listTripParticipants(target.tripId),
        ]);
        const tripDetail = shellDetail.detail;
        const participants = participantsResponse.participants;
        const ownerUser = await getStoredAuthUser();
        const [preset, storedDraft] = await Promise.all([
          loadQuickExpensePreset({
            currentUserParticipantId: participantsResponse.currentUserParticipantId,
            participants,
            tripId: target.tripId,
          }),
          offlineQuickExpenseStore.loadDraft(ownerUser.id, target.tripId, target.date),
        ]);
        const selectedItemId = resolveQuickExpenseSelectedItemId({
          itinerary,
          preferredItemId: storedDraft?.itemId ?? target.itemId,
        });
        const preferredPayerParticipantId =
          storedDraft?.payerParticipantId ??
          preset.payerParticipantId ??
          (participants.length === 1 ? (participants[0]?.participantId ?? null) : null);
        const preferredSplitParticipantIds =
          storedDraft?.splitParticipantIds ??
          (preset.splitParticipantIds.length > 0
            ? preset.splitParticipantIds
            : buildDefaultSplitParticipantIds(participants));
        const payerParticipantId = resolveQuickExpensePayerParticipantId(preferredPayerParticipantId, participants);
        const selectedSplitParticipantIds = resolveQuickExpenseSplitParticipantIds(
          preferredSplitParticipantIds,
          participants,
        );
        setQuickExpenseState({
          status: 'ready',
          target,
          tripName: tripDetail.trip.name.trim() || '여행',
          currency: tripDetail.trip.defaultCurrency,
          itinerary,
          participants,
          selectedItemId,
          expenseKind: storedDraft?.expenseKind ?? preset.expenseKind,
          includeInSettlement: storedDraft?.includeInSettlement ?? preset.includeInSettlement,
          payerParticipantId,
          selectedSplitParticipantIds,
          ownerUserId: ownerUser.id,
          draft: storedDraft,
          errorMessage: null,
          editingQueueItemId: null,
        });
      } catch (error) {
        if (await clearStoredSessionOnAnyMobileAuthOrApiAuthError(error)) {
          setQuickExpenseState({ status: 'idle' });
          setState({ status: 'auth' });
          return;
        }
        setQuickExpenseState({
          status: 'error',
          target,
          message: quickExpenseFailureMessage(apiErrorStatus(error)),
        });
      }
    },
    [shellState],
  );

  const closeQuickExpenseOverlay = useCallback(() => {
    setQuickExpenseState({ status: 'idle' });
  }, []);

  const submitQuickExpenseOverlay = useCallback(
    async ({
      amount,
      expenseKind,
      itemId,
      memoInput,
      payerParticipantId,
      splitParticipantIds,
      includeInSettlement,
      receiptDraftId,
    }: {
      amount: number;
      expenseKind: 'regular' | 'public_fund';
      itemId: string;
      memoInput: string;
      payerParticipantId: string;
      splitParticipantIds: string[];
      includeInSettlement: boolean;
      receiptDraftId?: string | null;
    }) => {
      if (quickExpenseState.status !== 'ready' || quickExpenseState.target.tripId !== tripId) {
        return;
      }

      const clientMutationId = quickExpenseState.editingQueueItemId ?? newOfflineQuickExpenseClientMutationId();
      const validation = buildCreateQuickExpenseRequest({
        amountInput: String(amount),
        currency: quickExpenseState.currency,
        scheduleItemId: itemId,
        tripPlaceId: null,
        expenseKind,
        splitPolicy: 'equal',
        participantIds: splitParticipantIds,
        manualSplitInputs: [],
        payerParticipantId,
        includeInSettlement,
        receiptDraftId: receiptDraftId ?? null,
        memoInput,
        clientMutationId,
      });
      if (!validation.ok) {
        setQuickExpenseState((current) =>
          current.status === 'ready'
            ? { ...current, errorMessage: Object.values(validation.errors).find(Boolean) ?? null }
            : current,
        );
        return;
      }

      setQuickExpenseState({ ...quickExpenseState, status: 'saving', errorMessage: null });
      try {
        await offlineQuickExpenseStore.enqueue({
          id: clientMutationId,
          ownerUserId: quickExpenseState.ownerUserId,
          tripId: quickExpenseState.target.tripId,
          tripDayId: quickExpenseState.target.date,
          request: validation.request,
        });
      } catch {
        setQuickExpenseState({
          ...quickExpenseState,
          status: 'ready',
          errorMessage: '기기에 지출을 안전하게 저장할 수 없어요. 저장 공간을 확인하고 다시 시도해주세요.',
        });
        return;
      }

      await Promise.all([
        offlineQuickExpenseStore
          .clearDraft(quickExpenseState.ownerUserId, quickExpenseState.target.tripId, quickExpenseState.target.date)
          .catch(() => undefined),
        saveQuickExpensePreset({
          tripId: quickExpenseState.target.tripId,
          preset: {
            expenseKind,
            includeInSettlement,
            payerParticipantId,
            splitParticipantIds,
            splitTargetMode:
              quickExpenseState.participants.length <= 1
                ? 'self'
                : splitParticipantIds.length === quickExpenseState.participants.length
                  ? 'all'
                  : 'custom',
          },
        }).catch(() => undefined),
      ]);

      const optimisticAmountLabel = buildSavedEqualSplitSummary({
        amountMinor: validation.request.amountMinor,
        currency: validation.request.currency ?? quickExpenseState.currency,
        splits: [],
      }).amountLabel;
      setQuickExpenseState({ status: 'idle' });
      await load().catch(() => undefined);
      const result = await syncPendingQuickExpenses({ reload: true, showMessage: false });
      if (result && result.syncedCount > 0) {
        setActionMessage(`지출을 저장했어요. ${optimisticAmountLabel}`);
        return;
      }
      setActionMessage(`지출을 기기에 보관했어요. ${optimisticAmountLabel} · 연결되면 자동 저장돼요.`);
    },
    [load, quickExpenseState, syncPendingQuickExpenses, tripId],
  );

  const saveQuickExpenseOverlayDraft = useCallback(
    (draft: QuickExpenseFormDraft) => {
      if (
        (quickExpenseState.status !== 'ready' && quickExpenseState.status !== 'saving') ||
        quickExpenseState.target.tripId !== tripId
      ) {
        return;
      }
      void offlineQuickExpenseStore.saveDraft({
        ownerUserId: quickExpenseState.ownerUserId,
        tripId: quickExpenseState.target.tripId,
        tripDayId: quickExpenseState.target.date,
        amountInput: draft.amountInput,
        itemId: draft.itemId,
        payerParticipantId: draft.payerParticipantId,
        splitMode: draft.splitMode,
        splitParticipantIds: draft.splitParticipantIds,
        memoInput: draft.memoInput,
        expenseKind: draft.expenseKind,
        includeInSettlement: draft.includeInSettlement,
      });
    },
    [quickExpenseState, tripId],
  );

  const retryQuickExpenseSync = useCallback(
    async (itemId?: string) => {
      if (!itemId) {
        await syncPendingQuickExpenses({ reload: true, showMessage: true });
        return;
      }
      if (!tripId || quickExpenseSyncInFlightRef.current) {
        return;
      }
      quickExpenseSyncInFlightRef.current = true;
      try {
        const ownerUser = await getStoredAuthUser().catch(() => null);
        if (!ownerUser) {
          return;
        }
        const result = await syncOfflineQuickExpenses({
          store: offlineQuickExpenseStore,
          tripId,
          ownerUserId: ownerUser.id,
          itemId,
          createQuickExpense,
        });
        if (result.syncedCount > 0 || result.failedCount > 0 || result.pendingCount > 0) {
          await load();
        }
        if (result.syncedCount > 0) {
          setActionMessage('선택한 저장 실패 지출을 저장했어요.');
        } else if (result.failedCount > 0) {
          setActionMessage('선택한 지출을 아직 서버에 저장하지 못했어요. 내용을 확인해주세요.');
        } else if (result.pendingCount > 0) {
          setActionMessage('선택한 지출을 다시 대기 상태로 보관했어요. 연결되면 자동 저장돼요.');
        }
      } finally {
        quickExpenseSyncInFlightRef.current = false;
      }
    },
    [load, syncPendingQuickExpenses, tripId],
  );

  const editFailedQuickExpense = useCallback(
    async (itemId: string) => {
      if (!tripId) {
        return;
      }
      const ownerUser = await getStoredAuthUser().catch(() => null);
      if (!ownerUser) {
        setState({ status: 'auth' });
        return;
      }
      const item = (await offlineQuickExpenseStore.listQueue(tripId, ownerUser.id)).find(
        (queueItem) => queueItem.id === itemId,
      );
      if (!item) {
        await load();
        return;
      }
      await offlineQuickExpenseStore.saveDraft(quickExpenseDraftFromQueueItem(item));
      await openQuickExpenseOverlay({
        tripId: item.tripId,
        date: item.tripDayId,
        itemId: item.request.scheduleItemId,
      });
      setQuickExpenseState((current) =>
        (current.status === 'ready' || current.status === 'saving') &&
        current.target.tripId === item.tripId &&
        current.target.date === item.tripDayId
          ? { ...current, editingQueueItemId: item.id }
          : current,
      );
      await load().catch(() => undefined);
      setActionMessage('저장 실패 지출을 수정할 수 있도록 다시 열었어요.');
    },
    [load, openQuickExpenseOverlay, tripId],
  );

  const deleteFailedQuickExpense = useCallback(
    async (itemId: string) => {
      if (!tripId) {
        return;
      }
      const ownerUser = await getStoredAuthUser().catch(() => null);
      if (!ownerUser) {
        setState({ status: 'auth' });
        return;
      }
      const item = (await offlineQuickExpenseStore.listQueue(tripId, ownerUser.id)).find(
        (queueItem) => queueItem.id === itemId,
      );
      if (!item) {
        await load();
        return;
      }
      await offlineQuickExpenseStore.removeQueueItem(item.id);
      await load().catch(() => undefined);
      setActionMessage('저장 실패 지출을 삭제했어요.');
    },
    [load, tripId],
  );

  const runAction = useCallback(
    async (action: TodayAction) => {
      if (!tripId) {
        return;
      }

      setActionMessage(null);
      if (action.kind === 'route') {
        const quickExpenseTarget = parseQuickExpenseRoute(action.route);
        if (quickExpenseTarget) {
          await openQuickExpenseOverlay(quickExpenseTarget);
          return;
        }
        router.push(action.route);
        return;
      }
      if (action.kind === 'retry') {
        await load();
        return;
      }
      if (action.kind === 'navigate') {
        const result = await openTodayNavigationDestination({
          destination: action.destination,
          launcher: Linking,
          platform: Platform.OS,
          provider: action.provider,
          travelMode: action.travelMode,
        });
        if (result.status === 'failed') {
          setActionMessage(result.message);
        }
        return;
      }

      setPendingItemId(action.itemId);
      try {
        if (action.kind === 'arrive') {
          await markScheduleItemArrived(action.tripId, action.date, action.itemId);
          setActionMessage('도착 처리했어요.');
        }
        if (action.kind === 'skip') {
          await markScheduleItemSkipped(action.tripId, action.date, action.itemId);
          setActionMessage('나중에 볼 장소로 넘겼어요.');
        }
        if (action.kind === 'restore') {
          await restoreScheduleItem(action.tripId, action.date, action.itemId);
          setActionMessage('다시 진행할 장소로 되돌렸어요.');
        }
        await load();
      } catch (error) {
        if (isAnyMobileAuthOrApiAuthError(error)) {
          setState({ status: 'auth' });
          return;
        }
        setActionMessage('처리할 수 없어요. 잠시 후 다시 시도해주세요.');
      } finally {
        setPendingItemId(null);
      }
    },
    [load, openQuickExpenseOverlay, tripId],
  );

  const handleTravelMode = useCallback(
    (label: string) => {
      const travelMode = travelModeFromDisplayLabel(label);
      if (!tripId || !isTripDefaultTravelMode(travelMode)) {
        return;
      }

      setActionMessage(null);
      setState((current) => {
        if (current.status !== 'ready') {
          return current;
        }
        return { ...current, viewModel: applyTravelModeToTodayViewModel(current.viewModel, travelMode) };
      });

      void updateTrip(tripId, { defaultTravelMode: travelMode }).catch(async (error) => {
        if (isAnyMobileAuthOrApiAuthError(error)) {
          setState({ status: 'auth' });
          return;
        }
        setActionMessage('기본 이동 방식을 저장할 수 없어요. 잠시 후 다시 시도해주세요.');
        await load();
      });
    },
    [load, tripId],
  );

  const goToLogin = () => {
    router.replace('/login');
  };

  const goHome = () => {
    router.replace('/');
  };

  return {
    actionMessage,
    closeQuickExpenseOverlay,
    deleteFailedQuickExpense,
    editFailedQuickExpense,
    goHome,
    goToLogin,
    handleTravelMode,
    load,
    openQuickExpenseOverlay,
    pendingItemId,
    quickExpenseState,
    routePreviewState,
    retryQuickExpenseSync,
    runAction,
    saveQuickExpenseOverlayDraft,
    state,
    submitQuickExpenseOverlay,
  };
}

function resolveQuickExpenseSelectedItemId({
  itinerary,
  preferredItemId,
}: {
  itinerary: GetDayScheduleItemsResponse;
  preferredItemId?: string | null;
}): string | null {
  if (preferredItemId && itinerary.scheduleItems.some((item) => item.id === preferredItemId)) {
    return preferredItemId;
  }
  return resolveTodayQuickExpenseInitialItemId(itinerary.scheduleItems, null);
}

function resolveQuickExpensePayerParticipantId(
  preferredParticipantId: string | null,
  participants: TripParticipantListItem[],
): string | null {
  if (
    preferredParticipantId &&
    participants.some((participant) => participant.participantId === preferredParticipantId)
  ) {
    return preferredParticipantId;
  }
  return participants.length === 1 ? participants[0].participantId : null;
}

function resolveQuickExpenseSplitParticipantIds(
  preferredParticipantIds: string[] | null,
  participants: TripParticipantListItem[],
): string[] {
  const participantIds = new Set(participants.map((participant) => participant.participantId));
  const restored = preferredParticipantIds?.filter((participantId) => participantIds.has(participantId)) ?? [];
  return restored.length > 0 ? restored : buildDefaultSplitParticipantIds(participants);
}

function visibleOfflineQuickExpenseQueue(
  queue: OfflineQuickExpenseQueueItem[],
  tripDayId: string,
  serverExpenses: DayExpenseListItem[],
): OfflineQuickExpenseQueueItem[] {
  const serverClientMutationIds = new Set(
    serverExpenses.map((expense) => expense.clientMutationId).filter((id): id is string => Boolean(id)),
  );
  return queue.filter((item) => {
    if (item.tripDayId !== tripDayId) {
      return false;
    }
    const clientMutationId = item.request.clientMutationId?.trim() || item.id;
    return !serverClientMutationIds.has(clientMutationId);
  });
}

function quickExpenseRecoveryItem(
  item: OfflineQuickExpenseQueueItem,
  defaultCurrency: SupportedCurrency,
): QuickExpenseRecoveryItem {
  return {
    id: item.id,
    amountLabel: buildSavedEqualSplitSummary({
      amountMinor: item.request.amountMinor,
      currency: item.request.currency ?? defaultCurrency,
      splits: [],
    }).amountLabel,
    lastError: item.lastError,
  };
}

function quickExpenseDraftFromQueueItem(item: OfflineQuickExpenseQueueItem): OfflineQuickExpenseDraftInput {
  return {
    ownerUserId: item.ownerUserId,
    tripId: item.tripId,
    tripDayId: item.tripDayId,
    amountInput: quickExpenseAmountInput(item.request.amountMinor, item.request.currency),
    expenseKind: item.request.expenseKind ?? 'regular',
    itemId: item.request.scheduleItemId,
    payerParticipantId: item.request.payerParticipantId,
    splitMode: item.request.splitPolicy as QuickExpenseSplitPolicy,
    splitParticipantIds: item.request.participantIds ?? item.request.splits?.map((split) => split.participantId) ?? [],
    memoInput: item.request.memo ?? '',
    includeInSettlement: item.request.includeInSettlement ?? item.request.expenseKind !== 'public_fund',
  };
}

function quickExpenseAmountInput(amountMinor: number, currency?: SupportedCurrency): string {
  if (currency === 'USD' || currency === 'EUR') {
    return (amountMinor / 100).toFixed(2);
  }
  return String(amountMinor);
}

function selectedTripFromDetail(detail: GetTripDetailResponse): TripListItem {
  return {
    id: detail.trip.id,
    name: detail.trip.name,
    startDate: detail.trip.startDate,
    endDate: detail.trip.endDate,
    defaultCurrency: detail.trip.defaultCurrency,
    defaultTravelMode: detail.trip.defaultTravelMode,
    joinedAt: detail.trip.createdAt,
    createdAt: detail.trip.createdAt,
    myRole: 'member',
    participantCount: detail.participantSummary.totalCount,
    eventContext: detail.trip.eventContext,
  };
}

function todayFailureState(error: unknown): TripTodayState {
  if (isMobileAuthSessionError(error) || isApiStatus(error, 401)) {
    return { status: 'auth' };
  }
  if (isApiStatus(error, 400, 403, 404)) {
    return { status: 'notFound' };
  }
  return { status: 'error' };
}

function todayShellFailureState(status: 'auth' | 'notFound' | 'error'): TripTodayState {
  return { status };
}
