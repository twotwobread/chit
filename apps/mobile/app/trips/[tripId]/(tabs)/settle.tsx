import { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, CircleCheck, type LucideIcon } from 'lucide-react-native';
import KakaoShareLink from 'react-native-kakao-share-link';

import { SecondaryButton, theme } from '../../../../lib/design';
import { TransferRow } from '../../../../lib/trip-ui/TransferRow';
import { TripListCard, TripScreen, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { getTripSettlement } from '../../../../lib/trips/settlement-api';
import {
  buildKakaoSettlementRequestTemplate,
  buildSettlementRequestMessage,
  buildSettlementTransferViewModel,
  settlementTransferFailureState,
  type SettlementBalanceDirection,
  type SettlementTransferFailureViewModel,
  type SettlementTransferViewModel,
} from '../../../../lib/trips/settlement';
import { tripSettlementDetailDeepLink } from '../../../../lib/trips/routes';
import { resolveTripShellDetail } from '../../../../lib/trips/trip-shell-detail';
import { useTripShellState } from '../../../../lib/trips/trip-shell-context';

type TripSettleState =
  | { status: 'loading' }
  | { status: 'settlement'; tripName: string; viewModel: SettlementTransferViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error'; error: Extract<SettlementTransferFailureViewModel, { status: 'error' }> };

export default function TripSettleTabScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const shellState = useTripShellState();
  const [state, setState] = useState<TripSettleState>({ status: 'loading' });

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
      setState(settleShellFailureState(shellDetail.status));
      return;
    }

    setState({ status: 'loading' });
    try {
      const settlement = await getTripSettlement(tripId);
      setState({
        status: 'settlement',
        tripName: shellDetail.detail.trip.name.trim() || '여행',
        viewModel: buildSettlementTransferViewModel({ settlement }),
      });
    } catch (error) {
      setState(settleFailureState(error));
    }
  }, [shellState, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <TripScreen>
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
        <SettlementContent tripId={tripId ?? ''} tripName={state.tripName} viewModel={state.viewModel} />
      ) : null}
    </TripScreen>
  );
}

function SettlementContent({
  tripId,
  tripName,
  viewModel,
}: {
  tripId: string;
  tripName: string;
  viewModel: SettlementTransferViewModel;
}) {
  return (
    <>
      <TripListCard>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>LIVE SETTLEMENT</Text>
          <Text style={styles.heroTitle}>칫, 정산 별거없네.</Text>
          <Text style={styles.heroHelper}>현재 지출 기준 최신 정산이에요. 수정하면 사람별 금액도 바로 바뀝니다.</Text>
          <Text style={styles.heroFormula}>결제 금액 - 부담 금액 = 받을/보낼 금액</Text>
        </View>
      </TripListCard>

      <TripListCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{viewModel.currencyRuleNotice.title}</Text>
          <Text style={styles.sectionHelper}>{viewModel.currencyRuleNotice.helper}</Text>
        </View>
      </TripListCard>

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

      <SettlementRequestButton
        detailLink={tripSettlementDetailDeepLink(tripId)}
        tripName={tripName}
        viewModel={viewModel}
      />
    </>
  );
}

function SettlementRequestButton({
  detailLink,
  tripName,
  viewModel,
}: {
  detailLink: string;
  tripName: string;
  viewModel: SettlementTransferViewModel;
}) {
  const message = buildSettlementRequestMessage(viewModel, tripName, detailLink);
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
      {direction ? <BalanceMetricIcon direction={direction} /> : null}
      <View style={styles.balanceMetricTextColumn}>
        <Text style={styles.balanceMetricLabel}>{label}</Text>
        <Text style={[styles.balanceMetricValue, direction ? netAmountStyle(direction) : null]}>{value}</Text>
      </View>
    </View>
  );
}

function BalanceMetricIcon({ direction }: { direction: SettlementBalanceDirection }) {
  const Icon: LucideIcon = direction === 'receive' ? ArrowDownLeft : direction === 'send' ? ArrowUpRight : CircleCheck;
  return (
    <View style={[styles.balanceMetricIcon, balanceMetricIconStyle(direction)]}>
      <Icon color={balanceMetricIconColor(direction)} size={16} strokeWidth={2.5} />
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

function balanceMetricIconStyle(direction: SettlementBalanceDirection) {
  if (direction === 'receive') {
    return styles.balanceMetricIconReceive;
  }
  if (direction === 'send') {
    return styles.balanceMetricIconSend;
  }
  return styles.balanceMetricIconSettled;
}

function balanceMetricIconColor(direction: SettlementBalanceDirection): string {
  if (direction === 'receive') {
    return theme.color.credit;
  }
  if (direction === 'send') {
    return theme.color.debit;
  }
  return theme.color.textMuted;
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
  balanceList: {
    gap: theme.space[3],
    paddingBottom: theme.space[4],
    paddingHorizontal: theme.space[5],
  },
  balanceMetric: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: theme.space[2],
    minWidth: 104,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[3],
  },
  balanceMetricIcon: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  balanceMetricIconReceive: {
    backgroundColor: theme.color.chit.fintechBlueSoft,
  },
  balanceMetricIconSend: {
    backgroundColor: theme.color.chit.punchRedSoft,
  },
  balanceMetricIconSettled: {
    backgroundColor: theme.color.surface,
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
  balanceMetricTextColumn: {
    flex: 1,
    gap: theme.space[1],
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
    paddingTop: theme.space[4],
  },
  balanceRowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  heroCard: {
    backgroundColor: theme.color.chit.charcoal,
    borderRadius: theme.radius.xl,
    gap: theme.space[3],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[5],
  },
  heroEyebrow: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.8,
  },
  heroFormula: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  heroHelper: {
    color: theme.color.ink[100],
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  heroTitle: {
    color: theme.color.textOnDark,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  sectionHeader: {
    gap: theme.space[2],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  sectionHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
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
    paddingVertical: theme.space[1],
  },
  statusBadgeText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  transferList: {
    gap: theme.space[3],
    paddingBottom: theme.space[4],
    paddingHorizontal: theme.space[5],
  },
});
