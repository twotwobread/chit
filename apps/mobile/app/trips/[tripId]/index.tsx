import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError, type GetTripDetailResponse } from '@i-um/api-contract';

import { MobileAuthError } from '../../../lib/auth/client';
import { getStoredSession } from '../../../lib/auth/session';
import { SecondaryButton, theme } from '../../../lib/design';
import { deleteTrip, getTripDetail } from '../../../lib/trips/client';
import { buildDayItineraryRoute } from '../../../lib/trips/day-itinerary';
import { buildTripDayViewModels, formatTripDayDate } from '../../../lib/trips/days';
import { tripParticipantsPath } from '../../../lib/trips/participants';
import {
  beginTripDelete,
  cancelTripDelete,
  deleteTripFailureState,
  openTripDeleteConfirmation,
  type TripDeleteState,
} from '../../../lib/trips/delete-flow';

type DetailState =
  | { status: 'loading' }
  | { status: 'success'; detail: GetTripDetailResponse; currentUserId?: string }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export default function TripDetailScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    setState({ status: 'loading' });
    try {
      const detail = await getTripDetail(tripId);
      const session = await getStoredSession();
      setState({ status: 'success', detail, currentUserId: session?.user.id });
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
        if (error.status === 400 || error.status === 403 || error.status === 404) {
          setState({ status: 'notFound' });
          return;
        }
      }
      setState({ status: 'error' });
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>여행 상세</Text>
      </View>

      {state.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>여행 정보를 불러오는 중...</Text>
        </View>
      ) : null}

      {state.status === 'success' ? <TripDetailCard currentUserId={state.currentUserId} detail={state.detail} /> : null}

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
          <Text style={styles.errorTitle}>여행을 찾을 수 없어요.</Text>
          <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행이에요.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.button}>
            <Text style={styles.buttonText}>홈으로</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>여행 정보를 불러올 수 없어요.</Text>
          <Text style={styles.message}>잠시 후 다시 시도해주세요.</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.button}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function TripDetailCard({ currentUserId, detail }: { currentUserId?: string; detail: GetTripDetailResponse }) {
  const canManage = currentUserId === detail.trip.createdBy;
  const [deleteState, setDeleteState] = useState<TripDeleteState>({ status: 'idle' });
  const deletingRef = useRef(false);

  const confirmDelete = async () => {
    const nextState = beginTripDelete(deleteState);
    if (nextState.status !== 'deleting' || deletingRef.current) {
      return;
    }

    deletingRef.current = true;
    setDeleteState(nextState);
    try {
      await deleteTrip(detail.trip.id);
      router.replace('/mypage');
    } catch (error) {
      if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
        setDeleteState(deleteTripFailureState(401));
        return;
      }
      if (error instanceof ApiError) {
        setDeleteState(deleteTripFailureState(error.status));
        return;
      }
      setDeleteState(deleteTripFailureState());
    } finally {
      deletingRef.current = false;
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.tripName}>{detail.trip.name}</Text>
      <View style={styles.infoList}>
        <InfoRow label="기간" value={`${formatTripDayDate(detail.trip.startDate)} ~ ${formatTripDayDate(detail.trip.endDate)}`} />
        <InfoRow label="기본 통화" value={detail.trip.defaultCurrency} />
        <InfoRow label="참여자" value={formatParticipantSummary(detail.participantSummary)} />
      </View>
      <SecondaryButton label="참여자 모두 보기" onPress={() => router.push(tripParticipantsPath(detail.trip.id))} />
      <TripDayList days={detail.days} tripId={detail.trip.id} />
      {canManage ? (
        <>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/trips/${detail.trip.id}/edit`)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>여행 정보 수정</Text>
          </Pressable>
          {deleteState.status === 'idle' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setDeleteState(openTripDeleteConfirmation(deleteState))}
              style={styles.dangerOutlineButton}
            >
              <Text style={styles.dangerOutlineButtonText}>여행 삭제</Text>
            </Pressable>
          ) : null}
          <Modal
            animationType="fade"
            onRequestClose={() => setDeleteState(cancelTripDelete(deleteState))}
            transparent
            visible={deleteState.status === 'confirming'}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.deleteTitle}>여행을 삭제할까요?</Text>
                <Text style={styles.message}>이 여행은 모든 참여자에게서 삭제되고 되돌릴 수 없어요.</Text>
                <View style={styles.actionRow}>
                  <Pressable accessibilityRole="button" onPress={() => setDeleteState(cancelTripDelete(deleteState))} style={styles.secondaryActionButton}>
                    <Text style={styles.secondaryButtonText}>취소</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => void confirmDelete()} style={styles.dangerButton}>
                    <Text style={styles.buttonText}>삭제하기</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
          {deleteState.status === 'deleting' ? (
            <View style={styles.dangerPanel}>
              <ActivityIndicator color={theme.color.danger} />
              <Text style={styles.message}>여행을 삭제하는 중...</Text>
            </View>
          ) : null}
          {deleteState.status === 'auth' ? (
            <View style={styles.dangerPanel}>
              <Text style={styles.errorTitle}>{deleteState.message}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
                <Text style={styles.buttonText}>로그인하기</Text>
              </Pressable>
            </View>
          ) : null}
          {deleteState.status === 'safeFailure' ? (
            <View style={styles.dangerPanel}>
              <Text style={styles.errorTitle}>{deleteState.message}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/mypage')} style={styles.button}>
                <Text style={styles.buttonText}>마이페이지로</Text>
              </Pressable>
            </View>
          ) : null}
          {deleteState.status === 'error' ? (
            <View style={styles.dangerPanel}>
              <Text style={styles.errorTitle}>{deleteState.message}</Text>
              <Pressable accessibilityRole="button" onPress={() => setDeleteState(openTripDeleteConfirmation(deleteState))} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function TripDayList({ days, tripId }: { days: GetTripDetailResponse['days']; tripId: string }) {
  const viewModels = buildTripDayViewModels(days);

  return (
    <View style={styles.daySection}>
      <View style={styles.daySectionHeader}>
        <Text style={styles.sectionTitle}>여행 일정</Text>
        <Text style={styles.sectionHelper}>여행 기간에 맞춰 날짜별 일정이 준비됐어요.</Text>
      </View>
      <View style={styles.dayList}>
        {viewModels.map((day) => (
          <Pressable
            accessibilityRole="button"
            key={day.date}
            onPress={() => router.push(buildDayItineraryRoute(tripId, day.date))}
            style={styles.dayRow}
          >
            <View style={styles.dayRowMain}>
              <Text style={styles.dayLabel}>{day.dayLabel}</Text>
              <Text style={styles.dayDate}>{day.formattedDate}</Text>
            </View>
            {day.lodgingSummary ? (
              <View style={styles.dayLodgingSummary}>
                <Text style={styles.dayLodgingLabel}>{day.lodgingSummary.label}</Text>
                <Text style={styles.dayLodgingName}>{day.lodgingSummary.placeName}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function formatParticipantSummary(summary: GetTripDetailResponse['participantSummary']): string {
  const countText = `참여자 ${summary.totalCount}명`;
  const names = summary.previewNames.map((name) => name.trim() || '여행자');
  if (names.length === 0) {
    return countText;
  }
  const overflowText = summary.overflowCount > 0 ? ` 외 ${summary.overflowCount}명` : '';
  return `${countText} · ${names.join(', ')}${overflowText}`;
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
  tripName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  infoList: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[4],
    padding: theme.space[5],
  },
  infoRow: {
    gap: theme.space[2],
  },
  daySection: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[5],
    padding: theme.space[5],
  },
  daySectionHeader: {
    gap: theme.space[2],
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  sectionHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  dayList: {
    gap: theme.space[3],
  },
  dayRow: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  dayRowMain: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayLabel: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  dayDate: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  dayLodgingSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  dayLodgingLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  dayLodgingName: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  label: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  value: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
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
  button: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
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
  secondaryButton: {
    alignItems: 'center',
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  secondaryActionButton: {
    alignItems: 'center',
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  dangerOutlineButton: {
    alignItems: 'center',
    borderColor: theme.color.danger,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  dangerOutlineButtonText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: theme.color.danger,
    borderRadius: theme.radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  dangerPanel: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[5],
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: theme.color.bg,
    flex: 1,
    justifyContent: 'center',
    padding: theme.space[7],
  },
  modalCard: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.md,
  },
  deleteTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
});
