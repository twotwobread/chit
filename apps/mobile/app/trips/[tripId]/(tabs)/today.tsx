import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  ApiError,
  type GetDayScheduleItemsResponse,
  type GetTripDetailResponse,
  type SupportedCurrency,
  type TripListItem,
  type TripParticipantListItem,
} from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { clearStoredSession } from '../../../../lib/auth/session';
import { Card, ListRow, PrimaryButton, SecondaryButton, theme } from '../../../../lib/design';
import { BottomSheet } from '../../../../lib/trip-ui/BottomSheet';
import { NextPlaceHeroCard } from '../../../../lib/trip-ui/NextPlaceHeroCard';
import { TodaySpendCard } from '../../../../lib/trip-ui/TodaySpendCard';
import { QuickExpenseForm } from '../../../../lib/trip-ui/QuickExpenseForm';
import { TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import {
  createQuickExpense,
  createRoutePreview,
  getTripDayItinerary,
  getTripDetail,
  listDayExpenses,
  listTripParticipants,
  markScheduleItemArrived,
  markScheduleItemSkipped,
  restoreScheduleItem,
} from '../../../../lib/trips/client';
import { openTodayNavigationDestination } from '../../../../lib/trips/today-navigation';
import { buildTodaySpendSummaryViewModel, type TodaySpendSummaryViewModel } from '../../../../lib/trips/today-spend';
import {
  buildCreateQuickExpenseRequest,
  buildDefaultSplitParticipantIds,
  buildQuickExpenseViewModel,
  buildSavedEqualSplitSummary,
  parseQuickExpenseRoute,
  quickExpenseFailureMessage,
  type QuickExpenseRouteTarget,
} from '../../../../lib/trips/quick-expense';
import {
  buildRoutePreviewRequest,
  buildTodayRoutePreviewHeroChip,
  routePreviewEligibility,
  todayRoutePreviewHeroChipFallbackCopy,
  todayRoutePreviewSuccessState,
} from '../../../../lib/trips/today-route-preview';
import {
  applyTravelModeToTodayViewModel,
  buildTodayExecutionViewModel,
  type TodayAction,
  type TodayExecutionViewModel,
  type TodayRestoreAction,
  type TodaySkippedPlacesSectionViewModel,
} from '../../../../lib/trips/today-execution';
import {
  buildTripTabUnavailableViewModel,
  findTripCalendarDay,
  type TripTabUnavailableViewModel,
} from '../../../../lib/trips/trip-tabs';
import {
  readStoredTravelMode,
  saveSelectedTravelMode,
  travelModeDisplayLabel,
  travelModeDisplayOptions,
  travelModeFromDisplayLabel,
} from '../../../../lib/trips/travel-mode';
import { localDateString } from '../../../../lib/trips/status';

type TripTodayState =
  | { status: 'loading' }
  | { status: 'ready'; viewModel: TodayExecutionViewModel; spendSummary: TodaySpendSummaryViewModel }
  | { status: 'unavailable'; viewModel: TripTabUnavailableViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

type QuickExpenseOverlayState =
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

export default function TripTodayTabScreen() {
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
      const [detail, storedTravelMode] = await Promise.all([getTripDetail(tripId), readStoredTravelMode()]);
      const today = localDateString();
      const currentDay = findTripCalendarDay(detail.days, today);
      if (!currentDay) {
        setState({ status: 'unavailable', viewModel: buildTripTabUnavailableViewModel('today', tripId) });
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
        setState({ status: 'unavailable', viewModel: buildTripTabUnavailableViewModel('today', tripId) });
        return;
      }

      setState({
        status: 'ready',
        viewModel,
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
      setRouteChip(todayRoutePreviewHeroChipFallbackCopy);
      return;
    }

    let cancelled = false;
    const loadRoutePreview = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) {
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
          setRouteChip(todayRoutePreviewHeroChipFallbackCopy);
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
      const validItemId =
        target.itemId && itinerary.scheduleItems.some((item) => item.id === target.itemId) ? target.itemId : null;
      const participants = participantsResponse.participants;
      setQuickExpenseState({
        status: 'ready',
        target,
        tripName: tripDetail.trip.name.trim() || '여행',
        currency: tripDetail.trip.defaultCurrency,
        itinerary,
        participants,
        selectedItemId: validItemId,
        payerParticipantId: participants.length === 1 ? participants[0].participantId : null,
        selectedSplitParticipantIds: buildDefaultSplitParticipantIds(participants),
        errorMessage: null,
      });
    } catch (error) {
      if (error instanceof MobileAuthError || (error instanceof ApiError && error.status === 401)) {
        await clearStoredSession();
        setQuickExpenseState({ status: 'idle' });
        setState({ status: 'auth' });
        return;
      }
      setQuickExpenseState({
        status: 'error',
        target,
        message: quickExpenseFailureMessage(error instanceof ApiError ? error.status : undefined),
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
      payerParticipantId,
      splitParticipantIds,
    }: {
      amount: number;
      itemId: string;
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
        const summary = buildSavedEqualSplitSummary({
          amountMinor: response.expense.amountMinor,
          currency: response.expense.currency,
          splits: response.expense.splits,
        });
        setQuickExpenseState({ status: 'idle' });
        await load();
        setActionMessage(`지출을 저장했어요. ${summary.amountLabel}`);
      } catch (error) {
        if (error instanceof MobileAuthError || (error instanceof ApiError && error.status === 401)) {
          await clearStoredSession();
          setQuickExpenseState({ status: 'idle' });
          setState({ status: 'auth' });
          return;
        }
        if (error instanceof ApiError && error.status === 409) {
          setQuickExpenseState({
            ...quickExpenseState,
            status: 'ready',
            errorMessage: quickExpenseFailureMessage(error.status),
          });
          void openQuickExpenseOverlay(quickExpenseState.target);
          return;
        }
        setQuickExpenseState({
          ...quickExpenseState,
          status: 'ready',
          errorMessage: quickExpenseFailureMessage(error instanceof ApiError ? error.status : undefined),
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
        if (error instanceof MobileAuthError || (error instanceof ApiError && error.status === 401)) {
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

  return (
    <TripScreen>
      <TripScreenHeader helper="선택한 여행의 오늘 할 일을 바로 확인해요." title="오늘" />

      {state.status === 'loading' ? <TripStateCard loading title="오늘 일정을 불러오는 중..." /> : null}
      {state.status === 'auth' ? (
        <TripStateCard
          primaryAction={{ label: '로그인하기', onPress: () => router.replace('/login') }}
          title="다시 로그인해주세요."
        />
      ) : null}
      {state.status === 'notFound' ? (
        <TripStateCard
          helper="삭제되었거나 접근할 수 없는 여행이에요."
          primaryAction={{ label: '홈으로', onPress: () => router.replace('/') }}
          title="여행을 찾을 수 없어요."
        />
      ) : null}
      {state.status === 'error' ? (
        <TripStateCard
          helper="잠시 후 다시 시도해주세요."
          primaryAction={{ label: '다시 시도', onPress: () => void load() }}
          title="오늘 일정을 불러올 수 없어요."
        />
      ) : null}
      {state.status === 'unavailable' ? <UnavailableState viewModel={state.viewModel} /> : null}
      {state.status === 'ready' ? (
        <TodayReadyContent
          actionMessage={actionMessage}
          onAction={(action) => void runAction(action)}
          onTravelMode={handleTravelMode}
          pendingItemId={pendingItemId}
          routeChip={routeChip}
          spendSummary={state.spendSummary}
          viewModel={state.viewModel}
        />
      ) : null}

      <QuickExpenseOverlaySheet
        onClose={closeQuickExpenseOverlay}
        onRetry={(target) => void openQuickExpenseOverlay(target)}
        onSubmit={(payload) => void submitQuickExpenseOverlay(payload)}
        state={quickExpenseState}
      />
    </TripScreen>
  );
}

function TodayReadyContent({
  actionMessage,
  onAction,
  onTravelMode,
  pendingItemId,
  routeChip,
  spendSummary,
  viewModel,
}: {
  viewModel: TodayExecutionViewModel;
  spendSummary: TodaySpendSummaryViewModel;
  actionMessage: string | null;
  pendingItemId: string | null;
  routeChip: string;
  onAction: (action: TodayAction) => void;
  onTravelMode: (label: string) => void;
}) {
  return (
    <>
      {viewModel.status === 'success' ? (
        <NextPlaceHeroCard
          arriveDisabled={pendingItemId === viewModel.arrivalAction.itemId}
          arriveLabel={pendingItemId === viewModel.arrivalAction.itemId ? '처리 중...' : viewModel.arrivalAction.label}
          lodgingDisabled={viewModel.lodgingNavigationAction.disabled}
          lodgingHelper={viewModel.lodgingNavigationAction.helper ?? undefined}
          lodgingLabel={viewModel.lodgingNavigationAction.label}
          onArrive={() => onAction(viewModel.arrivalAction)}
          navigationAvailable={Boolean(viewModel.nextPlace.navigationAction.label)}
          onLodging={() => {
            if (viewModel.lodgingNavigationAction.action) {
              onAction(viewModel.lodgingNavigationAction.action);
            }
          }}
          onNavigate={() => {
            if (viewModel.nextPlace.navigationAction.label) {
              onAction(viewModel.nextPlace.navigationAction);
            }
          }}
          onSkip={() => onAction(viewModel.skipAction)}
          onTravelMode={onTravelMode}
          place={{
            address: viewModel.nextPlace.address,
            legText: viewModel.nextPlace.placeTypeLabel,
            name: viewModel.nextPlace.placeName,
            order: viewModel.nextPlace.order,
            type: viewModel.nextPlace.placeType,
          }}
          skipDisabled={pendingItemId === viewModel.skipAction.itemId}
          routeChip={routeChip}
          skipLabel={pendingItemId === viewModel.skipAction.itemId ? '처리 중...' : viewModel.skipAction.label}
          travelMode={
            viewModel.nextPlace.navigationAction.label
              ? travelModeDisplayLabel(viewModel.nextPlace.navigationAction.travelMode)
              : ''
          }
          travelOptions={travelModeDisplayOptions}
        />
      ) : null}

      {viewModel.status === 'emptyItinerary' ||
      viewModel.status === 'completed' ||
      viewModel.status === 'recoverNeeded' ? (
        <Card>
          <Text style={styles.eyebrow}>
            {viewModel.dayLabel} · {viewModel.formattedDate}
          </Text>
          <Text style={styles.cardTitle}>{viewModel.title}</Text>
          <Text style={styles.cardHelper}>{viewModel.helper}</Text>
          <PrimaryButton label={viewModel.primaryAction.label} onPress={() => onAction(viewModel.primaryAction)} />
        </Card>
      ) : null}

      {viewModel.status === 'retryableError' ||
      viewModel.status === 'unavailable' ||
      viewModel.status === 'noOngoingTrip' ? (
        <TripStateCard
          helper={viewModel.helper}
          primaryAction={{ label: viewModel.primaryAction.label, onPress: () => onAction(viewModel.primaryAction) }}
          secondaryAction={
            'secondaryAction' in viewModel && viewModel.secondaryAction
              ? { label: viewModel.secondaryAction.label, onPress: () => onAction(viewModel.secondaryAction!) }
              : undefined
          }
          title={viewModel.title}
        />
      ) : null}

      {'skippedSection' in viewModel && viewModel.skippedSection ? (
        <SkippedPlacesSection
          onRestore={(action) => onAction(action)}
          pendingItemId={pendingItemId}
          section={viewModel.skippedSection}
        />
      ) : null}

      {viewModel.status === 'success' || viewModel.status === 'completed' ? (
        <TodaySpendCard
          addLabel={spendSummary.actionLabel}
          additionalAmountLabels={spendSummary.additionalTotals.map((total) => total.amountLabel)}
          currency={spendSummary.primaryTotal.currency}
          needsReviewCount={spendSummary.needsReviewCount}
          onPressAdd={() =>
            onAction({ kind: 'route', label: spendSummary.actionLabel, route: spendSummary.actionRoute })
          }
          totalAmount={spendSummary.primaryTotal.amountMinor}
          totalAmountLabel={spendSummary.primaryTotal.amountLabel}
        />
      ) : null}

      {actionMessage ? (
        <Card>
          <Text style={styles.message}>{actionMessage}</Text>
        </Card>
      ) : null}
    </>
  );
}

function QuickExpenseOverlaySheet({
  onClose,
  onRetry,
  onSubmit,
  state,
}: {
  state: QuickExpenseOverlayState;
  onClose: () => void;
  onRetry: (target: QuickExpenseRouteTarget) => void;
  onSubmit: (payload: {
    amount: number;
    itemId: string;
    payerParticipantId: string;
    splitParticipantIds: string[];
  }) => void;
}) {
  const isReady = state.status === 'ready' || state.status === 'saving';
  const viewModel = isReady
    ? buildQuickExpenseViewModel({
        amountInput: '',
        currency: state.currency,
        itinerary: state.itinerary,
        participants: state.participants,
        selectedItemId: state.selectedItemId,
        selectedSplitParticipantIds: state.selectedSplitParticipantIds,
        shouldChooseItem: state.selectedItemId === null,
      })
    : null;

  return (
    <BottomSheet onClose={onClose} visible={state.status !== 'idle'}>
      <ScrollView contentContainerStyle={styles.quickExpenseSheetBody} showsVerticalScrollIndicator={false}>
        <View style={styles.quickExpenseSheetHeader}>
          <Text style={styles.cardTitle}>지출 등록</Text>
          <Text style={styles.cardHelper}>오늘 화면을 떠나지 않고 금액과 결제자를 입력해요.</Text>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.quickExpenseStatusBox}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>지출 등록 정보를 불러오는 중...</Text>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.quickExpenseStatusBox}>
            <Text style={styles.errorTitle}>지출 등록을 열 수 없어요.</Text>
            <Text style={styles.message}>{state.message}</Text>
            <PrimaryButton label="다시 시도" onPress={() => onRetry(state.target)} />
            <SecondaryButton label="닫기" onPress={onClose} />
          </View>
        ) : null}

        {isReady && viewModel ? (
          <QuickExpenseForm
            currency={state.currency}
            errorMessage={state.errorMessage}
            initialDraft={{
              itemId: state.selectedItemId,
              payerParticipantId: state.payerParticipantId,
              splitParticipantIds: state.selectedSplitParticipantIds,
            }}
            itemOptions={viewModel.itemOptions.map((item) => ({
              id: item.itemId,
              label: `${item.orderLabel}. ${item.placeName}`,
              helper: `${item.placeTypeLabel} · ${item.address}`,
            }))}
            onCancel={onClose}
            onSave={onSubmit}
            participantOptions={viewModel.payerOptions.map((participant) => ({
              id: participant.participantId,
              name: participant.displayName,
            }))}
            submitting={state.status === 'saving'}
          />
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

function SkippedPlacesSection({
  onRestore,
  pendingItemId,
  section,
}: {
  section: TodaySkippedPlacesSectionViewModel;
  pendingItemId: string | null;
  onRestore: (action: TodayRestoreAction) => void;
}) {
  return (
    <Card style={styles.skippedCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.cardTitle}>{section.title}</Text>
        <Text style={styles.cardHelper}>{section.countLabel}</Text>
      </View>
      {section.items.map((item, index) => (
        <ListRow
          first={index === 0}
          key={item.itemId}
          subtitle={`${item.placeTypeLabel} · ${item.address}`}
          title={`${item.orderLabel}. ${item.placeName}`}
          trailing={
            <SecondaryButton
              label={pendingItemId === item.itemId ? '처리 중...' : item.restoreAction.label}
              onPress={() => onRestore(item.restoreAction)}
              style={styles.rowButton}
            />
          }
        />
      ))}
    </Card>
  );
}

function UnavailableState({ viewModel }: { viewModel: TripTabUnavailableViewModel }) {
  return (
    <TripStateCard
      helper={viewModel.helper}
      primaryAction={{
        label: viewModel.primaryAction.label,
        onPress: () => router.push(viewModel.primaryAction.route),
      }}
      secondaryAction={{
        label: viewModel.secondaryAction.label,
        onPress: () => router.push(viewModel.secondaryAction.route),
      }}
      title={viewModel.title}
    />
  );
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
  if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
    return { status: 'auth' };
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { status: 'auth' };
    }
    if (error.status === 400 || error.status === 403 || error.status === 404) {
      return { status: 'notFound' };
    }
  }
  return { status: 'error' };
}

const styles = StyleSheet.create({
  cardHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  cardTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  eyebrow: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    textAlign: 'center',
  },
  quickExpenseSheetBody: {
    paddingBottom: theme.space[3],
  },
  quickExpenseSheetHeader: {
    gap: theme.space[1],
    marginBottom: theme.space[4],
  },
  quickExpenseStatusBox: {
    alignItems: 'center',
    gap: theme.space[3],
    paddingVertical: theme.space[4],
  },
  rowButton: {
    minHeight: 36,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  sectionHeader: {
    gap: theme.space[1],
    paddingBottom: theme.space[2],
  },
  skippedCard: {
    gap: 0,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
});
