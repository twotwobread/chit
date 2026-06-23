import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../lib/auth/client';
import { Card, PrimaryButton, theme } from '../../../lib/design';
import { listTripParticipants } from '../../../lib/trips/client';
import {
  buildParticipantListViewModel,
  participantListFailureStatus,
  type ParticipantListFailureStatus,
  type ParticipantListViewModel,
} from '../../../lib/trips/participants';

type ParticipantsState =
  | { status: 'loading' }
  | { status: 'success'; viewModel: ParticipantListViewModel }
  | { status: 'auth' }
  | { status: 'invalid' }
  | { status: 'notFound' }
  | { status: 'error' };

export default function TripParticipantsScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [state, setState] = useState<ParticipantsState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'invalid' });
      return;
    }

    setState({ status: 'loading' });
    try {
      const response = await listTripParticipants(tripId);
      setState({ status: 'success', viewModel: buildParticipantListViewModel(response.participants) });
    } catch (error) {
      if (error instanceof MobileAuthError) {
        setFailureState(setState, participantListFailureStatus({ mobileAuthCode: error.code }));
        return;
      }
      if (error instanceof ApiError) {
        setFailureState(setState, participantListFailureStatus({ httpStatus: error.status }));
        return;
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
        <Text style={styles.screenTitle}>참여자</Text>
      </View>

      {state.status === 'loading' ? (
        <Card>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>참여자를 불러오는 중...</Text>
        </Card>
      ) : null}

      {state.status === 'success' ? <ParticipantListCard viewModel={state.viewModel} /> : null}

      {state.status === 'auth' ? (
        <Card>
          <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
          <PrimaryButton label="로그인하기" onPress={() => router.replace('/login')} />
        </Card>
      ) : null}

      {state.status === 'invalid' ? (
        <Card>
          <Text style={styles.errorTitle}>잘못된 여행 주소예요.</Text>
          <PrimaryButton label="홈으로" onPress={() => router.replace('/')} />
        </Card>
      ) : null}

      {state.status === 'notFound' ? (
        <Card>
          <Text style={styles.errorTitle}>여행을 찾을 수 없어요.</Text>
          <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행이에요.</Text>
          <PrimaryButton label="홈으로" onPress={() => router.replace('/')} />
        </Card>
      ) : null}

      {state.status === 'error' ? (
        <Card>
          <Text style={styles.errorTitle}>참여자 목록을 불러올 수 없어요.</Text>
          <Text style={styles.message}>잠시 후 다시 시도해주세요.</Text>
          <PrimaryButton label="다시 시도" onPress={() => void load()} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

function setFailureState(setState: (state: ParticipantsState) => void, status: ParticipantListFailureStatus) {
  setState({ status });
}

function ParticipantListCard({ viewModel }: { viewModel: ParticipantListViewModel }) {
  return (
    <Card>
      <View style={styles.participantList}>
        {viewModel.rows.map((participant) => (
          <View key={participant.participantId} style={styles.participantRow}>
            <Text style={styles.participantName}>{participant.displayName}</Text>
            <View style={participant.role === 'owner' ? styles.ownerBadge : styles.memberBadge}>
              <Text style={participant.role === 'owner' ? styles.ownerBadgeText : styles.memberBadgeText}>{participant.roleLabel}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
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
  participantList: {
    gap: theme.space[3],
  },
  participantRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  participantName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  ownerBadge: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  memberBadge: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  ownerBadgeText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  memberBadgeText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
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
});
