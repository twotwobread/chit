import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import type { AuthMeResponse, AuthProvider, TripListItem } from '@i-um/api-contract';

import {
  buildAppInfoLegalRows,
  initialLegalLinkOpenState,
  openLegalLink,
  type AppInfoLegalRow as AppInfoLegalRowViewModel,
  type LegalLinkId,
  type LegalLinkOpenState,
} from '../lib/app-info/legal';
import { ProfileCard, SettingRow, SettingsList, StatRow, type AccountProvider } from '../lib/account-ui/AccountRows';
import { getMeWithRefresh, logoutCurrentSession, MobileAuthError } from '../lib/auth/client';
import { createLogoutFlow, type LogoutFlow } from '../lib/auth/logout-flow';
import { clearStoredSession, readStoredSession } from '../lib/auth/session';
import { theme } from '../lib/design';
import { ActiveTripCard, PastTripRow, UpcomingTripRow } from '../lib/home-ui/TripCards';
import { BottomMenu } from '../lib/navigation/BottomMenu';
import { listMyTrips } from '../lib/trips/client';
import {
  buildMyTripsSuccessViewModel,
  tripDetailPath,
  type MyTripCardViewModel,
  type MyTripsStatusSectionViewModel,
} from '../lib/trips/mypage';
import { tripTodayPath } from '../lib/trips/routes';

type MyPageState =
  | { status: 'loading' }
  | { status: 'ready'; me: AuthMeResponse }
  | { status: 'needsLogin'; message?: string }
  | { status: 'error' };

type TripListState = { status: 'loading' } | { status: 'ready'; trips: TripListItem[] } | { status: 'error' };

export default function MyPageScreen() {
  const [state, setState] = useState<MyPageState>({ status: 'loading' });
  const [tripState, setTripState] = useState<TripListState>({ status: 'loading' });
  const [legalLinkState, setLegalLinkState] = useState<LegalLinkOpenState>(initialLegalLinkOpenState);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const legalLinkStateRef = useRef<LegalLinkOpenState>(initialLegalLinkOpenState);
  const logoutFlowRef = useRef<LogoutFlow | null>(null);

  if (logoutFlowRef.current === null) {
    logoutFlowRef.current = createLogoutFlow({
      logoutCurrentSession,
      replace: (path) => router.replace(path),
    });
  }

  const updateLegalLinkState = useCallback((nextState: LegalLinkOpenState) => {
    legalLinkStateRef.current = nextState;
    setLegalLinkState(nextState);
  }, []);

  const handleAuthError = useCallback(async (error: unknown) => {
    if (error instanceof MobileAuthError && (error.code === 'INVALID_REFRESH_TOKEN' || error.code === 'UNAUTHORIZED')) {
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

      const me = await getMeWithRefresh();
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
    const logoutFlow = logoutFlowRef.current;
    if (!logoutFlow || logoutFlow.isLoggingOut()) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logoutFlow.run();
    } finally {
      setIsLoggingOut(false);
    }
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
            <ProfileCard
              helperLabel={state.me.user.email}
              name={displayName(state.me.user.displayName)}
              provider={providerForProfile(state.me.linkedProviders)}
              providerLabel={providerSummary(state.me.linkedProviders)}
            />

            <MyTripsSection state={tripState} onRetry={loadTrips} />

            <SettingsList title="설정">
              <SettingRow first label="계정 관리" onPress={() => router.push('/account')} />
              <AppInfoLegalRows state={legalLinkState} onOpen={openLegalLinkRow} />
              <SettingRow
                danger
                disabled={isLoggingOut}
                label={isLoggingOut ? '로그아웃 중...' : '로그아웃'}
                onPress={() => void logout()}
              />
            </SettingsList>
          </>
        ) : null}
      </ScrollView>

      {state.status === 'ready' ? <BottomMenu selected="my" /> : null}
    </View>
  );
}

function AppInfoLegalRows({ state, onOpen }: { state: LegalLinkOpenState; onOpen: (id: LegalLinkId) => void }) {
  const rows = buildAppInfoLegalRows();

  return (
    <>
      {rows.map((row) => (
        <AppInfoLegalRow key={row.id} first={false} row={row} state={state} onOpen={onOpen} />
      ))}
      {state.errorMessage ? <Text style={styles.legalError}>{state.errorMessage}</Text> : null}
    </>
  );
}

function AppInfoLegalRow({
  first,
  row,
  state,
  onOpen,
}: {
  first: boolean;
  row: AppInfoLegalRowViewModel;
  state: LegalLinkOpenState;
  onOpen: (id: LegalLinkId) => void;
}) {
  if (!row.tappable) {
    return <SettingRow first={first} label={row.label} value={row.value} />;
  }

  const disabled = state.openingId === row.id;

  return (
    <SettingRow
      affordance={row.affordance}
      disabled={disabled}
      first={first}
      label={row.label}
      onPress={() => onOpen(row.id)}
    />
  );
}

function MyTripsSection({ state, onRetry }: { state: TripListState; onRetry: () => void }) {
  const viewModel =
    state.status === 'ready' && state.trips.length > 0 ? buildMyTripsSuccessViewModel(state.trips) : null;
  const currentTrip = viewModel?.currentTrip ?? null;
  const groupedTrips = viewModel?.sections ?? [];

  return (
    <View style={styles.sectionStack}>
      <Text style={styles.sectionTitle}>내 여행</Text>

      {state.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>내 여행을 불러오는 중...</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorMessage}>내 여행을 불러올 수 없어요.</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'ready' && state.trips.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>아직 여행이 없어요.</Text>
          <Text style={styles.message}>새 여행을 만들고 여정을 이어가요.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/trips/new')} style={styles.button}>
            <Text style={styles.buttonText}>새 여행 만들기</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'ready' && state.trips.length > 0 && viewModel ? (
        <>
          <StatRow
            stats={[
              { label: '전체 여행', value: state.trips.length },
              { label: '그룹', value: groupedTrips.length },
            ]}
          />
          {currentTrip ? <MyCurrentTripCard trip={currentTrip} /> : null}
          <TripSections sections={groupedTrips} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/trips/new')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>새 여행 만들기</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function MyCurrentTripCard({ trip }: { trip: MyTripCardViewModel }) {
  return (
    <ActiveTripCard
      ctaLabel="여행 바로가기"
      currencyLabel={trip.currencyLabel}
      dateLabel={trip.dateRangeLabel}
      dayLabel="현재 진행 중인 여행"
      metaLabels={trip.metaLabels}
      name={trip.name}
      onPress={() => router.push(tripTodayPath(trip.id))}
    />
  );
}

function TripSections({ sections }: { sections: MyTripsStatusSectionViewModel[] }) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <View style={styles.tripSections}>
      {sections.map((section) => (
        <View key={section.title} style={styles.tripSection}>
          <Text style={styles.tripSectionTitle}>{section.title}</Text>
          <View style={styles.tripList}>
            {section.trips.map((trip, index) => (
              <TripRow key={trip.id} first={index === 0} section={section} trip={trip} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function TripRow({
  first,
  section,
  trip,
}: {
  first: boolean;
  section: MyTripsStatusSectionViewModel;
  trip: MyTripCardViewModel;
}) {
  const onPress = () => router.push(tripDetailPath(trip.id));

  if (section.status === 'past') {
    return (
      <PastTripRow
        currencyLabel={trip.currencyLabel}
        dateLabel={trip.dateRangeLabel}
        first={first}
        metaLabels={trip.metaLabels}
        name={trip.name}
        onPress={onPress}
      />
    );
  }

  return (
    <UpcomingTripRow
      currencyLabel={trip.currencyLabel}
      dateLabel={trip.dateRangeLabel}
      metaLabels={trip.metaLabels}
      name={trip.name}
      onPress={onPress}
      statusLabel={section.status === 'ongoing' ? '진행 중' : undefined}
      statusTone={section.status === 'ongoing' ? 'success' : 'amber'}
    />
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

function providerForProfile(providers: AuthProvider[]): AccountProvider {
  return providers.includes('apple') ? 'apple' : 'kakao';
}

const styles = StyleSheet.create({
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
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    maxWidth: theme.layout.cardMaxW,
    padding: theme.space[7],
    width: '100%',
    ...theme.shadow.sm,
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: theme.space[4],
    padding: theme.space[7],
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
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
  header: {
    gap: theme.space[3],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  legalError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    padding: theme.space[4],
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
  },
  screen: {
    backgroundColor: theme.color.bg,
    flex: 1,
  },
  scroll: {
    flex: 1,
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
  sectionStack: {
    gap: theme.space[4],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
  },
  tripList: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
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
  tripSections: {
    gap: theme.space[5],
  },
});
