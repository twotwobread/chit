import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../lib/auth/client';
import { clearStoredSession, readStoredSession } from '../lib/auth/session';
import {
  BrandStamp,
  EmptyState,
  ErrorState,
  ScreenBackground,
  SecondaryButton,
  SkeletonCard,
  theme,
} from '../lib/design';
import { ActiveTripCard, PastTripRow, UpcomingTripRow } from '../lib/home-ui/TripCards';
import { BottomMenu } from '../lib/navigation/BottomMenu';
import { getRootScreenContentTopPadding } from '../lib/navigation/root-screen-layout';
import { registerDeviceForPushNotifications } from '../lib/notifications/runtime';
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
  const insets = useSafeAreaInsets();
  const explicitHomeVisitRef = useRef(false);
  const pushRegistrationAttemptedRef = useRef(false);
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
        pushRegistrationAttemptedRef.current = false;
        setState(buildHomeRootViewModel({ status: 'needsLogin' }));
        return;
      }
      if (stored.status === 'corrupt') {
        explicitHomeVisitRef.current = false;
        pushRegistrationAttemptedRef.current = false;
        setState(buildHomeRootViewModel({ message: '다시 로그인해주세요.', status: 'needsLogin' }));
        return;
      }

      if (!pushRegistrationAttemptedRef.current) {
        pushRegistrationAttemptedRef.current = true;
        void registerDeviceForPushNotifications();
      }

      const response = await listMyTrips();
      const nextState = buildHomeRootViewModel({ explicitHomeIntent, status: 'ready', trips: response.trips });
      setState(nextState);
    } catch (error) {
      if (await handleAuthError(error)) {
        explicitHomeVisitRef.current = false;
        pushRegistrationAttemptedRef.current = false;
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
    <ScreenBackground style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: getRootScreenContentTopPadding(insets.top) }]}
        style={styles.scroll}
      >
        <HomeScreenContent state={state} onRetry={load} />
      </ScrollView>

      {state.showBottomMenu ? <BottomMenu selected="home" /> : null}
    </ScreenBackground>
  );
}

function HomeScreenContent({ onRetry, state }: { onRetry: () => void; state: HomeRootViewModel }) {
  if (state.status === 'loading') {
    return (
      <>
        {state.surface === 'home' ? <HomeHeader /> : null}
        <SkeletonCard title={state.title} body={state.helper} />
      </>
    );
  }

  if (state.status === 'needsLogin') {
    return (
      <EmptyState
        action={{ label: '로그인하기', onPress: () => router.replace(state.loginPath), variant: 'primary' }}
        body={state.helper}
        title={state.title}
      />
    );
  }

  if (state.status === 'rootError' || state.status === 'homeError') {
    return (
      <>
        {state.status === 'homeError' ? <HomeHeader /> : null}
        <ErrorState action={{ label: state.retryLabel, onPress: onRetry }} body={state.helper} title={state.title} />
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
      <View style={styles.headerTop}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>홈</Text>
          <Text style={styles.subtitle}>내 여행을 확인하고 관리해요.</Text>
        </View>
        <BrandStamp decorative size="sm" />
      </View>
    </View>
  );
}

function HomeContent({ viewModel }: { viewModel: HomeViewModel }) {
  if (viewModel.isEmpty) {
    return (
      <EmptyState
        action={{ label: '새 여행 만들기', onPress: () => router.push('/trips/new'), variant: 'primary' }}
        body="새 여행을 만들고 여정을 이어가요."
        title="아직 여행이 없어요."
      />
    );
  }

  return (
    <View style={styles.homeBody}>
      {viewModel.ongoingTrips.length > 0 ? <OngoingTripCarousel trips={viewModel.ongoingTrips} /> : null}
      <TripSections sections={viewModel.sections} />
      {!viewModel.hasVisibleTrips ? <HomeHistoryOnlyCard /> : null}
      <SecondaryButton label="새 여행 만들기" onPress={() => router.push('/trips/new')} />
    </View>
  );
}

function HomeHistoryOnlyCard() {
  return <EmptyState body="지난 여행은 마이페이지에서 볼 수 있어요." title="진행 중이거나 예정된 여행이 없어요." />;
}

function OngoingTripCarousel({ trips }: { trips: HomeCurrentTripViewModel[] }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pagerWidth, setPagerWidth] = useState(0);
  const hasMultipleTrips = trips.length > 1;
  const safePageIndex = Math.min(pageIndex, trips.length - 1);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pagerWidth <= 0) {
        return;
      }
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pagerWidth);
      setPageIndex(Math.max(0, Math.min(nextIndex, trips.length - 1)));
    },
    [pagerWidth, trips.length],
  );

  return (
    <View style={styles.ongoingCarousel}>
      <View style={styles.ongoingHeader}>
        <Text style={styles.tripSectionTitle}>진행 중인 여행{hasMultipleTrips ? ` ${trips.length}개` : ''}</Text>
        {hasMultipleTrips ? (
          <Text style={styles.carouselCounter}>
            {safePageIndex + 1}/{trips.length}
          </Text>
        ) : null}
      </View>
      <ScrollView
        horizontal
        onLayout={(event) => setPagerWidth(event.nativeEvent.layout.width)}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        pagingEnabled={hasMultipleTrips}
        scrollEnabled={hasMultipleTrips}
        showsHorizontalScrollIndicator={false}
        style={styles.carouselViewport}
      >
        {trips.map((trip) => (
          <View key={trip.id} style={[styles.carouselPage, pagerWidth > 0 ? { width: pagerWidth } : null]}>
            <CurrentTripCard trip={trip} />
          </View>
        ))}
      </ScrollView>
      {hasMultipleTrips ? (
        <View style={styles.carouselDots}>
          {trips.map((trip, index) => (
            <View
              key={trip.id}
              style={[styles.carouselDot, index === safePageIndex ? styles.carouselDotActive : null]}
            />
          ))}
        </View>
      ) : null}
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
  carouselCounter: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  carouselDot: {
    backgroundColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    height: 7,
    width: 7,
  },
  carouselDotActive: {
    backgroundColor: theme.color.uiAccent,
    width: 18,
  },
  carouselDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'center',
  },
  carouselPage: {
    width: '100%',
  },
  carouselViewport: {
    width: '100%',
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
  headerCopy: {
    flex: 1,
    gap: theme.space[2],
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[4],
    justifyContent: 'space-between',
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
  ongoingCarousel: {
    gap: theme.space[3],
    width: '100%',
  },
  ongoingHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  screen: {
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
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.regular,
  },
  title: {
    color: theme.color.textOnShell,
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
    color: theme.color.textOnShell,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  tripSections: {
    gap: theme.space[5],
  },
});
