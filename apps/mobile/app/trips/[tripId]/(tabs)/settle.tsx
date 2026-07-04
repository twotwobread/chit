import { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';

import { PrimaryButton, SecondaryButton, theme } from '../../../../lib/design';
import { TransferRow } from '../../../../lib/trip-ui/TransferRow';
import { TripListCard, TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { getTripSettlement } from '../../../../lib/trips/settlement-api';
import { beginStaleWhileRevalidate, resolveStaleWhileRevalidateFailure } from '../../../../lib/trips/stale-refresh';
import { getTripDetail } from '../../../../lib/trips/trip-api';
import {
  buildSettlementExpenseEntryRoute,
  buildSettlementRequestMessage,
  buildSettlementTransferViewModel,
  settlementTransferFailureState,
  type SettlementBalanceDirection,
  type SettlementNoTransferNoticeViewModel,
  type SettlementTransferFailureViewModel,
  type SettlementTransferViewModel,
} from '../../../../lib/trips/settlement';
import { localDateString } from '../../../../lib/trips/status';
import { findTripCalendarDay } from '../../../../lib/trips/trip-tabs';

type TripSettleState =
  | { status: 'loading' }
  | { status: 'settlement'; expenseEntryRoute: Href | null; tripName: string; viewModel: SettlementTransferViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error'; error: Extract<SettlementTransferFailureViewModel, { status: 'error' }> };

export default function TripSettleTabScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [state, setState] = useState<TripSettleState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    setState((current) => beginStaleWhileRevalidate(current, { status: 'loading' }, ['settlement']));
    try {
      const [detail, settlement] = await Promise.all([getTripDetail(tripId), getTripSettlement(tripId)]);
      const currentDay = findTripCalendarDay(detail.days, localDateString());
      const expenseEntryRoute = currentDay ? buildSettlementExpenseEntryRoute(tripId, currentDay.id) : null;

      setState({
        status: 'settlement',
        expenseEntryRoute,
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
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <TripScreen>
      <TripScreenHeader helper="지출을 등록하고 송금 요청을 보낼 수 있어요." title="정산" />

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
          expenseEntryRoute={state.expenseEntryRoute}
          tripName={state.tripName}
          viewModel={state.viewModel}
        />
      ) : null}
    </TripScreen>
  );
}

function SettlementContent({
  expenseEntryRoute,
  tripName,
  viewModel,
}: {
  expenseEntryRoute: Href | null;
  tripName: string;
  viewModel: SettlementTransferViewModel;
}) {
  if (viewModel.status === 'empty') {
    return (
      <View style={styles.successStack}>
        <TripStateCard helper={viewModel.helper} title={viewModel.title} />
        {expenseEntryRoute ? (
          <PrimaryButton label="지출 등록하기" onPress={() => router.push(expenseEntryRoute)} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.successStack}>
      <TripListCard>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{viewModel.summaryTitle}</Text>
          <Text style={styles.summaryHelper}>{viewModel.summaryHelper}</Text>
        </View>
      </TripListCard>

      {expenseEntryRoute ? (
        <PrimaryButton label="지출 등록하기" onPress={() => router.push(expenseEntryRoute)} />
      ) : null}

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

      {viewModel.noTransferNotice ? <NoTransferNoticeCard notice={viewModel.noTransferNotice} /> : null}

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

function SettlementRequestButton({
  tripName,
  viewModel,
}: {
  tripName: string;
  viewModel: SettlementTransferViewModel;
}) {
  const message = buildSettlementRequestMessage(viewModel, tripName);
  if (!message) {
    return null;
  }

  return <SecondaryButton label="정산 요청하기" onPress={() => void Share.share({ message })} />;
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

function NoTransferNoticeCard({ notice }: { notice: SettlementNoTransferNoticeViewModel }) {
  const primaryAction = notice.primaryAction;
  return (
    <TripStateCard
      helper={notice.helper}
      primaryAction={
        primaryAction
          ? {
              label: primaryAction.label,
              onPress: () => router.push(primaryAction.route as Href),
            }
          : undefined
      }
      title={notice.title}
    />
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
  summary: {
    gap: theme.space[1],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  summaryHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  summaryTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  transferList: {
    gap: theme.space[3],
    paddingBottom: theme.space[4],
  },
});
