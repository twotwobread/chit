import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { theme } from '../../../../lib/design';
import { buildDayItineraryViewModel, dayItineraryFailureState, type DayItineraryViewModel } from '../../../../lib/trips/day-itinerary';
import { buildManualPlaceRoute } from '../../../../lib/trips/manual-place';
import { buildGooglePlaceSearchRoute } from '../../../../lib/places/google-search';
import { getTripDayItinerary } from '../../../../lib/trips/client';

type DayItineraryState =
  | { status: 'loading' }
  | { status: 'success'; viewModel: DayItineraryViewModel }
  | { status: 'auth' }
  | { status: 'notFound'; title: string; helper: string }
  | { status: 'error'; title: string; helper: string };

export default function TripDayItineraryScreen() {
  const { tripId: tripIdParam, date: dateParam } = useLocalSearchParams<{ tripId?: string | string[]; date?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const [state, setState] = useState<DayItineraryState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!tripId || !date) {
      const notFound = dayItineraryFailureState(404);
      setState({ status: 'notFound', title: notFound.title, helper: notFound.helper });
      return;
    }

    setState({ status: 'loading' });
    try {
      const response = await getTripDayItinerary(tripId, date);
      setState({ status: 'success', viewModel: buildDayItineraryViewModel(response) });
    } catch (error) {
      if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        const failure = dayItineraryFailureState(error.status);
        if (failure.status === 'notFound') {
          setState({ status: 'notFound', title: failure.title, helper: failure.helper });
          return;
        }
        setState({ status: 'error', title: failure.title, helper: failure.helper });
        return;
      }
      const failure = dayItineraryFailureState();
      setState({ status: 'error', title: failure.title, helper: failure.helper });
    }
  }, [date, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const backToTripDetail = () => {
    if (tripId) {
      router.replace(`/trips/${tripId}`);
      return;
    }
    router.replace('/');
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Day 일정</Text>
      </View>

      {state.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>일정을 불러오는 중...</Text>
        </View>
      ) : null}

      {state.status === 'success' ? (
        <DayItineraryContent
          onAddPlace={() => {
            if (tripId && date) {
              router.push(buildManualPlaceRoute(tripId, date));
            }
          }}
          onSearchPlace={() => {
            if (tripId && date) {
              router.push(buildGooglePlaceSearchRoute(tripId, date));
            }
          }}
          viewModel={state.viewModel}
        />
      ) : null}

      {state.status === 'auth' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
            <Text style={styles.buttonText}>로그인하기</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'notFound' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>{state.title}</Text>
          <Text style={styles.message}>{state.helper}</Text>
          <Pressable accessibilityRole="button" onPress={backToTripDetail} style={styles.button}>
            <Text style={styles.buttonText}>여행 상세로</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>{state.title}</Text>
          <Text style={styles.message}>{state.helper}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.button}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function DayItineraryContent({ onAddPlace, onSearchPlace, viewModel }: { onAddPlace: () => void; onSearchPlace: () => void; viewModel: DayItineraryViewModel }) {
  return (
    <View style={styles.card}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayLabel}>{viewModel.dayLabel}</Text>
        <Text style={styles.dayDate}>{viewModel.formattedDate}</Text>
      </View>

      {viewModel.status === 'empty' ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>{viewModel.title}</Text>
          <Text style={styles.message}>{viewModel.helper}</Text>
        </View>
      ) : null}

      {viewModel.status === 'success' ? (
        <View style={styles.placeList}>
          {viewModel.items.map((item) => (
            <View key={item.id} style={styles.placeRow}>
              <View style={styles.orderBadge}>
                <Text style={styles.orderText}>{item.orderLabel}</Text>
              </View>
              <View style={styles.placeContent}>
                <View style={styles.placeTitleRow}>
                  <Text style={styles.placeName}>{item.placeName}</Text>
                  <Text style={styles.placeType}>{item.placeTypeLabel}</Text>
                </View>
                <Text style={styles.address}>{item.address}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actionGroup}>
        <Pressable accessibilityRole="button" onPress={onSearchPlace} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>장소 검색</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAddPlace} style={styles.button}>
          <Text style={styles.buttonText}>장소 추가</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.space[7],
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    marginBottom: theme.space[7],
  },
  screenTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.sm,
  },
  dayHeader: {
    alignItems: 'center',
    gap: theme.space[2],
  },
  dayLabel: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  dayDate: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  placeList: {
    gap: theme.space[3],
  },
  placeRow: {
    alignItems: 'flex-start',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[4],
    padding: theme.space[4],
  },
  orderBadge: {
    alignItems: 'center',
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.pill,
    height: theme.layout.controlHSm,
    justifyContent: 'center',
    width: theme.layout.controlHSm,
  },
  orderText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  placeContent: {
    flex: 1,
    gap: theme.space[2],
  },
  placeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  placeName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  placeType: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  address: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  emptyBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  actionGroup: {
    gap: theme.space[3],
  },
  button: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
});
