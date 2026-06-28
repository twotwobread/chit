import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../lib/auth/client';
import { clearStoredSession, readStoredSession } from '../lib/auth/session';
import { Card, PrimaryButton, SecondaryButton, theme } from '../lib/design';
import { BottomMenu } from '../lib/navigation/BottomMenu';
import { listMyTrips } from '../lib/trips/client';
import {
  buildHomeRootViewModel,
  type HomeCurrentTripViewModel,
  type HomeRootViewModel,
  type HomeTripCardViewModel,
  type HomeTripStatusSectionViewModel,
  type HomeViewModel,
} from '../lib/trips/home';
import { consumeExplicitHomeIntent } from '../lib/trips/home-intent';

export default function HomeScreen() {
  const explicitHomeVisitRef = useRef(false);
  const [state, setState] = useState<HomeRootViewModel>(() => buildHomeRootViewModel({ status: 'loading' }));

  const resolveExplicitHomeIntent = useCallback(() => {
    if (consumeExplicitHomeIntent()) {
      explicitHomeVisitRef.current = true;
    }
    return explicitHomeVisitRef.current;
  }, []);

  const load = useCallback(async () => {
    const explicitHomeIntent = resolveExplicitHomeIntent();
    setState(buildHomeRootViewModel({ explicitHomeIntent, status: 'loading' }));

    try {
      const stored = await readStoredSession();
      if (stored.status === 'missing') {
        explicitHomeVisitRef.current = false;
        setState(buildHomeRootViewModel({ status: 'needsLogin' }));
        return;
      }
      if (stored.status === 'corrupt') {
        explicitHomeVisitRef.current = false;
        setState(buildHomeRootViewModel({ message: '다시 로그인해주세요.', status: 'needsLogin' }));
        return;
      }

      const response = await listMyTrips();
      const nextState = buildHomeRootViewModel({ explicitHomeIntent, status: 'ready', trips: response.trips });
      if (nextState.status === 'redirect') {
        router.replace(nextState.href);
        return;
      }
      setState(nextState);
    } catch (error) {
      if (await handleAuthError(error)) {
        explicitHomeVisitRef.current = false;
        setState(buildHomeRootViewModel({ message: '다시 로그인해주세요.', status: 'needsLogin' }));
        return;
      }
      setState(buildHomeRootViewModel({ explicitHomeIntent, status: 'tripListError' }));
    }
  }, [resolveExplicitHomeIntent]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        explicitHomeVisitRef.current = false;
      };
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <HomeScreenContent state={state} onRetry={load} />
      </ScrollView>

      {state.showBottomMenu ? <BottomMenu selected="home" /> : null}
    </View>
  );
}

function HomeScreenContent({ onRetry, state }: { onRetry: () => void; state: HomeRootViewModel }) {
  if (state.status === 'loading') {
    return (
      <>
        {state.surface === 'home' ? <HomeHeader /> : null}
        <Card>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.stateTitle}>{state.title}</Text>
          <Text style={styles.message}>{state.helper}</Text>
        </Card>
      </>
    );
  }

  if (state.status === 'needsLogin') {
    return (
      <Card>
        <Text style={styles.stateTitle}>{state.title}</Text>
        <Text style={styles.message}>{state.helper}</Text>
        <PrimaryButton label="로그인하기" onPress={() => router.replace(state.loginPath)} />
      </Card>
    );
  }

  if (state.status === 'rootError' || state.status === 'homeError') {
    return (
      <>
        {state.status === 'homeError' ? <HomeHeader /> : null}
        <Card>
          <Text style={styles.errorTitle}>{state.title}</Text>
          <Text style={styles.message}>{state.helper}</Text>
          <SecondaryButton label={state.retryLabel} onPress={onRetry} />
        </Card>
      </>
    );
  }

  if (state.status === 'home') {
    return (
      <>
        <HomeHeader />
        <HomeContent viewModel={state.home} />
      </>
    );
  }

  return (
    <Card>
      <ActivityIndicator color={theme.color.primary} />
      <Text style={styles.message}>여행으로 이동하는 중...</Text>
    </Card>
  );
}

function HomeHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>홈</Text>
      <Text style={styles.subtitle}>내 여행을 확인하고 관리해요.</Text>
    </View>
  );
}

function HomeContent({ viewModel }: { viewModel: HomeViewModel }) {
  if (viewModel.isEmpty) {
    return (
      <Card>
        <Text style={styles.stateTitle}>아직 여행이 없어요.</Text>
        <Text style={styles.message}>새 여행을 만들고 여정을 이어가요.</Text>
        <PrimaryButton label="새 여행 만들기" onPress={() => router.push('/trips/new')} />
      </Card>
    );
  }

  return (
    <View style={styles.homeBody}>
      {viewModel.currentTrip ? <CurrentTripCard trip={viewModel.currentTrip} /> : null}
      <TripSections sections={viewModel.sections} />
      <SecondaryButton label="새 여행 만들기" onPress={() => router.push('/trips/new')} />
    </View>
  );
}

function CurrentTripCard({ trip }: { trip: HomeCurrentTripViewModel }) {
  return (
    <Pressable
      accessibilityLabel={`${trip.name} 여행 이어가기`}
      accessibilityRole="button"
      onPress={() => router.push(trip.resumePath)}
      style={({ pressed }) => [styles.tripRow, styles.currentTripCard, pressed ? styles.pressed : null]}
    >
      <Text style={styles.currentTripLabel}>진행 중인 여행</Text>
      <Text style={styles.tripName}>{trip.name}</Text>
      <Text style={styles.tripDate}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
      <Text style={styles.tripCurrency}>기본 통화 {trip.defaultCurrency}</Text>
      <View style={styles.tripMetaRow}>
        <Text style={styles.metaLabel}>{trip.roleLabel}</Text>
        <Text style={styles.metaLabel}>{trip.participantCountLabel}</Text>
      </View>
      <View style={styles.currentTripCta}>
        <Text style={styles.currentTripCtaText}>{trip.resumeLabel}</Text>
      </View>
    </Pressable>
  );
}

function TripSections({ sections }: { sections: HomeTripStatusSectionViewModel[] }) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <View style={styles.tripSections}>
      {sections.map((section) => (
        <View key={section.title} style={styles.tripSection}>
          <Text style={styles.tripSectionTitle}>{section.title}</Text>
          <View style={styles.tripList}>
            {section.trips.map((trip) => (
              <TripRow key={trip.id} trip={trip} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function TripRow({ trip }: { trip: HomeTripCardViewModel }) {
  return (
    <Pressable
      accessibilityLabel={`${trip.name} 여행 정보 보기`}
      accessibilityRole="button"
      onPress={() => router.push(trip.detailPath)}
      style={({ pressed }) => [styles.tripRow, pressed ? styles.pressed : null]}
    >
      <Text style={styles.tripName}>{trip.name}</Text>
      <Text style={styles.tripDate}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
      <Text style={styles.tripCurrency}>기본 통화 {trip.defaultCurrency}</Text>
      <View style={styles.tripMetaRow}>
        <Text style={styles.metaLabel}>{trip.roleLabel}</Text>
        <Text style={styles.metaLabel}>{trip.participantCountLabel}</Text>
      </View>
    </Pressable>
  );
}

async function handleAuthError(error: unknown): Promise<boolean> {
  if (error instanceof MobileAuthError && (error.code === 'INVALID_REFRESH_TOKEN' || error.code === 'UNAUTHORIZED')) {
    await clearStoredSession();
    return true;
  }
  if (error instanceof ApiError && error.status === 401) {
    await clearStoredSession();
    return true;
  }
  return false;
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
  homeBody: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    gap: theme.space[4],
  },
  stateTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  errorTitle: {
    color: theme.color.danger,
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
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
    ...theme.shadow.xs,
  },
  currentTripCard: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderDefault,
  },
  currentTripLabel: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  tripName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
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
  currentTripCta: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    marginTop: theme.space[2],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  currentTripCtaText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  pressed: {
    opacity: 0.72,
  },
});
