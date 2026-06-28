import { useCallback, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError, type GetTripDetailResponse } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { Badge, ListRow, theme } from '../../../../lib/design';
import { TripListCard, TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { getTripDetail } from '../../../../lib/trips/client';
import { buildDayItineraryRoute } from '../../../../lib/trips/day-itinerary';
import { buildTripDayViewModels } from '../../../../lib/trips/days';
import { tripDetailPath } from '../../../../lib/trips/routes';

type ItineraryState =
  | { status: 'loading' }
  | { status: 'success'; detail: GetTripDetailResponse }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export default function TripItineraryTabScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [state, setState] = useState<ItineraryState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    setState({ status: 'loading' });
    try {
      setState({ status: 'success', detail: await getTripDetail(tripId) });
    } catch (error) {
      setState(itineraryFailureState(error));
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <TripScreen>
      <TripScreenHeader helper="여행 날짜별 일정을 선택해 자세히 확인해요." title="일정" />

      {state.status === 'loading' ? <TripStateCard loading title="일정을 불러오는 중..." /> : null}
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
          title="일정을 불러올 수 없어요."
        />
      ) : null}
      {state.status === 'success' ? (
        <TripDayList detail={state.detail} tripId={tripId ?? state.detail.trip.id} />
      ) : null}
    </TripScreen>
  );
}

function TripDayList({ detail, tripId }: { detail: GetTripDetailResponse; tripId: string }) {
  const days = buildTripDayViewModels(detail.days);

  if (days.length === 0) {
    return (
      <TripStateCard
        helper="여행 기간이 아직 준비되지 않았어요. 여행 정보를 확인해 주세요."
        primaryAction={{ label: '여행 정보 보기', onPress: () => router.push(tripDetailPath(tripId)) }}
        title="일정이 없어요."
      />
    );
  }

  return (
    <TripListCard>
      {days.map((day, index) => (
        <ListRow
          first={index === 0}
          key={day.id}
          onPress={() => router.push(buildDayItineraryRoute(tripId, day.id))}
          subtitle={
            <View style={styles.daySubtitle}>
              <Text style={styles.dayDate}>{day.formattedDate}</Text>
              {day.lodgingSummary ? <Badge label={day.lodgingSummary.placeName} tone="neutral" /> : null}
            </View>
          }
          title={day.dayLabel}
          trailing={<Text style={styles.trailing}>보기</Text>}
        />
      ))}
    </TripListCard>
  );
}

function itineraryFailureState(error: unknown): ItineraryState {
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
  dayDate: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  daySubtitle: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  trailing: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
});
