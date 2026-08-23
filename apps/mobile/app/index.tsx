import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
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
import { listMeetings } from '../lib/trips/meeting-api';
import { getMySettlementSummary } from '../lib/trips/settlement-api';
import { listMyTrips } from '../lib/trips/trip-api';
import {
  buildHomeRootRefreshFailureViewModel,
  buildHomeRootRefreshStartViewModel,
  buildHomeRootViewModel,
  type HomeCurrentTripViewModel,
  type HomeRootViewModel,
  type HomeSavedMeetingViewModel,
  type HomeSettlementTaskViewModel,
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

      const [tripsResponse, meetingsResponse, settlementSummary] = await Promise.all([
        listMyTrips(),
        listMeetings(),
        getMySettlementSummary(),
      ]);
      const nextState = buildHomeRootViewModel({
        explicitHomeIntent,
        meetings: meetingsResponse.meetings,
        settlementSummary,
        status: 'ready',
        trips: tripsResponse.trips,
      });
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
          <Text style={styles.subtitle}>기록은 정확하게, 기억은 다정하게.</Text>
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
        action={{ label: '약속 만들기', onPress: () => router.push('/events/new'), variant: 'primary' }}
        body="약속이나 여행 일정을 만들면 장부와 정산까지 함께 이어져요."
        title="아직 일정이나 모임이 없어요."
      />
    );
  }

  const upcomingSections = viewModel.sections.filter((section) => section.status === 'upcoming');
  const pastSections = viewModel.sections.filter((section) => section.status === 'past');

  return (
    <View style={styles.homeBody}>
      <HomeSection title="다가오는 일정">
        {viewModel.ongoingTrips.length > 0 ? <OngoingTripCarousel trips={viewModel.ongoingTrips} /> : null}
        <TripSections sections={upcomingSections} showTitles={false} />
        {!viewModel.hasVisibleTrips ? (
          <HomeInfoCard body="새 일정을 만들거나 초대를 받으면 여기에 보여요." title="다가오는 일정이 없어요." />
        ) : null}
      </HomeSection>

      <SettlementTasksSection tasks={viewModel.settlementTasks} />
      <SavedMeetingsSection meetings={viewModel.savedMeetings} />

      {pastSections.length > 0 ? (
        <HomeSection title="지난 일정">
          <TripSections sections={pastSections} showTitles={false} />
        </HomeSection>
      ) : null}

      <SecondaryButton label="약속 만들기" onPress={() => router.push('/events/new')} />
      <SecondaryButton label="여행 일정 만들기" onPress={() => router.push('/trips/new')} />
    </View>
  );
}

function HomeSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.homeSection}>
      <Text style={styles.tripSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function HomeInfoCard({ body, title }: { body: string; title: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

function SettlementTasksSection({ tasks }: { tasks: HomeSettlementTaskViewModel[] }) {
  return (
    <HomeSection title="정산할 일">
      {tasks.length === 0 ? (
        <HomeInfoCard body="보내거나 받을 금액이 있는 일정이 생기면 알려드릴게요." title="정산할 일이 없어요." />
      ) : (
        <View style={styles.tripList}>
          {tasks.map((task, index) => (
            <Pressable
              accessibilityRole="button"
              key={task.tripId}
              onPress={() => router.push(task.route)}
              style={({ pressed }) => [
                styles.settlementRow,
                index === 0 ? null : styles.rowDivider,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.rowBody}>
                <Text numberOfLines={2} style={styles.rowTitle}>
                  {task.tripName}
                </Text>
                <Text style={styles.rowMeta}>{task.dateRangeLabel}</Text>
                <View style={styles.rowMetaWrap}>
                  {task.summaryLabels.map((label) => (
                    <Text key={label} style={styles.rowMetaLabel}>
                      {label}
                    </Text>
                  ))}
                </View>
              </View>
              <Text style={styles.rowAction}>정산 보기</Text>
            </Pressable>
          ))}
        </View>
      )}
    </HomeSection>
  );
}

function SavedMeetingsSection({ meetings }: { meetings: HomeSavedMeetingViewModel[] }) {
  return (
    <HomeSection title="내 모임">
      {meetings.length === 0 ? (
        <HomeInfoCard body="이번만 함께한 일정은 모임 목록에 저장하지 않아요." title="저장된 모임이 없어요." />
      ) : (
        <View style={styles.tripList}>
          {meetings.map((meeting, index) => (
            <Pressable
              accessibilityRole="button"
              key={meeting.id}
              onPress={() => router.push(`/meetings/${meeting.id}`)}
              style={({ pressed }) => [
                styles.meetingRow,
                index === 0 ? null : styles.rowDivider,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.meetingAvatar}>
                <Text style={styles.meetingAvatarText}>{meeting.name.trim().slice(0, 1) || '모'}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text numberOfLines={2} style={styles.rowTitle}>
                  {meeting.name}
                </Text>
                <Text style={styles.rowMeta}>{[meeting.memberCountLabel, meeting.roleLabel].join(' · ')}</Text>
              </View>
              <Text style={styles.rowAction}>열기</Text>
            </Pressable>
          ))}
        </View>
      )}
    </HomeSection>
  );
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
        <Text style={styles.tripSectionTitle}>오늘 이어갈 일정{hasMultipleTrips ? ` ${trips.length}개` : ''}</Text>
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
      dayLabel="진행 중인 일정"
      metaLabels={trip.metaLabels}
      name={trip.name}
      onPress={() => router.push(trip.resumePath)}
    />
  );
}

function TripSections({
  sections,
  showTitles = true,
}: {
  sections: HomeTripStatusSectionViewModel[];
  showTitles?: boolean;
}) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <View style={styles.tripSections}>
      {sections.map((section) => (
        <View key={section.title} style={styles.tripSection}>
          {showTitles ? <Text style={styles.tripSectionTitle}>{section.title}</Text> : null}
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
  homeSection: {
    gap: theme.space[3],
    width: '100%',
  },
  infoBody: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: 19,
  },
  infoCard: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[1],
    padding: theme.space[4],
  },
  infoTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  meetingAvatar: {
    alignItems: 'center',
    backgroundColor: theme.color.uiAccentSoft,
    borderRadius: theme.radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  meetingAvatarText: {
    color: theme.color.uiAccent,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  meetingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
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
  pressed: {
    opacity: 0.82,
  },
  ongoingHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowAction: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  rowBody: {
    flex: 1,
    gap: theme.space[1],
  },
  rowDivider: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
  },
  rowMeta: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  rowMetaLabel: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    overflow: 'hidden',
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
  },
  rowMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[1],
  },
  rowTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  screen: {
    flex: 1,
  },
  settlementRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
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
