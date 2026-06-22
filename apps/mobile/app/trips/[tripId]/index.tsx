import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError, type GetTripDetailResponse } from '@i-um/api-contract';

import { MobileAuthError } from '../../../lib/auth/client';
import { getStoredSession } from '../../../lib/auth/session';
import { theme } from '../../../lib/design';
import { getTripDetail } from '../../../lib/trips/client';

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
  const canEdit = currentUserId === detail.trip.createdBy;
  return (
    <View style={styles.card}>
      <Text style={styles.tripName}>{detail.trip.name}</Text>
      <View style={styles.infoList}>
        <InfoRow label="기간" value={`${formatDate(detail.trip.startDate)} ~ ${formatDate(detail.trip.endDate)}`} />
        <InfoRow label="기본 통화" value={detail.trip.defaultCurrency} />
        <InfoRow label="참여자" value={formatParticipantSummary(detail.participantSummary)} />
      </View>
      {canEdit ? (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/trips/${detail.trip.id}/edit`)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>여행 정보 수정</Text>
        </Pressable>
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

function formatDate(value: string): string {
  return value.replace(/-/g, '.');
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
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
});
