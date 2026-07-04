import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../lib/auth/client';
import { clearStoredSession, readStoredSession } from '../lib/auth/session';
import { Card, PrimaryButton, SecondaryButton, theme } from '../lib/design';
import { ActiveTripCard, PastTripRow, UpcomingTripRow } from '../lib/home-ui/TripCards';
import { BottomMenu } from '../lib/navigation/BottomMenu';
import { listMyTrips } from '../lib/trips/trip-api';
import {
  buildHomeRootRefreshFailureViewModel,
  buildHomeRootRefreshStartViewModel,
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
    setState((current) => buildHomeRootRefreshStartViewModel(current, explicitHomeIntent));

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
      setState(nextState);
    } catch (error) {
      if (await handleAuthError(error)) {
        explicitHomeVisitRef.current = false;
        setState(buildHomeRootViewModel({ message: '다시 로그인해주세요.', status: 'needsLogin' }));
        return;
      }
      setState((current) => buildHomeRootRefreshFailureViewModel(current, explicitHomeIntent));
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

  return null;
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
    <ActiveTripCard
      ctaLabel={trip.resumeLabel}
      currencyLabel={trip.currencyLabel}
      dateLabel={trip.dateRangeLabel}
      dayLabel="진행 중인 여행"
      metaLabels={trip.metaLabels}
      name={trip.name}
      onPress={() => router.push(trip.resumePath)}
    />
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
  section: HomeTripStatusSectionViewModel;
  trip: HomeTripCardViewModel;
}) {
  const onPress = () => router.push(trip.detailPath);

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

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: theme.space[4],
    padding: theme.space[7],
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  header: {
    gap: theme.space[3],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  homeBody: {
    gap: theme.space[4],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  screen: {
    backgroundColor: theme.color.bg,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  stateTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
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
