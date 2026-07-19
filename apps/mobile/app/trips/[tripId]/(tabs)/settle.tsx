import { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import KakaoShareLink from 'react-native-kakao-share-link';

import type { TripDay } from '@i-um/api-contract';

import { SecondaryButton, theme } from '../../../../lib/design';
import { DayChips } from '../../../../lib/trip-ui/DayChips';
import { ExpenseRow } from '../../../../lib/trip-ui/ExpenseRow';
import { TransferRow } from '../../../../lib/trip-ui/TransferRow';
import { TripRootFab } from '../../../../lib/trip-ui/TripRootFab';
import { TripListCard, TripScreen, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { listTripExpenses } from '../../../../lib/trips/expense-api';
import { getTripSettlement } from '../../../../lib/trips/settlement-api';
import { beginStaleWhileRevalidate, resolveStaleWhileRevalidateFailure } from '../../../../lib/trips/stale-refresh';
import {
  buildSettlementExpenseEntryRouteForDays,
  buildSettlementExpenseHistoryDayInputs,
  buildKakaoSettlementRequestTemplate,
  buildSettlementExpenseHistoryViewModel,
  buildSettlementRequestMessage,
  buildSettlementTotalSpendViewModel,
  buildSettlementTransferViewModel,
  settlementExpenseHistoryFailureState,
  settlementTransferFailureState,
  type SettlementBalanceDirection,
  type SettlementExpenseHistoryDayInput,
  type SettlementExpenseHistoryFailureViewModel,
  type SettlementTotalSpendCategoryViewModel,
  type SettlementTotalSpendCurrencySectionViewModel,
  type SettlementTransferFailureViewModel,
  type SettlementTransferViewModel,
} from '../../../../lib/trips/settlement';
import { localDateString } from '../../../../lib/trips/status';
import { resolveTripShellDetail } from '../../../../lib/trips/trip-shell-detail';
import { useTripShellState } from '../../../../lib/trips/trip-shell-context';
import { buildTripRootFabLayout, shouldShowTripRootFab } from '../../../../lib/trips/trip-root-fab-layout';

type SettlementExpenseHistoryState =
  | { status: 'ready'; days: SettlementExpenseHistoryDayInput[] }
  | { status: 'error'; error: SettlementExpenseHistoryFailureViewModel };

type TripSettleState =
  | { status: 'loading' }
  | {
      status: 'settlement';
      expenseEntryDays: TripDay[];
      expenseHistory: SettlementExpenseHistoryState;
      tripName: string;
      viewModel: SettlementTransferViewModel;
    }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error'; error: Extract<SettlementTransferFailureViewModel, { status: 'error' }> };

export default function TripSettleTabScreen() {
  const {
    tripId: tripIdParam,
    expenseDayId: expenseDayIdParam,
    expenseId: expenseIdParam,
  } = useLocalSearchParams<{
    tripId?: string | string[];
    expenseDayId?: string | string[];
    expenseId?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const routeExpenseDayId = Array.isArray(expenseDayIdParam) ? expenseDayIdParam[0] : expenseDayIdParam;
  const routeExpenseId = Array.isArray(expenseIdParam) ? expenseIdParam[0] : expenseIdParam;
  const shellState = useTripShellState();
  const [selectedExpenseDayId, setSelectedExpenseDayId] = useState<string | null>(null);
  const [state, setState] = useState<TripSettleState>({ status: 'loading' });
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const normalizedExpenseDayId = routeExpenseDayId?.trim() ?? '';
    if (normalizedExpenseDayId) {
      setSelectedExpenseDayId(normalizedExpenseDayId);
    }
  }, [routeExpenseDayId]);

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    setState((current) => beginStaleWhileRevalidate(current, { status: 'loading' }, ['settlement']));

    const shellDetail = resolveTripShellDetail(shellState, tripId);
    if (shellDetail.status === 'pending') {
      return;
    }
    if (shellDetail.status !== 'success') {
      setState(settleShellFailureState(shellDetail.status));
      return;
    }

    try {
      const detail = shellDetail.detail;
      const settlement = await getTripSettlement(tripId);
      let expenseHistory: SettlementExpenseHistoryState;

      try {
        const expensesResponse = await listTripExpenses(tripId);
        expenseHistory = {
          status: 'ready',
          days: buildSettlementExpenseHistoryDayInputs(detail.days, expensesResponse),
        };
      } catch {
        expenseHistory = { status: 'error', error: settlementExpenseHistoryFailureState() };
      }

      setState({
        status: 'settlement',
        expenseEntryDays: detail.days,
        expenseHistory,
        tripName: detail.trip.name.trim() || '여행',
        viewModel: buildSettlementTransferViewModel({ settlement }),
      });
    } catch (error) {
      const failureState = settleFailureState(error);
      setState((current) =>
        resolveStaleWhileRevalidateFailure(current, failureState, {
          shouldKeepStale: (state) => state.status === 'error',
          staleStatuses: ['settlement'],
        }),
      );
    }
  }, [shellState, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const expenseEntryRoute =
    state.status === 'settlement' && tripId
      ? buildSettlementExpenseEntryRouteForDays(tripId, state.expenseEntryDays, localDateString(), selectedExpenseDayId)
      : null;
  const expenseFabLayout = buildTripRootFabLayout({ bottomInset: insets.bottom, rightInset: insets.right });
  const showExpenseFab = shouldShowTripRootFab({
    hasAction: Boolean(expenseEntryRoute),
    isBlocked: false,
    status: state.status === 'settlement' ? 'ready' : state.status,
  });

  return (
    <View style={styles.root}>
      <TripScreen contentContainerStyle={showExpenseFab ? expenseFabLayout.scrollContent : undefined}>
        {state.status === 'loading' ? <TripStateCard loading title="정산을 불러오는 중..." /> : null}
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
            helper={state.error.helper}
            primaryAction={{ label: state.error.actionLabel, onPress: () => void load() }}
            title={state.error.title}
          />
        ) : null}
        {state.status === 'settlement' ? (
          <SettlementContent
            expenseHistory={state.expenseHistory}
            onRetryExpenseHistory={() => void load()}
            onSelectExpenseDay={setSelectedExpenseDayId}
            selectedExpenseDayId={selectedExpenseDayId}
            targetExpenseId={selectedExpenseDayId ? null : routeExpenseId}
            today={localDateString()}
            tripId={tripId ?? ''}
            tripName={state.tripName}
            viewModel={state.viewModel}
          />
        ) : null}
      </TripScreen>
      {showExpenseFab && expenseEntryRoute ? (
        <TripRootFab
          accessibilityHint="선택한 여행의 지출 등록을 시작합니다."
          accessibilityLabel="지출 등록"
          layout={expenseFabLayout.fab}
          onPress={() => router.push(expenseEntryRoute)}
        />
      ) : null}
    </View>
  );
}

function SettlementContent({
  expenseHistory,
  onRetryExpenseHistory,
  onSelectExpenseDay,
  selectedExpenseDayId,
  targetExpenseId,
  today,
  tripId,
  tripName,
  viewModel,
}: {
  expenseHistory: SettlementExpenseHistoryState;
  onRetryExpenseHistory: () => void;
  onSelectExpenseDay: (dayId: string) => void;
  selectedExpenseDayId: string | null;
  targetExpenseId?: string | null;
  today: string;
  tripId: string;
  tripName: string;
  viewModel: SettlementTransferViewModel;
}) {
  return (
    <View style={styles.successStack}>
      <SettlementTotalSpendCard expenseHistory={expenseHistory} />

      {viewModel.balanceSections.map((section) => (
        <TripListCard key={`balance-${section.currency}`}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionHelper}>{section.helper}</Text>
          </View>
          <View style={styles.balanceList}>
            {section.rows.map((row, index) => (
              <View key={`${section.currency}-${index}-${row.displayName}-${row.netMinor}`} style={styles.balanceRow}>
                <View style={styles.balanceRowHeader}>
                  <Text style={styles.balanceName}>{row.displayName}</Text>
                  {row.statusLabel ? (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{row.statusLabel}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.balanceMetricList}>
                  <BalanceMetric label="결제" value={row.paidAmountLabel} />
                  <BalanceMetric label="부담" value={row.shareAmountLabel} />
                  <BalanceMetric direction={row.netDirection} label={row.netLabel} value={row.netAmountLabel} />
                </View>
              </View>
            ))}
          </View>
        </TripListCard>
      ))}

      <ExpenseHistoryContent
        expenseHistory={expenseHistory}
        onRetry={onRetryExpenseHistory}
        onSelectDay={onSelectExpenseDay}
        selectedDayId={selectedExpenseDayId}
        targetExpenseId={targetExpenseId}
        today={today}
        tripId={tripId}
      />

      {viewModel.sections.map((section) => (
        <TripListCard key={`transfer-${section.currency}`}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionHelper}>{section.helper}</Text>
          </View>
          <View style={styles.transferList}>
            {section.transfers.map((transfer, index) => (
              <TransferRow
                amount={transfer.amountMinor}
                currency={section.currency}
                fromName={transfer.fromName}
                key={`${section.currency}-${index}-${transfer.fromName}-${transfer.toName}-${transfer.amountMinor}`}
                toName={transfer.toName}
              />
            ))}
          </View>
        </TripListCard>
      ))}

      <SettlementRequestButton tripName={tripName} viewModel={viewModel} />
    </View>
  );
}

function SettlementTotalSpendCard({ expenseHistory }: { expenseHistory: SettlementExpenseHistoryState }) {
  if (expenseHistory.status === 'error') {
    return null;
  }

  const viewModel = buildSettlementTotalSpendViewModel({ days: expenseHistory.days });

  return (
    <TripListCard>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{viewModel.title}</Text>
        {viewModel.status === 'success' ? <Text style={styles.sectionHelper}>{viewModel.helper}</Text> : null}
      </View>
      {viewModel.status === 'empty' ? (
        <View style={styles.totalSpendEmpty}>
          <Text style={styles.totalSpendEmptyTitle}>{viewModel.emptyTitle}</Text>
          <Text style={styles.sectionHelper}>{viewModel.helper}</Text>
        </View>
      ) : (
        <View style={styles.totalSpendSectionList}>
          {viewModel.sections.map((section) => (
            <SettlementTotalSpendCurrencySection key={section.currency} section={section} />
          ))}
        </View>
      )}
    </TripListCard>
  );
}

function SettlementTotalSpendCurrencySection({ section }: { section: SettlementTotalSpendCurrencySectionViewModel }) {
  return (
    <View style={styles.totalSpendCurrencySection}>
      <View style={styles.totalSpendCurrencyHeader}>
        <View style={styles.totalSpendCurrencyTitleGroup}>
          <Text style={styles.totalSpendCurrencyTitle}>{section.title}</Text>
          <Text style={styles.sectionHelper}>{section.helper}</Text>
        </View>
        <Text style={styles.totalSpendAmount}>{section.totalAmountLabel}</Text>
      </View>
      {section.totalMinor > 0 ? (
        <SettlementTotalSpendBar categories={section.categories} />
      ) : (
        <View style={styles.totalSpendZeroBar} />
      )}
      <View style={styles.totalSpendLegendList}>
        {section.categories.map((category) => (
          <SettlementTotalSpendLegendRow category={category} key={category.key} />
        ))}
      </View>
    </View>
  );
}

function SettlementTotalSpendBar({ categories }: { categories: SettlementTotalSpendCategoryViewModel[] }) {
  return (
    <View
      accessibilityLabel={`카테고리 비율 ${categories
        .map((category) => `${category.label} ${category.percentageLabel}`)
        .join(', ')}`}
      style={styles.totalSpendBar}
    >
      {categories.map((category) => (
        <View
          key={category.key}
          style={[
            styles.totalSpendBarSegment,
            { backgroundColor: category.color, flexGrow: category.ratio, minWidth: category.ratio > 0 ? 2 : 0 },
          ]}
        />
      ))}
    </View>
  );
}

function SettlementTotalSpendLegendRow({ category }: { category: SettlementTotalSpendCategoryViewModel }) {
  return (
    <View style={styles.totalSpendLegendRow}>
      <View style={[styles.totalSpendLegendMarker, { backgroundColor: category.color }]} />
      <Text style={styles.totalSpendLegendLabel}>{category.label}</Text>
      <Text style={styles.totalSpendLegendAmount}>{category.amountLabel}</Text>
      <Text style={styles.totalSpendLegendPercent}>{category.percentageLabel}</Text>
    </View>
  );
}

function ExpenseHistoryContent({
  expenseHistory,
  onRetry,
  onSelectDay,
  selectedDayId,
  targetExpenseId,
  today,
  tripId,
}: {
  expenseHistory: SettlementExpenseHistoryState;
  onRetry: () => void;
  onSelectDay: (dayId: string) => void;
  selectedDayId: string | null;
  targetExpenseId?: string | null;
  today: string;
  tripId: string;
}) {
  if (expenseHistory.status === 'error') {
    return (
      <TripStateCard
        helper={expenseHistory.error.helper}
        primaryAction={{ label: expenseHistory.error.actionLabel, onPress: onRetry }}
        title={expenseHistory.error.title}
      />
    );
  }

  const viewModel = buildSettlementExpenseHistoryViewModel({
    days: expenseHistory.days,
    selectedDayId,
    targetExpenseId,
    today,
    tripId,
  });
  if (viewModel.status === 'empty') {
    return <TripStateCard helper={viewModel.helper} title={viewModel.emptyTitle} />;
  }

  const section = viewModel.selectedSection;

  return (
    <TripListCard>
      <View style={styles.expenseHistoryHeader}>
        <Text style={styles.sectionTitle}>{viewModel.title}</Text>
        <Text style={styles.sectionHelper}>{viewModel.helper}</Text>
      </View>
      {viewModel.targetExpenseUnavailableMessage ? (
        <View style={styles.expenseHistoryNotice}>
          <Text style={styles.expenseHistoryNoticeText}>{viewModel.targetExpenseUnavailableMessage}</Text>
        </View>
      ) : null}
      <View style={styles.expenseDayChips}>
        <DayChips days={viewModel.dayChips} selectedDayId={viewModel.selectedDayId} onSelectDay={onSelectDay} />
      </View>
      <View style={styles.expenseDaySection}>
        <View style={styles.expenseDayHeader}>
          <Text style={styles.expenseDayTitle}>{section.title}</Text>
          <Text style={styles.sectionHelper}>{section.helper}</Text>
        </View>
        {section.rows.length === 0 ? (
          <View style={styles.expenseDayEmpty}>
            <Text style={styles.expenseDayEmptyTitle}>{section.emptyTitle}</Text>
            {section.emptyHelper ? <Text style={styles.sectionHelper}>{section.emptyHelper}</Text> : null}
          </View>
        ) : (
          <View style={styles.expenseRowList}>
            {section.rows.map((row, index) => {
              const editRoute = row.editRoute;
              return (
                <ExpenseRow
                  accessibilityLabel={row.accessibilityLabel}
                  amount={row.amountMinor}
                  category={row.category}
                  currency={row.currency}
                  first={index === 0}
                  key={row.id}
                  onPress={editRoute ? () => router.push(editRoute) : undefined}
                  payerLabel={row.payerLabel}
                  settlementLabel={row.settlementLabel}
                  splitLabel={row.splitLabel}
                  title={row.placeName}
                />
              );
            })}
          </View>
        )}
      </View>
    </TripListCard>
  );
}

function SettlementRequestButton({
  tripName,
  viewModel,
}: {
  tripName: string;
  viewModel: SettlementTransferViewModel;
}) {
  const message = buildSettlementRequestMessage(viewModel, tripName);
  const disabled = viewModel.requestAction.disabled || !message;

  return (
    <SecondaryButton
      accessibilityLabel={
        disabled ? '보낼 정산 내역이 없어 정산 요청을 보낼 수 없어요.' : viewModel.requestAction.label
      }
      disabled={disabled}
      label={viewModel.requestAction.label}
      onPress={() => {
        if (!message) {
          return;
        }
        void shareSettlementRequest(message);
      }}
    />
  );
}

async function shareSettlementRequest(message: string) {
  try {
    await KakaoShareLink.sendText(buildKakaoSettlementRequestTemplate(message));
  } catch {
    await Share.share({ message });
  }
}

function BalanceMetric({
  direction,
  label,
  value,
}: {
  direction?: SettlementBalanceDirection;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.balanceMetric}>
      <Text style={styles.balanceMetricLabel}>{label}</Text>
      <Text style={[styles.balanceMetricValue, direction ? netAmountStyle(direction) : null]}>{value}</Text>
    </View>
  );
}

function netAmountStyle(direction: SettlementBalanceDirection) {
  if (direction === 'receive') {
    return styles.balanceMetricValueReceive;
  }
  if (direction === 'send') {
    return styles.balanceMetricValueSend;
  }
  return styles.balanceMetricValueSettled;
}

function settleShellFailureState(status: 'auth' | 'notFound' | 'error'): TripSettleState {
  if (status === 'error') {
    return {
      status: 'error',
      error: {
        status: 'error',
        title: '정산을 불러오지 못했어요.',
        helper: '잠시 후 다시 시도해주세요.',
        actionLabel: '다시 시도',
      },
    };
  }
  return { status };
}

function settleFailureState(error: unknown): TripSettleState {
  const failure = settlementTransferFailureState(error);
  if (failure.status === 'auth') {
    return { status: 'auth' };
  }
  if (failure.status === 'notFound') {
    return { status: 'notFound' };
  }
  return { status: 'error', error: failure };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  balanceList: {
    gap: theme.space[3],
    paddingBottom: theme.space[4],
  },
  balanceMetric: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.md,
    flex: 1,
    gap: theme.space[1],
    minWidth: 88,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  balanceMetricLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.micro,
  },
  balanceMetricList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  balanceMetricValue: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  balanceMetricValueReceive: {
    color: theme.color.credit,
  },
  balanceMetricValueSend: {
    color: theme.color.debit,
  },
  balanceMetricValueSettled: {
    color: theme.color.textMuted,
  },
  balanceName: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  balanceRow: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: theme.space[3],
    paddingHorizontal: theme.space[1],
    paddingTop: theme.space[4],
  },
  balanceRowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  currencyRuleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  currencyRuleBadgeText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  currencyRuleHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  currencyRuleNotice: {
    gap: theme.space[3],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  currencyRuleTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  expenseDayChips: {
    marginHorizontal: -theme.space[5],
  },
  expenseDayEmpty: {
    gap: theme.space[1],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  expenseDayEmptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  expenseDayHeader: {
    gap: theme.space[1],
    paddingHorizontal: theme.space[1],
    paddingTop: theme.space[4],
  },
  expenseDaySection: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: theme.space[2],
    paddingBottom: theme.space[2],
  },
  expenseDayTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  expenseHistoryHeader: {
    gap: theme.space[1],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  expenseHistoryNotice: {
    backgroundColor: theme.color.accentSoft,
    borderRadius: theme.radius.md,
    marginBottom: theme.space[3],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  expenseHistoryNoticeText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    lineHeight: 20,
  },
  expenseRowList: {
    gap: 0,
  },
  sectionHeader: {
    gap: theme.space[1],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  sectionHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  totalSpendAmount: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  totalSpendBar: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    height: 12,
    overflow: 'hidden',
  },
  totalSpendBarSegment: {
    flexBasis: 0,
  },
  totalSpendCurrencyHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[4],
    justifyContent: 'space-between',
  },
  totalSpendCurrencySection: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: theme.space[4],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  totalSpendCurrencyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  totalSpendCurrencyTitleGroup: {
    flex: 1,
    gap: theme.space[1],
  },
  totalSpendEmpty: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: theme.space[1],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  totalSpendEmptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  totalSpendLegendAmount: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
    marginLeft: 'auto',
  },
  totalSpendLegendLabel: {
    color: theme.color.textBody,
    flexShrink: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  totalSpendLegendList: {
    gap: theme.space[3],
  },
  totalSpendLegendMarker: {
    borderRadius: theme.radius.pill,
    height: 10,
    width: 10,
  },
  totalSpendLegendPercent: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    minWidth: 38,
    textAlign: 'right',
  },
  totalSpendLegendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  totalSpendSectionList: {
    gap: 0,
  },
  totalSpendZeroBar: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    height: 12,
  },
  statusBadge: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  statusBadgeText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  successStack: {
    gap: theme.space[4],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  transferList: {
    gap: theme.space[3],
    paddingBottom: theme.space[4],
  },
});
