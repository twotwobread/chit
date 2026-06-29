import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';

import { theme } from '../../../../lib/design';
import { TransferRow } from '../../../../lib/trip-ui/TransferRow';
import { TripListCard, TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { getTripDetail, getTripSettlement } from '../../../../lib/trips/client';
import { buildDayItineraryRoute } from '../../../../lib/trips/day-itinerary';
import {
  buildSettlementTransferViewModel,
  settlementTransferFailureState,
  type SettlementTransferFailureViewModel,
  type SettlementTransferViewModel,
} from '../../../../lib/trips/settlement';
import { localDateString } from '../../../../lib/trips/status';
import { findTripCalendarDay } from '../../../../lib/trips/trip-tabs';

type TripSettleState =
  | { status: 'loading' }
  | { status: 'settlement'; viewModel: SettlementTransferViewModel }
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

    setState({ status: 'loading' });
    try {
      const [detail, settlement] = await Promise.all([getTripDetail(tripId), getTripSettlement(tripId)]);
      const currentDay = findTripCalendarDay(detail.days, localDateString());
      const todayRoute = currentDay ? String(buildDayItineraryRoute(tripId, currentDay.id)) : null;

      setState({ status: 'settlement', viewModel: buildSettlementTransferViewModel({ settlement, todayRoute }) });
    } catch (error) {
      setState(settleFailureState(error));
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <TripScreen>
      <TripScreenHeader helper="누가 누구에게 얼마를 보내면 되는지 확인해요." title="정산" />

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
      {state.status === 'settlement' ? <SettlementContent viewModel={state.viewModel} /> : null}
    </TripScreen>
  );
}

function SettlementContent({ viewModel }: { viewModel: SettlementTransferViewModel }) {
  if (viewModel.status === 'empty') {
    const primaryAction = viewModel.primaryAction;
    return (
      <TripStateCard
        helper={viewModel.helper}
        primaryAction={
          primaryAction
            ? {
                label: primaryAction.label,
                onPress: () => router.push(primaryAction.route as Href),
              }
            : undefined
        }
        title={viewModel.title}
      />
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

      {viewModel.sections.map((section) => (
        <TripListCard key={section.currency}>
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
    </View>
  );
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
