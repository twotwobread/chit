import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import type { AuthMeResponse, AuthProvider, TripListItem } from '@i-um/api-contract';

import {
  buildAppInfoLegalRows,
  initialLegalLinkOpenState,
  openLegalLink,
  type AppInfoLegalRow,
  type LegalLinkId,
  type LegalLinkOpenState,
} from '../lib/app-info/legal';
import { getCurrentUserWithRefresh, logoutCurrentSession, MobileAuthError } from '../lib/auth/client';
import { clearStoredSession, readStoredSession } from '../lib/auth/session';
import { theme } from '../lib/design';
import { BottomMenu } from '../lib/navigation/BottomMenu';
import { listMyTrips } from '../lib/trips/client';
import { buildMyTripsSuccessViewModel, tripDetailPath } from '../lib/trips/mypage';

type MyPageState =
  | { status: 'loading' }
  | { status: 'ready'; me: AuthMeResponse }
  | { status: 'needsLogin'; message?: string }
  | { status: 'error' };

type TripListState =
  | { status: 'loading' }
  | { status: 'ready'; trips: TripListItem[] }
  | { status: 'error' };

export default function MyPageScreen() {
  const [state, setState] = useState<MyPageState>({ status: 'loading' });
  const [tripState, setTripState] = useState<TripListState>({ status: 'loading' });
  const [legalLinkState, setLegalLinkState] = useState<LegalLinkOpenState>(initialLegalLinkOpenState);
  const legalLinkStateRef = useRef<LegalLinkOpenState>(initialLegalLinkOpenState);

  const updateLegalLinkState = useCallback((nextState: LegalLinkOpenState) => {
    legalLinkStateRef.current = nextState;
    setLegalLinkState(nextState);
  }, []);

  const handleAuthError = useCallback(async (error: unknown) => {
    if (
      error instanceof MobileAuthError &&
      (error.code === 'INVALID_REFRESH_TOKEN' || error.code === 'UNAUTHORIZED')
    ) {
      await clearStoredSession();
      setState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
      return true;
    }
    return false;
  }, []);

  const loadTrips = useCallback(async () => {
    setTripState({ status: 'loading' });

    try {
      const response = await listMyTrips();
      setTripState({ status: 'ready', trips: response.trips });
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      setTripState({ status: 'error' });
    }
  }, [handleAuthError]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setTripState({ status: 'loading' });
    updateLegalLinkState(initialLegalLinkOpenState);

    try {
      const stored = await readStoredSession();
      if (stored.status === 'missing') {
        setState({ status: 'needsLogin' });
        return;
      }
      if (stored.status === 'corrupt') {
        setState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
        return;
      }

      const me = await getCurrentUserWithRefresh();
      setState({ status: 'ready', me });
      void loadTrips();
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      setState({ status: 'error' });
    }
  }, [handleAuthError, loadTrips, updateLegalLinkState]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openLegalLinkRow = useCallback(
    (id: LegalLinkId) => {
      void openLegalLink({
        id,
        getState: () => legalLinkStateRef.current,
        setState: updateLegalLinkState,
        opener: (url) => Linking.openURL(url),
      });
    },
    [updateLegalLinkState],
  );

  const logout = async () => {
    await logoutCurrentSession();
    router.replace('/login');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>마이페이지</Text>
          <Text style={styles.subtitle}>내 정보와 여행을 한곳에서 확인해요.</Text>
        </View>

        {state.status === 'loading' ? (
          <View style={styles.card}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>마이페이지를 불러오는 중...</Text>
          </View>
        ) : null}

        {state.status === 'needsLogin' ? (
          <View style={styles.card}>
            <Text style={styles.message}>{state.message ?? '로그인이 필요합니다.'}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
              <Text style={styles.buttonText}>로그인하기</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>마이페이지를 불러올 수 없어요.</Text>
            <Text style={styles.message}>다시 시도해주세요.</Text>
            <Pressable accessibilityRole="button" onPress={load} style={styles.button}>
              <Text style={styles.buttonText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'ready' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>내 프로필</Text>
              <Text style={styles.profileName}>{displayName(state.me.user.displayName)}</Text>
              {state.me.user.email ? <Text style={styles.message}>{state.me.user.email}</Text> : null}
              <Text style={styles.metaLabel}>연결된 로그인</Text>
              <Text style={styles.message}>{providerSummary(state.me.linkedProviders)}</Text>
            </View>

            <MyTripsSection state={tripState} onRetry={loadTrips} />

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>설정</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>계정 관리</Text>
              </Pressable>
              <AppInfoLegalGroup state={legalLinkState} onOpen={openLegalLinkRow} />
              <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.dangerButton}>
                <Text style={styles.buttonText}>로그아웃</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      {state.status === 'ready' ? <BottomMenu selected="my" /> : null}
    </View>
  );
}

function AppInfoLegalGroup({ state, onOpen }: { state: LegalLinkOpenState; onOpen: (id: LegalLinkId) => void }) {
  return (
    <View style={styles.legalGroup}>
      {buildAppInfoLegalRows().map((row) => (
        <AppInfoLegalRow key={row.id} row={row} state={state} onOpen={onOpen} />
      ))}
      {state.errorMessage ? <Text style={styles.legalError}>{state.errorMessage}</Text> : null}
    </View>
  );
}

function AppInfoLegalRow({
  row,
  state,
  onOpen,
}: {
  row: AppInfoLegalRow;
  state: LegalLinkOpenState;
  onOpen: (id: LegalLinkId) => void;
}) {
  if (!row.tappable) {
    return (
      <View style={styles.settingsRow}>
        <Text style={styles.settingsRowLabel}>{row.label}</Text>
        <Text style={styles.settingsRowValue}>{row.value}</Text>
      </View>
    );
  }

  const disabled = state.openingId === row.id;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onOpen(row.id)}
      style={({ pressed }) => [
        styles.settingsRow,
        pressed ? styles.settingsRowPressed : null,
        disabled ? styles.settingsRowDisabled : null,
      ]}
    >
      <Text style={styles.settingsRowLabel}>{row.label}</Text>
      <Text style={styles.settingsLinkText}>{row.affordance}</Text>
    </Pressable>
  );
}

function MyTripsSection({ state, onRetry }: { state: TripListState; onRetry: () => void }) {
  const viewModel = state.status === 'ready' && state.trips.length > 0 ? buildMyTripsSuccessViewModel(state.trips) : null;
  const currentTrip = viewModel?.currentTrip ?? null;
  const groupedTrips = viewModel?.sections ?? [];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>내 여행</Text>

      {state.status === 'loading' ? (
        <View style={styles.inlineState}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>내 여행을 불러오는 중...</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.inlineState}>
          <Text style={styles.errorMessage}>내 여행을 불러올 수 없어요.</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'ready' && state.trips.length === 0 ? (
        <View style={styles.inlineState}>
          <Text style={styles.emptyTitle}>아직 여행이 없어요.</Text>
          <Text style={styles.message}>새 여행을 만들고 여정을 이어가요.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/trips/new')} style={styles.button}>
            <Text style={styles.buttonText}>새 여행 만들기</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'ready' && state.trips.length > 0 ? (
        <>
          {currentTrip ? (
            <Pressable
              accessibilityLabel={`${currentTrip.name} 여행 바로가기`}
              accessibilityRole="button"
              onPress={() => router.push(tripDetailPath(currentTrip.id))}
              style={[styles.tripRow, styles.currentTripShortcut]}
            >
              <Text style={styles.currentTripLabel}>현재 진행 중인 여행</Text>
              <Text style={styles.tripName}>{currentTrip.name}</Text>
              <Text style={styles.tripDate}>{formatDateRange(currentTrip.startDate, currentTrip.endDate)}</Text>
              <Text style={styles.tripCurrency}>기본 통화 {currentTrip.defaultCurrency}</Text>
              <View style={styles.tripMetaRow}>
                <Text style={styles.metaLabel}>{currentTrip.roleLabel}</Text>
                <Text style={styles.metaLabel}>{currentTrip.participantCountLabel}</Text>
              </View>
              <View style={styles.currentTripCta}>
                <Text style={styles.secondaryButtonText}>여행 바로가기</Text>
              </View>
            </Pressable>
          ) : null}

          <View style={styles.tripSections}>
            {groupedTrips.map((section) => (
              <View key={section.title} style={styles.tripSection}>
                <Text style={styles.tripSectionTitle}>{section.title}</Text>
                <View style={styles.tripList}>
                  {section.trips.map((trip) => (
                    <Pressable
                      accessibilityRole="button"
                      key={trip.id}
                      onPress={() => router.push(tripDetailPath(trip.id))}
                      style={styles.tripRow}
                    >
                      <Text style={styles.tripName}>{trip.name}</Text>
                      <Text style={styles.tripDate}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
                      <Text style={styles.tripCurrency}>기본 통화 {trip.defaultCurrency}</Text>
                      <View style={styles.tripMetaRow}>
                        <Text style={styles.metaLabel}>{trip.roleLabel}</Text>
                        <Text style={styles.metaLabel}>{trip.participantCountLabel}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/trips/new')} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>새 여행 만들기</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function displayName(value: string): string {
  return value.trim() || '이름을 불러올 수 없어요.';
}

function providerSummary(providers: AuthProvider[]): string {
  if (providers.length === 0) {
    return '연결된 로그인 없음';
  }
  return providers.map(providerLabel).join(', ');
}

function providerLabel(provider: AuthProvider): string {
  return provider === 'apple' ? 'Apple' : 'Kakao';
}

function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
}

function formatDate(value: string): string {
  return value.split('-').join('.');
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
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  profileName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  inlineState: {
    gap: theme.layout.gapCard,
  },
  legalGroup: {
    borderBottomColor: theme.color.borderSubtle,
    borderBottomWidth: 1,
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
    gap: theme.space[2],
    paddingVertical: theme.space[2],
  },
  settingsRow: {
    alignItems: 'center',
    borderRadius: theme.radius.sm,
    flexDirection: 'row',
    gap: theme.space[4],
    justifyContent: 'space-between',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[3],
  },
  settingsRowPressed: {
    backgroundColor: theme.color.surfaceSunken,
  },
  settingsRowDisabled: {
    opacity: 0.5,
  },
  settingsRowLabel: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
  },
  settingsRowValue: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  settingsLinkText: {
    color: theme.color.textLink,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  legalError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  tripSections: {
    gap: theme.space[5],
  },
  tripSection: {
    gap: theme.space[3],
  },
  tripSectionTitle: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  tripList: {
    gap: theme.space[3],
  },
  tripRow: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  currentTripShortcut: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderDefault,
  },
  tripName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  currentTripLabel: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  tripDate: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
  },
  tripCurrency: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
  },
  tripMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  metaLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
  },
  errorMessage: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
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
  dangerButton: {
    alignItems: 'center',
    backgroundColor: theme.color.danger,
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
  currentTripCta: {
    alignItems: 'center',
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
});
