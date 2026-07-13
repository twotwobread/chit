import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  type GetDayScheduleItemsResponse,
  type GetTripDetailResponse,
  type SupportedCurrency,
  type TripListItem,
  type TripParticipantListItem,
} from '@i-um/api-contract';

import {
  apiErrorStatus,
  clearStoredSessionOnAnyMobileAuthOrApiAuthError,
  isAnyMobileAuthOrApiAuthError,
  isApiStatus,
  isMobileAuthSessionError,
} from '../auth/errors';
import { listTripFlights } from '../flights/flight-api';
import { buildTodayFlightCard, type TodayFlightCardViewModel } from '../flights/today';
import { createQuickExpense, listDayExpenses, updateExpense } from '../trips/expense-api';
import {
  createRoutePreview,
  getTripDayItinerary,
  markScheduleItemArrived,
  markScheduleItemSkipped,
  restoreScheduleItem,
} from '../trips/itinerary-api';
import { getTripDetail, listTripParticipants } from '../trips/trip-api';
import { openTodayNavigationDestination } from '../trips/today-navigation';
import { buildTodaySpendSummaryViewModel, type TodaySpendSummaryViewModel } from '../trips/today-spend';
import {
  buildCreateQuickExpenseRequest,
  buildDefaultSplitParticipantIds,
  buildQuickExpenseMemoUpdateRequest,
  buildSavedEqualSplitSummary,
  parseQuickExpenseRoute,
  quickExpenseFailureMessage,
  resolveInitialQuickExpenseItemId,
  type QuickExpenseRouteTarget,
} from '../trips/quick-expense';
import {
  buildRoutePreviewRequest,
  buildTodayRoutePreviewHeroChip,
  routePreviewEligibility,
  todayRoutePreviewHeroChipFallbackCopy,
  todayRoutePreviewPermissionNeededState,
  todayRoutePreviewSuccessState,
  todayRoutePreviewUnavailableState,
  todayRoutePreviewUnsupportedState,
} from '../trips/today-route-preview';
import {
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
import { readStoredTravelMode, saveSelectedTravelMode, travelModeFromDisplayLabel } from '../trips/travel-mode';
import { localDateString } from '../trips/status';

export type TripTodayState =
  | { status: 'loading' }
  | {
      status: 'ready';
      viewModel: TodayExecutionViewModel;
      spendSummary: TodaySpendSummaryViewModel;
      flightCard: TodayFlightCardViewModel | null;
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
      payerParticipantId: string | null;
      selectedSplitParticipantIds: string[];
      errorMessage: string | null;
    }
  | { status: 'error'; target: QuickExpenseRouteTarget; message: string };

export function useTripTodayController() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [state, setState] = useState<TripTodayState>({ status: 'loading' });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [quickExpenseState, setQuickExpenseState] = useState<QuickExpenseOverlayState>({ status: 'idle' });
  const [routeChip, setRouteChip] = useState(todayRoutePreviewHeroChipFallbackCopy);

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    setActionMessage(null);
    setPendingItemId(null);
    setRouteChip(todayRoutePreviewHeroChipFallbackCopy);
    setState({ status: 'loading' });
    try {
      const [detail, storedTravelMode, flightsResult] = await Promise.all([
        getTripDetail(tripId),
        readStoredTravelMode(),
        listTripFlights(tripId).catch(() => null),
      ]);
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

      const [itinerary, expensesResponse] = await Promise.all([
        getTripDayItinerary(tripId, currentDay.id),
        listDayExpenses(tripId, currentDay.id),
      ]);
      const viewModel = buildTodayExecutionViewModel({
        itinerary,
        ongoingTripCount: 1,
        selectedTrip: selectedTripFromDetail(detail),
        today,
        travelMode: storedTravelMode.mode,
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

      setState({
        status: 'ready',
        viewModel,
        flightCard: todayFlightCard,
        spendSummary: buildTodaySpendSummaryViewModel({
          actionRoute:
            'quickExpenseAction' in viewModel ? viewModel.quickExpenseAction.route : viewModel.primaryAction.route,
          defaultCurrency: detail.trip.defaultCurrency,
          expenses: expensesResponse.expenses,
        }),
      });
    } catch (error) {
      setState(todayFailureState(error));
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!tripId || state.status !== 'ready' || state.viewModel.status !== 'success') {
      setRouteChip(todayRoutePreviewHeroChipFallbackCopy);
      return;
    }

    const successViewModel = state.viewModel;
    const destination = {
      itemId: successViewModel.nextPlace.itemId,
      routablePlace: successViewModel.nextPlace.routablePlace,
    };
    if (routePreviewEligibility(destination) === 'unsupported' || !destination.routablePlace) {
      setRouteChip(buildTodayRoutePreviewHeroChip(todayRoutePreviewUnsupportedState()));
      return;
    }

    let cancelled = false;
    const loadRoutePreview = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          if (!cancelled) {
            setRouteChip(buildTodayRoutePreviewHeroChip(todayRoutePreviewPermissionNeededState()));
          }
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const response = await createRoutePreview(
          tripId,
          successViewModel.arrivalAction.date,
          successViewModel.nextPlace.itemId,
          buildRoutePreviewRequest({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        );
        if (!cancelled) {
          setRouteChip(buildTodayRoutePreviewHeroChip(todayRoutePreviewSuccessState(response)));
        }
      } catch {
        if (!cancelled) {
          setRouteChip(buildTodayRoutePreviewHeroChip(todayRoutePreviewUnavailableState()));
        }
      }
    };

    void loadRoutePreview();
    return () => {
      cancelled = true;
    };
  }, [state, tripId]);

  const openQuickExpenseOverlay = useCallback(async (target: QuickExpenseRouteTarget) => {
    setActionMessage(null);
    setQuickExpenseState({ status: 'loading', target });
    try {
      const [tripDetail, itinerary, participantsResponse] = await Promise.all([
        getTripDetail(target.tripId),
        getTripDayItinerary(target.tripId, target.date),
        listTripParticipants(target.tripId),
      ]);
      const selectedItemId = resolveInitialQuickExpenseItemId(itinerary.scheduleItems, target.itemId);
      const participants = participantsResponse.participants;
      setQuickExpenseState({
        status: 'ready',
        target,
        tripName: tripDetail.trip.name.trim() || '여행',
        currency: tripDetail.trip.defaultCurrency,
        itinerary,
        participants,
        selectedItemId,
        payerParticipantId: participants.length === 1 ? participants[0].participantId : null,
        selectedSplitParticipantIds: buildDefaultSplitParticipantIds(participants),
        errorMessage: null,
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
  }, []);

  const closeQuickExpenseOverlay = useCallback(() => {
    setQuickExpenseState({ status: 'idle' });
  }, []);

  const submitQuickExpenseOverlay = useCallback(
    async ({
      amount,
      itemId,
      memoInput,
      payerParticipantId,
      splitParticipantIds,
    }: {
      amount: number;
      itemId: string;
      memoInput: string;
      payerParticipantId: string;
      splitParticipantIds: string[];
    }) => {
      if (quickExpenseState.status !== 'ready' || quickExpenseState.target.tripId !== tripId) {
        return;
      }

      const validation = buildCreateQuickExpenseRequest({
        amountInput: String(amount),
        currency: quickExpenseState.currency,
        scheduleItemId: itemId,
        splitPolicy: 'equal',
        participantIds: splitParticipantIds,
        manualSplitInputs: [],
        payerParticipantId,
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
        const response = await createQuickExpense(
          quickExpenseState.target.tripId,
          quickExpenseState.target.date,
          validation.request,
        );
        const memoUpdateRequest = buildQuickExpenseMemoUpdateRequest({
          createRequest: validation.request,
          memoInput,
        });
        if (memoUpdateRequest) {
          await updateExpense(
            quickExpenseState.target.tripId,
            quickExpenseState.target.date,
            response.expense.id,
            memoUpdateRequest,
          );
        }
        const summary = buildSavedEqualSplitSummary({
          amountMinor: response.expense.amountMinor,
          currency: response.expense.currency,
          splits: response.expense.splits,
        });
        setQuickExpenseState({ status: 'idle' });
        await load();
        setActionMessage(`지출을 저장했어요. ${summary.amountLabel}`);
      } catch (error) {
        if (await clearStoredSessionOnAnyMobileAuthOrApiAuthError(error)) {
          setQuickExpenseState({ status: 'idle' });
          setState({ status: 'auth' });
          return;
        }
        if (isApiStatus(error, 409)) {
          setQuickExpenseState({
            ...quickExpenseState,
            status: 'ready',
            errorMessage: quickExpenseFailureMessage(apiErrorStatus(error)),
          });
          void openQuickExpenseOverlay(quickExpenseState.target);
          return;
        }
        setQuickExpenseState({
          ...quickExpenseState,
          status: 'ready',
          errorMessage: quickExpenseFailureMessage(apiErrorStatus(error)),
        });
      }
    },
    [load, openQuickExpenseOverlay, quickExpenseState, tripId],
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

  const handleTravelMode = useCallback((label: string) => {
    const travelMode = travelModeFromDisplayLabel(label);
    if (!travelMode) {
      return;
    }

    setState((current) => {
      if (current.status !== 'ready') {
        return current;
      }
      return { ...current, viewModel: applyTravelModeToTodayViewModel(current.viewModel, travelMode) };
    });
    void saveSelectedTravelMode(travelMode);
  }, []);

  const goToLogin = () => {
    router.replace('/login');
  };

  const goHome = () => {
    router.replace('/');
  };

  return {
    actionMessage,
    closeQuickExpenseOverlay,
    goHome,
    goToLogin,
    handleTravelMode,
    load,
    openQuickExpenseOverlay,
    pendingItemId,
    quickExpenseState,
    routeChip,
    runAction,
    state,
    submitQuickExpenseOverlay,
  };
}

function selectedTripFromDetail(detail: GetTripDetailResponse): TripListItem {
  return {
    id: detail.trip.id,
    name: detail.trip.name,
    startDate: detail.trip.startDate,
    endDate: detail.trip.endDate,
    defaultCurrency: detail.trip.defaultCurrency,
    joinedAt: detail.trip.createdAt,
    createdAt: detail.trip.createdAt,
    myRole: 'member',
    participantCount: detail.participantSummary.totalCount,
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
