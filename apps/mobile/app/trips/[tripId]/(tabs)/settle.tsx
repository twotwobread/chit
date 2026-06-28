import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { theme } from '../../../../lib/design';
import { ExpenseRow } from '../../../../lib/trip-ui/ExpenseRow';
import { TripListCard, TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { getTripDetail, listDayExpenses } from '../../../../lib/trips/client';
import {
  buildDayExpensesViewModel,
  dayExpensesFailureState,
  type DayExpensesFailureViewModel,
  type DayExpensesViewModel,
} from '../../../../lib/trips/day-expenses';
import { buildDayItineraryRoute } from '../../../../lib/trips/day-itinerary';
import {
  buildTripTabUnavailableViewModel,
  findTripCalendarDay,
  type TripTabUnavailableViewModel,
} from '../../../../lib/trips/trip-tabs';
import { localDateString } from '../../../../lib/trips/status';

type TripSettleState =
  | { status: 'loading' }
  | { status: 'success'; viewModel: DayExpensesViewModel; dayRoute: ReturnType<typeof buildDayItineraryRoute> }
  | { status: 'unavailable'; viewModel: TripTabUnavailableViewModel }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error'; error: DayExpensesFailureViewModel };

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
      const detail = await getTripDetail(tripId);
      const currentDay = findTripCalendarDay(detail.days, localDateString());
      if (!currentDay) {
        setState({ status: 'unavailable', viewModel: buildTripTabUnavailableViewModel('settle', tripId) });
        return;
      }

      const expenses = await listDayExpenses(tripId, currentDay.id);
      setState({
        status: 'success',
        dayRoute: buildDayItineraryRoute(tripId, currentDay.id),
        viewModel: buildDayExpensesViewModel({ date: currentDay.id, expenses: expenses.expenses, tripId }),
      });
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
      <TripScreenHeader helper="오늘 기록된 지출을 확인해 정산 흐름을 준비해요." title="정산" />

      {state.status === 'loading' ? <TripStateCard loading title="지출을 불러오는 중..." /> : null}
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
      {state.status === 'unavailable' ? <UnavailableState viewModel={state.viewModel} /> : null}
      {state.status === 'success' ? <SettleContent dayRoute={state.dayRoute} viewModel={state.viewModel} /> : null}
    </TripScreen>
  );
}

function SettleContent({
  dayRoute,
  viewModel,
}: {
  viewModel: DayExpensesViewModel;
  dayRoute: ReturnType<typeof buildDayItineraryRoute>;
}) {
  if (viewModel.status === 'empty') {
    return (
      <TripStateCard
        helper="지출 등록은 Day 상세 화면에서 이어갈 수 있어요."
        primaryAction={{ label: '오늘 일정 보기', onPress: () => router.push(dayRoute) }}
        title={viewModel.emptyTitle}
      />
    );
  }

  return (
    <TripListCard>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{viewModel.title}</Text>
        <Text style={styles.summaryHelper}>오늘 등록된 지출 {viewModel.rows.length}건</Text>
      </View>
      {viewModel.rows.map((row, index) => (
        <ExpenseRow
          amount={row.amountMinor}
          category={row.category}
          currency={row.currency}
          first={index === 0}
          key={row.id}
          payerLabel={row.payerLabel}
          splitLabel={row.splitLabel}
          title={row.placeName}
        />
      ))}
    </TripListCard>
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

function settleFailureState(error: unknown): TripSettleState {
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
  return { status: 'error', error: dayExpensesFailureState() };
}

const styles = StyleSheet.create({
  summary: {
    gap: theme.space[1],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  summaryHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  summaryTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
});
