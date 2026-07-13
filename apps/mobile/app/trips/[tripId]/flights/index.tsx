import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError, type FlightSummary } from '@i-um/api-contract';

import { Card, PrimaryButton, theme } from '../../../../lib/design';
import { listTripFlights } from '../../../../lib/flights/flight-api';
import { buildFlightVaultViewModel, type FlightCardViewModel } from '../../../../lib/flights/view-model';
import { TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { tripFlightDetailPath, tripFlightNewPath } from '../../../../lib/trips/routes';

export default function FlightVaultScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'success'; flights: FlightSummary[] } | { status: 'error'; message: string }
  >({ status: 'loading' });

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'error', message: '여행 정보를 확인할 수 없어요.' });
      return;
    }
    setState({ status: 'loading' });
    try {
      const response = await listTripFlights(tripId);
      setState({ status: 'success', flights: response.flights });
    } catch (error) {
      setState({ status: 'error', message: flightListErrorMessage(error) });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <TripScreen>
        <TripStateCard helper="공유 항공편과 내 탑승권 정보를 불러오는 중이에요." loading title="항공권 보관함" />
      </TripScreen>
    );
  }

  if (state.status === 'error') {
    return (
      <TripScreen>
        <TripStateCard
          helper={state.message}
          primaryAction={{ label: '다시 시도', onPress: load }}
          title="불러올 수 없어요"
        />
      </TripScreen>
    );
  }

  const viewModel = buildFlightVaultViewModel(state.flights);
  const openNew = () => {
    if (tripId) {
      router.push(tripFlightNewPath(tripId));
    }
  };

  return (
    <TripScreen>
      <TripScreenHeader
        helper="항공편 정보는 여행 동행자에게 공유되고, 예약번호·좌석·탑승권은 본인에게만 보입니다."
        title="항공권"
      />
      <PrimaryButton label="항공편 추가" onPress={openNew} />
      {state.flights.length === 0 ? (
        <TripStateCard
          helper="항공편을 추가하면 동행자 도착 시간과 내 탑승권을 함께 관리할 수 있어요."
          title="아직 항공편이 없어요"
        />
      ) : null}
      <FlightSection
        cards={viewModel.myFlights}
        emptyLabel="내 항공편이 아직 없어요."
        title="내 항공편"
        tripId={tripId ?? ''}
      />
      <FlightSection
        cards={viewModel.companionFlights}
        emptyLabel="동행 도착 항공편이 아직 없어요."
        title="동행 도착"
        tripId={tripId ?? ''}
      />
    </TripScreen>
  );
}

function FlightSection({
  cards,
  emptyLabel,
  title,
  tripId,
}: {
  title: string;
  cards: FlightCardViewModel[];
  emptyLabel: string;
  tripId: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {cards.length === 0 ? <Text style={styles.empty}>{emptyLabel}</Text> : null}
      {cards.map((card) => (
        <Pressable
          accessibilityLabel={`${card.title} 항공편 열기`}
          accessibilityRole="button"
          key={card.id}
          onPress={() => router.push(tripFlightDetailPath(tripId, card.id))}
          style={({ pressed }) => [pressed ? styles.pressed : null]}
        >
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              {card.boardingPassActionLabel ? <Text style={styles.badge}>{card.boardingPassActionLabel}</Text> : null}
            </View>
            <Text style={styles.route}>{card.routeLabel}</Text>
            <Text style={styles.helper}>{card.timeLabel}</Text>
            <Text style={styles.helper}>탑승자 {card.passengerLabel}</Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

function flightListErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return '다시 로그인해주세요.';
    }
    if (error.status === 403 || error.status === 404) {
      return '삭제되었거나 접근할 수 없는 여행이에요.';
    }
  }
  return '잠시 후 다시 시도해주세요.';
}

const styles = StyleSheet.create({
  badge: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  card: {
    padding: theme.space[5],
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  empty: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  helper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  pressed: {
    opacity: 0.72,
  },
  route: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  section: {
    gap: theme.space[3],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
});
