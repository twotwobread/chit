import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Card, ListRow, PrimaryButton, SecondaryButton, theme } from '../../../../lib/design';
import { BottomSheet } from '../../../../lib/trip-ui/BottomSheet';
import { NextPlaceHeroCard } from '../../../../lib/trip-ui/NextPlaceHeroCard';
import { QuickExpenseForm, type QuickExpenseSubmitPayload } from '../../../../lib/trip-ui/QuickExpenseForm';
import { TodaySpendCard } from '../../../../lib/trip-ui/TodaySpendCard';
import { TripScreen, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { type QuickExpenseOverlayState, useTripTodayController } from '../../../../lib/trip-ui/useTripTodayController';
import { buildQuickExpenseViewModel, type QuickExpenseRouteTarget } from '../../../../lib/trips/quick-expense';
import {
  type TodayAction,
  type TodayExecutionViewModel,
  type TodayRestoreAction,
  type TodaySkippedPlacesSectionViewModel,
} from '../../../../lib/trips/today-execution';
import { type TodaySpendSummaryViewModel } from '../../../../lib/trips/today-spend';
import { type TripTabUnavailableViewModel } from '../../../../lib/trips/trip-tabs';
import { travelModeDisplayLabel, travelModeDisplayOptions } from '../../../../lib/trips/travel-mode';

export default function TripTodayTabScreen() {
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
    routeChip,
    runAction,
    state,
    submitQuickExpenseOverlay,
  } = useTripTodayController();

  return (
    <TripScreen>
      {state.status === 'loading' ? <TripStateCard loading title="오늘 일정을 불러오는 중..." /> : null}
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
