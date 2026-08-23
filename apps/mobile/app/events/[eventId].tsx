import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GetEventResponse } from '@i-um/api-contract';

import {
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenBackground,
  SecondaryButton,
  SectionCard,
  theme,
} from '../../lib/design';
import { getEvent } from '../../lib/trips/meeting-api';
import { buildOutingDetailViewModel } from '../../lib/trips/outing-event';
import { eventExpensesPath } from '../../lib/trips/routes';

export default function OutingEventDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const eventId = typeof params.eventId === 'string' ? params.eventId : '';
  const [response, setResponse] = useState<GetEventResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      setError('약속 정보를 찾을 수 없어요.');
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    getEvent(eventId)
      .then((result) => {
        if (active) {
          setResponse(result);
        }
      })
      .catch(() => {
        if (active) {
          setError('약속 정보를 불러오지 못했어요.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  if (loading) {
    return (
      <ScreenBackground style={[styles.stateContent, { paddingTop: insets.top + theme.space[6] }]}>
        <LoadingState body="모임과 참여자를 확인하고 있어요." title="약속 상세를 불러오는 중" />
      </ScreenBackground>
    );
  }

  if (error || !response) {
    return (
      <ScreenBackground style={[styles.stateContent, { paddingTop: insets.top + theme.space[6] }]}>
        <ErrorState
          action={{ label: '홈으로', onPress: () => router.replace('/') }}
          body={error ?? '다시 시도해주세요.'}
          title="약속 상세 오류"
        />
      </ScreenBackground>
    );
  }

  if (response.event.eventType === 'trip' && response.event.tripId) {
    return (
      <ScreenBackground style={[styles.stateContent, { paddingTop: insets.top + theme.space[6] }]}>
        <ErrorState
          action={{ label: '홈으로', onPress: () => router.replace('/') }}
          body="여행 일정은 홈에서 여행 화면으로 열어주세요."
          title="여행 일정이에요"
        />
      </ScreenBackground>
    );
  }

  const viewModel = buildOutingDetailViewModel(response);

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + theme.space[8] }]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>약속 상세</Text>
          <Text style={styles.title}>{viewModel.title}</Text>
          <Text style={styles.subtitle}>기록은 정확하게, 기억은 다정하게.</Text>
        </View>

        <SectionCard title="일정">
          <View style={styles.heroCard}>
            <Text style={styles.dateLabel}>{viewModel.dateTimeLabel}</Text>
            <Text style={styles.categoryLabel}>{viewModel.categoryLabel}</Text>
          </View>
        </SectionCard>

        <SectionCard title="모임 정보">
          <View style={styles.rowStack}>
            {viewModel.detailRows.map(([label, value]) => (
              <View key={label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
          </View>
        </SectionCard>

        <PrimaryButton label="약속 장부 열기" onPress={() => router.push(eventExpensesPath(response.event.id))} />
        <SecondaryButton label="홈으로" onPress={() => router.replace('/')} />
        <SecondaryButton label="뒤로가기" onPress={() => router.back()} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  categoryLabel: {
    color: theme.color.brandAccent,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  dateLabel: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.3,
  },
  detailLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
  },
  detailRow: {
    gap: theme.space[1],
  },
  detailValue: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  eyebrow: {
    color: theme.color.brandAccent,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  header: {
    gap: theme.space[2],
  },
  heroCard: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  rowStack: {
    gap: theme.space[4],
  },
  scrollContent: {
    gap: theme.space[5],
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[6],
  },
  stateContent: {
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
  },
});
