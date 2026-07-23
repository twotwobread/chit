import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Card, ListRow, PrimaryButton, SecondaryButton, theme } from '../../../../lib/design';
import { BottomSheet } from '../../../../lib/trip-ui/BottomSheet';
import { NextPlaceHeroCard } from '../../../../lib/trip-ui/NextPlaceHeroCard';
import { QuickExpenseForm, type QuickExpenseSubmitPayload } from '../../../../lib/trip-ui/QuickExpenseForm';
import { TodaySpendCard } from '../../../../lib/trip-ui/TodaySpendCard';
import { TripScreen, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { openTodayFlightBoardingPass, type TodayFlightCardViewModel } from '../../../../lib/flights/today';
import { openMyFlightBoardingPass } from '../../../../lib/flights/flight-api';
import { type QuickExpenseOverlayState, useTripTodayController } from '../../../../lib/trip-ui/useTripTodayController';
import { buildQuickExpenseViewModel, type QuickExpenseRouteTarget } from '../../../../lib/trips/quick-expense';
import {
  type TodayAction,
  type TodayExecutionViewModel,
  type TodayRestoreAction,
  type TodaySkippedPlacesSectionViewModel,
} from '../../../../lib/trips/today-execution';
import {
  buildTodayRoutePreviewSummaryHeroChip,
  type TodayRoutePreviewSummaryState,
} from '../../../../lib/trips/today-route-preview';
import { type TodaySpendSummaryViewModel } from '../../../../lib/trips/today-spend';
import {
  type TripTabUnavailableViewModel,
  type TripTodayStatusLandingViewModel,
} from '../../../../lib/trips/trip-tabs';
import { tripFlightDetailPath } from '../../../../lib/trips/routes';
import { travelModeDisplayLabel, tripDefaultTravelModeDisplayOptions } from '../../../../lib/trips/travel-mode';

export default function TripTodayTabScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const {
    actionMessage,
    closeQuickExpenseOverlay,
    goHome,
    goToLogin,
    handleTravelMode,
    load,
    openQuickExpenseOverlay,
    pendingItemId,
    quickExpenseState,
    routePreviewState,
    runAction,
    state,
    submitQuickExpenseOverlay,
  } = useTripTodayController();

  const flightCard = 'flightCard' in state ? state.flightCard : null;

  return (
    <TripScreen>
      {state.status === 'loading' ? <TripStateCard loading title="오늘 일정을 불러오는 중..." /> : null}
      {flightCard && tripId ? <TodayFlightCard card={flightCard} tripId={tripId} /> : null}
      {state.status === 'auth' ? (
        <TripStateCard primaryAction={{ label: '로그인하기', onPress: goToLogin }} title="다시 로그인해주세요." />
      ) : null}
      {state.status === 'notFound' ? (
        <TripStateCard
          helper="삭제되었거나 접근할 수 없는 여행이에요."
          primaryAction={{ label: '홈으로', onPress: goHome }}
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
      {state.status === 'statusLanding' ? <TodayStatusLandingCard viewModel={state.viewModel} /> : null}
      {state.status === 'ready' ? (
        <TodayReadyContent
          actionMessage={actionMessage}
          onAction={(action) => void runAction(action)}
          onTravelMode={handleTravelMode}
          pendingItemId={pendingItemId}
          routePreviewState={routePreviewState}
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

function TodayFlightCard({ card, tripId }: { card: TodayFlightCardViewModel; tripId: string }) {
  const [opening, setOpening] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handlePrimaryAction = async () => {
    if (card.primaryActionKind === 'routeToDetail') {
      router.push(tripFlightDetailPath(tripId, card.flightId));
      return;
    }
    if (opening) {
      return;
    }
    setOpening(true);
    setFeedback(null);
    try {
      await openTodayFlightBoardingPass({
        tripId,
        flightId: card.flightId,
        openBoardingPass: openMyFlightBoardingPass,
        openUrl: (url) => Linking.openURL(url),
      });
    } catch {
      setFeedback('탑승권을 열 수 없어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <Card>
      <Text style={styles.eyebrow}>오늘 항공편</Text>
      <Text style={styles.cardTitle}>{card.title}</Text>
      <View style={styles.flightRoutePanel}>
        <FlightEndpoint endpoint={card.departure} />
        <View style={styles.flightConnector}>
          <Text style={styles.flightConnectorText}>→</Text>
        </View>
        <FlightEndpoint endpoint={card.arrival} />
      </View>
      <Text style={styles.cardHelper}>각 공항 현지 시간 기준이에요.</Text>
      <PrimaryButton
        label={card.actionLabel}
        loading={opening}
        loadingLabel="여는 중..."
        onPress={() => void handlePrimaryAction()}
      />
      {feedback ? <Text style={styles.flightFeedback}>{feedback}</Text> : null}
    </Card>
  );
}

function FlightEndpoint({ endpoint }: { endpoint: TodayFlightCardViewModel['departure'] }) {
  return (
    <View style={styles.flightEndpoint}>
      <Text style={styles.flightEndpointRole}>{endpoint.roleLabel}</Text>
      <Text style={styles.flightAirport}>{endpoint.airportLabel}</Text>
      <Text style={styles.flightTime}>{endpoint.timeLabel}</Text>
      <Text style={styles.flightDate}>{endpoint.dateLabel}</Text>
    </View>
  );
}

function TodayReadyContent({
  actionMessage,
  onAction,
  onTravelMode,
  pendingItemId,
  routePreviewState,
  spendSummary,
  viewModel,
}: {
  viewModel: TodayExecutionViewModel;
  spendSummary: TodaySpendSummaryViewModel;
  actionMessage: string | null;
  pendingItemId: string | null;
  routePreviewState: TodayRoutePreviewSummaryState;
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
          routeChip={buildTodayRoutePreviewSummaryHeroChip(
            routePreviewState,
            viewModel.nextPlace.navigationAction.travelMode,
          )}
          skipLabel={pendingItemId === viewModel.skipAction.itemId ? '처리 중...' : viewModel.skipAction.label}
          travelMode={
            viewModel.nextPlace.navigationAction.label
              ? travelModeDisplayLabel(viewModel.nextPlace.navigationAction.travelMode)
              : ''
          }
          travelOptions={tripDefaultTravelModeDisplayOptions}
        />
      ) : null}

      {viewModel.status === 'emptyItinerary' || viewModel.status === 'recoverNeeded' ? (
        <Card>
          <Text style={styles.eyebrow}>
            {viewModel.dayLabel} · {viewModel.formattedDate}
          </Text>
          <Text style={styles.cardTitle}>{viewModel.title}</Text>
          <Text style={styles.cardHelper}>{viewModel.helper}</Text>
          <PrimaryButton label={viewModel.primaryAction.label} onPress={() => onAction(viewModel.primaryAction)} />
        </Card>
      ) : null}

      {viewModel.status === 'completed' ? (
        <Card>
          <Text style={styles.eyebrow}>
            {viewModel.dayLabel} · {viewModel.formattedDate}
          </Text>
          <Text style={styles.cardTitle}>{viewModel.title}</Text>
          <Text style={styles.cardHelper}>{viewModel.helper}</Text>
          <PrimaryButton label={viewModel.primaryAction.label} onPress={() => onAction(viewModel.primaryAction)} />
          <SecondaryButton
            disabled={viewModel.lodgingNavigationAction.disabled}
            label={viewModel.lodgingNavigationAction.label}
            onPress={() => {
              if (viewModel.lodgingNavigationAction.action) {
                onAction(viewModel.lodgingNavigationAction.action);
              }
            }}
          />
          {viewModel.lodgingNavigationAction.helper ? (
            <Text style={styles.cardHelper}>{viewModel.lodgingNavigationAction.helper}</Text>
          ) : null}
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
          excludedPublicFundLabel={spendSummary.excludedPublicFundSummary?.label ?? null}
          myPublicFundSpendLabel={spendSummary.mySpend.publicFund.amountLabel}
          myRegularSpendLabel={spendSummary.mySpend.regular.amountLabel}
          mySpendLabel={spendSummary.mySpend.total.amountLabel}
          needsReviewCount={spendSummary.needsReviewCount}
          publicFundTotalLabel={spendSummary.composition.publicFund.amountLabel}
          regularTotalLabel={spendSummary.composition.regular.amountLabel}
          settlementHelper={spendSummary.settlementSnapshot.helper}
          settlementTitle={spendSummary.settlementSnapshot.title}
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
  onSubmit: (payload: QuickExpenseSubmitPayload) => void;
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
    <BottomSheet scrollable onClose={onClose} visible={state.status !== 'idle'}>
      <View style={styles.quickExpenseSheetBody}>
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
              expenseKind: state.expenseKind,
              includeInSettlement: state.includeInSettlement,
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
            tripId={state.target.tripId}
          />
        ) : null}
      </View>
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

function TodayStatusLandingCard({ viewModel }: { viewModel: TripTodayStatusLandingViewModel }) {
  const isUpcoming = viewModel.tone === 'amber';

  return (
    <Card style={[styles.statusLandingCard, isUpcoming ? styles.upcomingCard : styles.pastCard]}>
      <Text style={[styles.statusLandingEyebrow, isUpcoming ? styles.upcomingText : styles.pastText]}>
        {viewModel.eyebrow}
      </Text>
      <Text style={[styles.statusLandingHero, isUpcoming ? styles.upcomingHero : styles.pastHero]}>
        {viewModel.heroLabel}
      </Text>
      <View style={styles.statusLandingCopy}>
        <Text style={styles.statusLandingTitle}>{viewModel.title}</Text>
        <Text style={styles.statusLandingHelper}>{viewModel.helper}</Text>
      </View>
      <PrimaryButton
        label={viewModel.primaryAction.label}
        onPress={() => router.push(viewModel.primaryAction.route)}
        style={isUpcoming ? styles.upcomingPrimaryButton : styles.pastPrimaryButton}
      />
      {viewModel.secondaryAction ? (
        <SecondaryButton
          label={viewModel.secondaryAction.label}
          onPress={() => router.push(viewModel.secondaryAction!.route)}
          style={styles.statusLandingSecondaryButton}
        />
      ) : null}
    </Card>
  );
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
  flightAirport: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  flightConnector: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.space[6],
  },
  flightConnectorText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  flightDate: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  flightEndpoint: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    gap: theme.space[2],
    minWidth: 0,
    padding: theme.space[4],
  },
  flightEndpointRole: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.5,
  },
  flightFeedback: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
    textAlign: 'center',
  },
  flightRoutePanel: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  flightTime: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.3,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    textAlign: 'center',
  },
  pastCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
  },
  pastHero: {
    color: theme.color.textMuted,
  },
  pastPrimaryButton: {
    backgroundColor: theme.color.ink[700],
  },
  pastText: {
    color: theme.color.textMuted,
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
    minHeight: theme.layout.tapMin,
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
  statusLandingCard: {
    gap: theme.space[4],
  },
  statusLandingCopy: {
    gap: theme.space[2],
  },
  statusLandingEyebrow: {
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1,
  },
  statusLandingHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  statusLandingHero: {
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.display,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.8,
  },
  statusLandingSecondaryButton: {
    borderColor: theme.color.borderStrong,
  },
  statusLandingTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    lineHeight: theme.font.size.headline * theme.font.leading.snug,
  },
  upcomingCard: {
    backgroundColor: theme.color.accentSoft,
    borderColor: theme.color.amber[100],
  },
  upcomingHero: {
    color: theme.color.amber[700],
  },
  upcomingPrimaryButton: {
    backgroundColor: theme.color.amber[600],
  },
  upcomingText: {
    color: theme.color.amber[700],
  },
});
