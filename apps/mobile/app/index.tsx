import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../lib/auth/client';
import { clearStoredSession, readStoredSession } from '../lib/auth/session';
import { theme } from '../lib/design';
import { BottomMenu } from '../lib/navigation/BottomMenu';
import { getTripDayItinerary, getTripDetail, listMyTrips } from '../lib/trips/client';
import { localDateString } from '../lib/trips/status';
import {
  buildTodayExecutionViewModel,
  buildTodayNoOngoingTripViewModel,
  buildTodayRetryableErrorViewModel,
  buildTodayUnavailableViewModel,
  findTodayTripDay,
  selectTodayTrip,
  type TodayAction,
  type TodayExecutionViewModel,
} from '../lib/trips/today-execution';

type TodayState =
  | { status: 'loading' }
  | { status: 'needsLogin'; message?: string }
  | { status: 'ready'; viewModel: TodayExecutionViewModel };

export default function HomeScreen() {
  const [todayState, setTodayState] = useState<TodayState>({ status: 'loading' });

  const handleAuthError = useCallback(async (error: unknown) => {
    if (
      error instanceof MobileAuthError &&
      (error.code === 'INVALID_REFRESH_TOKEN' || error.code === 'UNAUTHORIZED')
    ) {
      await clearStoredSession();
      setTodayState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
      return true;
    }
    if (error instanceof ApiError && error.status === 401) {
      await clearStoredSession();
      setTodayState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async () => {
    setTodayState({ status: 'loading' });

    try {
      const stored = await readStoredSession();
      if (stored.status === 'missing') {
        setTodayState({ status: 'needsLogin' });
        return;
      }
      if (stored.status === 'corrupt') {
        setTodayState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
        return;
      }

      const today = localDateString();
      const trips = await listMyTrips();
      const selectedTrip = selectTodayTrip(trips.trips, today);
      if (!selectedTrip) {
        setTodayState({ status: 'ready', viewModel: buildTodayNoOngoingTripViewModel() });
        return;
      }

      let detail;
      try {
        detail = await getTripDetail(selectedTrip.trip.id);
      } catch (error) {
        if (await handleAuthError(error)) {
          return;
        }
        setTodayState({
          status: 'ready',
          viewModel: isUnavailableError(error)
            ? buildTodayUnavailableViewModel(selectedTrip.trip.id)
            : buildTodayRetryableErrorViewModel(),
        });
        return;
      }

      const currentDay = findTodayTripDay(detail.days, today);
      if (!currentDay) {
        setTodayState({ status: 'ready', viewModel: buildTodayUnavailableViewModel(selectedTrip.trip.id) });
        return;
      }

      try {
        const itinerary = await getTripDayItinerary(selectedTrip.trip.id, currentDay.date);
        setTodayState({
          status: 'ready',
          viewModel: buildTodayExecutionViewModel({
            selectedTrip: selectedTrip.trip,
            tripDetail: detail,
            itinerary,
            today,
            ongoingTripCount: selectedTrip.ongoingTripCount,
          }),
        });
      } catch (error) {
        if (await handleAuthError(error)) {
          return;
        }
        setTodayState({
          status: 'ready',
          viewModel: isUnavailableError(error)
            ? buildTodayUnavailableViewModel(selectedTrip.trip.id)
            : buildTodayRetryableErrorViewModel(selectedTrip.trip.id),
        });
      }
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      setTodayState({ status: 'ready', viewModel: buildTodayRetryableErrorViewModel() });
    }
  }, [handleAuthError]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const runAction = useCallback(
    (action: TodayAction) => {
      if (action.kind === 'retry') {
        void load();
        return;
      }
      router.push(action.route);
    },
    [load],
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>오늘</Text>
          <Text style={styles.subtitle}>다음 장소를 바로 확인해요.</Text>
        </View>

        {todayState.status === 'loading' ? (
          <View style={styles.card}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>오늘 일정을 불러오는 중...</Text>
          </View>
        ) : null}

        {todayState.status === 'needsLogin' ? (
          <View style={styles.card}>
            <Text style={styles.message}>{todayState.message ?? '로그인이 필요합니다.'}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
              <Text style={styles.buttonText}>로그인하기</Text>
            </Pressable>
          </View>
        ) : null}

        {todayState.status === 'ready' ? <TodayContent onAction={runAction} viewModel={todayState.viewModel} /> : null}
      </ScrollView>

      {todayState.status === 'ready' ? <BottomMenu selected="home" /> : null}
    </View>
  );
}

function TodayContent({ onAction, viewModel }: { onAction: (action: TodayAction) => void; viewModel: TodayExecutionViewModel }) {
  if (viewModel.status === 'noOngoingTrip') {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyTitle}>{viewModel.title}</Text>
        <Text style={styles.message}>{viewModel.helper}</Text>
        <View style={styles.actionRow}>
          <ActionButton action={viewModel.primaryAction} onAction={onAction} />
          <ActionButton action={viewModel.secondaryAction} onAction={onAction} variant="secondary" />
        </View>
      </View>
    );
  }

  if (viewModel.status === 'retryableError' || viewModel.status === 'unavailable') {
    return (
      <View style={styles.card}>
        <Text style={styles.errorTitle}>{viewModel.title}</Text>
        <Text style={styles.message}>{viewModel.helper}</Text>
        <View style={styles.actionRow}>
          <ActionButton action={viewModel.primaryAction} onAction={onAction} />
          {viewModel.secondaryAction ? <ActionButton action={viewModel.secondaryAction} onAction={onAction} variant="secondary" /> : null}
        </View>
      </View>
    );
  }

  if (viewModel.status === 'emptyItinerary') {
    return (
      <View style={styles.card}>
        <TodayDayHeader dayLabel={viewModel.dayLabel} formattedDate={viewModel.formattedDate} tripName={viewModel.tripName} />
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>{viewModel.title}</Text>
          <Text style={styles.message}>{viewModel.helper}</Text>
        </View>
        <ActionButton action={viewModel.primaryAction} onAction={onAction} />
        <MultipleOngoingNotice notice={viewModel.multipleOngoingTripNotice} onAction={onAction} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <TodayDayHeader dayLabel={viewModel.dayLabel} formattedDate={viewModel.formattedDate} tripName={viewModel.tripName} />
      <View style={styles.nextPlaceCard}>
        <Text style={styles.overline}>다음 장소</Text>
        <Text style={styles.nextPlaceName}>{viewModel.nextPlace.placeName}</Text>
        <View style={styles.placeMetaRow}>
          <Text style={styles.orderBadge}>{viewModel.nextPlace.orderLabel}</Text>
          <Text style={styles.placeType}>{viewModel.nextPlace.placeTypeLabel}</Text>
        </View>
        <Text style={styles.address}>{viewModel.nextPlace.address}</Text>
      </View>
      <ActionButton action={viewModel.primaryAction} onAction={onAction} />
      <MultipleOngoingNotice notice={viewModel.multipleOngoingTripNotice} onAction={onAction} />
    </View>
  );
}

function TodayDayHeader({ dayLabel, formattedDate, tripName }: { dayLabel: string; formattedDate: string; tripName: string }) {
  return (
    <View style={styles.dayHeader}>
      <Text style={styles.tripName}>{tripName}</Text>
      <Text style={styles.dayText}>{dayLabel} · {formattedDate}</Text>
    </View>
  );
}

function MultipleOngoingNotice({
  notice,
  onAction,
}: {
  notice: Extract<TodayExecutionViewModel, { status: 'success' | 'emptyItinerary' }>['multipleOngoingTripNotice'];
  onAction: (action: TodayAction) => void;
}) {
  if (!notice) {
    return null;
  }

  return (
    <View style={styles.noticeBox}>
      <Text style={styles.noticeText}>{notice.message}</Text>
      <Pressable accessibilityRole="button" onPress={() => onAction(notice.action)} style={styles.noticeButton}>
        <Text style={styles.secondaryButtonText}>{notice.action.label}</Text>
      </Pressable>
    </View>
  );
}

function ActionButton({
  action,
  onAction,
  variant = 'primary',
}: {
  action: TodayAction;
  onAction: (action: TodayAction) => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onAction(action)}
      style={variant === 'primary' ? styles.button : styles.secondaryButton}
    >
      <Text style={variant === 'primary' ? styles.buttonText : styles.secondaryButtonText}>{action.label}</Text>
    </Pressable>
  );
}

function isUnavailableError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[4],
    padding: theme.space[7],
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    gap: theme.space[3],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
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
    gap: theme.space[2],
  },
  tripName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  dayText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  nextPlaceCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  overline: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  nextPlaceName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  placeMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  orderBadge: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
    overflow: 'hidden',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  placeType: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  address: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  emptyPanel: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
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
  actionRow: {
    flexDirection: 'row',
    gap: theme.space[4],
  },
  button: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  noticeBox: {
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.md,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  noticeText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  noticeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
  },
});
