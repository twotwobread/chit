import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { theme } from '../../../lib/design';
import { TransferRow } from '../../../lib/trip-ui/TransferRow';
import { TripListCard, TripScreen, TripScreenHeader, TripStateCard } from '../../../lib/trip-ui/TripScreenScaffold';
import { listTripExpenses } from '../../../lib/trips/expense-api';
import { getTripSettlement } from '../../../lib/trips/settlement-api';
import {
  buildSettlementDetailViewModel,
  buildSettlementExpenseHistoryDayInputs,
  settlementTransferFailureState,
  type SettlementBalanceDirection,
  type SettlementDetailCurrencySectionViewModel,
  type SettlementDetailExpenseRowViewModel,
  type SettlementDetailViewModel,
  type SettlementTransferFailureViewModel,
} from '../../../lib/trips/settlement';
import { resolveTripShellDetail } from '../../../lib/trips/trip-shell-detail';
import { useTripShellState } from '../../../lib/trips/trip-shell-context';

type SettlementDetailState =
  | { status: 'loading' }
  | { status: 'ready'; viewModel: SettlementDetailViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error'; error: Extract<SettlementTransferFailureViewModel, { status: 'error' }> };

export default function SettlementDetailScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const shellState = useTripShellState();
  const [state, setState] = useState<SettlementDetailState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    const shellDetail = resolveTripShellDetail(shellState, tripId);
    if (shellDetail.status === 'pending') {
      return;
    }
    if (shellDetail.status !== 'success') {
      setState(settlementDetailShellFailureState(shellDetail.status));
      return;
    }

    setState({ status: 'loading' });
    try {
      const [settlement, expenses] = await Promise.all([getTripSettlement(tripId), listTripExpenses(tripId)]);
      const expenseDays = buildSettlementExpenseHistoryDayInputs(shellDetail.detail.days, expenses);
      setState({
        status: 'ready',
        viewModel: buildSettlementDetailViewModel({ tripId, settlement, expenseDays }),
      });
    } catch (error) {
      setState(settlementDetailFailureState(error));
    }
  }, [shellState, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <TripScreen>
      {state.status === 'loading' ? <TripStateCard loading title="정산 상세를 불러오는 중..." /> : null}
      {state.status === 'auth' ? (
        <TripStateCard
          helper="정산 상세는 여행 참여자만 볼 수 있어요. 로그인 후 다시 열어주세요."
          primaryAction={{ label: '로그인하기', onPress: () => router.replace('/login') }}
          title="로그인이 필요해요."
        />
      ) : null}
      {state.status === 'notFound' ? (
        <TripStateCard
          helper="로그인한 계정이 이 여행의 현재 참여자인지 확인해주세요."
          primaryAction={{ label: '홈으로', onPress: () => router.replace('/') }}
          title="정산 상세를 볼 수 없어요."
        />
      ) : null}
      {state.status === 'error' ? (
        <TripStateCard
          helper={state.error.helper}
          primaryAction={{ label: state.error.actionLabel, onPress: () => void load() }}
          title={state.error.title}
        />
      ) : null}
      {state.status === 'ready' ? <SettlementDetailContent viewModel={state.viewModel} /> : null}
    </TripScreen>
  );
}

function SettlementDetailContent({ viewModel }: { viewModel: SettlementDetailViewModel }) {
  return (
    <>
      <TripScreenHeader helper={viewModel.latestNotice} title={viewModel.title} />
      <TripListCard>
        <View style={styles.noticeContent}>
          <Text style={styles.noticeTitle}>{viewModel.latestNotice}</Text>
          <Text style={styles.noticeHelper}>지출이 바뀌면 이 상세 내역도 최신 기준으로 다시 계산됩니다.</Text>
          <Text style={styles.formulaText}>{viewModel.formulaCopy}</Text>
        </View>
      </TripListCard>
      {viewModel.currencySections.map((section) => (
        <SettlementDetailCurrencySection key={section.currency} section={section} />
      ))}
    </>
  );
}

function SettlementDetailCurrencySection({ section }: { section: SettlementDetailCurrencySectionViewModel }) {
  return (
    <>
      <TripListCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionHelper}>환율 변환 없이 {section.currency} 기준으로 계산했어요.</Text>
        </View>
        <View style={styles.summaryGrid}>
          <SummaryMetric label="총 결제액" value={section.totalPaidAmountLabel} />
          <SummaryMetric label="총 부담액" value={section.totalShareAmountLabel} />
        </View>
      </TripListCard>

      <TripListCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>사람별 계산 근거</Text>
          <Text style={styles.sectionHelper}>결제 금액과 부담 금액의 차이를 보여줘요.</Text>
        </View>
        <View style={styles.balanceList}>
          {section.balanceRows.map((row, index) => (
            <View key={`${section.currency}-${row.displayName}-${index}`} style={styles.balanceRow}>
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceName}>{row.displayName}</Text>
                {row.statusLabel ? <Text style={styles.statusText}>{row.statusLabel}</Text> : null}
              </View>
              <View style={styles.summaryGrid}>
                <SummaryMetric label="결제" value={row.paidAmountLabel} />
                <SummaryMetric label="부담" value={row.shareAmountLabel} />
                <SummaryMetric direction={row.netDirection} label={row.netLabel} value={row.netAmountLabel} />
              </View>
            </View>
          ))}
        </View>
      </TripListCard>

      <TripListCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>최종 송금 제안</Text>
          <Text style={styles.sectionHelper}>위 차액을 줄이기 위한 송금 목록이에요.</Text>
        </View>
        {section.transferRows.length === 0 ? (
          <Text style={styles.emptyText}>보낼 금액이 없어요.</Text>
        ) : (
          <View style={styles.transferList}>
            {section.transferRows.map((row, index) => (
              <TransferRow
                amount={row.amountMinor}
                currency={section.currency}
                fromName={row.fromName}
                key={`${row.fromName}-${row.toName}-${row.amountMinor}-${index}`}
                toName={row.toName}
              />
            ))}
          </View>
        )}
      </TripListCard>

      <SettlementDetailExpenseSection rows={section.includedExpenses} title="정산 포함 지출" />
      <SettlementDetailExpenseSection rows={section.excludedExpenses} title="최종 정산 제외 지출" />
    </>
  );
}

function SettlementDetailExpenseSection({
  rows,
  title,
}: {
  title: string;
  rows: SettlementDetailExpenseRowViewModel[];
}) {
  return (
    <TripListCard>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionHelper}>{rows.length}건</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>해당 지출이 없어요.</Text>
      ) : (
        <View style={styles.expenseList}>
          {rows.map((row, index) => (
            <View key={row.id} style={[styles.expenseRow, index === 0 ? null : styles.rowDivider]}>
              <View style={styles.expenseHeader}>
                <View style={styles.expenseTitleColumn}>
                  <Text style={styles.expenseTitle}>{row.title}</Text>
                  <Text style={styles.sectionHelper}>
                    {row.contextLabel} · {row.categoryLabel} · {row.payerLabel}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>{row.amountLabel}</Text>
              </View>
              <Text style={styles.settlementLabel}>{row.settlementLabel}</Text>
              <View style={styles.splitList}>
                {row.splitRows.map((split, splitIndex) => (
                  <View key={`${row.id}-${split.displayName}-${splitIndex}`} style={styles.splitRow}>
                    <Text style={styles.splitName}>{split.displayName}</Text>
                    <Text style={styles.splitAmount}>{split.amountLabel}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </TripListCard>
  );
}

function SummaryMetric({
  direction,
  label,
  value,
}: {
  label: string;
  value: string;
  direction?: SettlementBalanceDirection;
}) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, direction ? netAmountStyle(direction) : null]}>{value}</Text>
    </View>
  );
}

function netAmountStyle(direction: SettlementBalanceDirection) {
  if (direction === 'receive') {
    return styles.metricValueReceive;
  }
  if (direction === 'send') {
    return styles.metricValueSend;
  }
  return styles.metricValueSettled;
}

function settlementDetailShellFailureState(status: 'auth' | 'notFound' | 'error'): SettlementDetailState {
  if (status === 'error') {
    return {
      status: 'error',
      error: {
        status: 'error',
        title: '정산 상세를 불러오지 못했어요.',
        helper: '잠시 후 다시 시도해주세요.',
        actionLabel: '다시 시도',
      },
    };
  }
  return { status };
}

function settlementDetailFailureState(error: unknown): SettlementDetailState {
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
  balanceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  balanceList: {
    gap: theme.space[3],
    paddingBottom: theme.space[4],
    paddingHorizontal: theme.space[5],
  },
  balanceName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  balanceRow: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: theme.space[3],
    paddingTop: theme.space[4],
  },
  emptyText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[5],
    textAlign: 'center',
  },
  expenseAmount: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  expenseHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  expenseList: {
    paddingBottom: theme.space[3],
  },
  expenseRow: {
    gap: theme.space[3],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  expenseTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  expenseTitleColumn: {
    flex: 1,
    gap: theme.space[1],
  },
  formulaText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  metricLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.micro,
  },
  metricValue: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  metricValueReceive: {
    color: theme.color.credit,
  },
  metricValueSend: {
    color: theme.color.debit,
  },
  metricValueSettled: {
    color: theme.color.textMuted,
  },
  noticeContent: {
    gap: theme.space[2],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[5],
  },
  noticeHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  noticeTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  rowDivider: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
  },
  sectionHeader: {
    gap: theme.space[2],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  sectionHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  settlementLabel: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  splitAmount: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  splitList: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.md,
    gap: theme.space[2],
    padding: theme.space[3],
  },
  splitName: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space[3],
  },
  statusText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
    paddingBottom: theme.space[4],
    paddingHorizontal: theme.space[5],
  },
  summaryMetric: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.md,
    flex: 1,
    gap: theme.space[1],
    minWidth: 112,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  transferList: {
    gap: theme.space[3],
    paddingBottom: theme.space[4],
    paddingHorizontal: theme.space[5],
  },
});
