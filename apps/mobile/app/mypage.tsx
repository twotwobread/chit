import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileCard, SettingRow, SettingsList } from '../lib/account-ui/AccountRows';
import { EmptyState, ErrorState, ScreenBackground, SkeletonCard } from '../lib/design';
import { BottomMenu } from '../lib/navigation/BottomMenu';
import { getRootScreenContentTopPadding } from '../lib/navigation/root-screen-layout';
import {
  AppInfoLegalRows,
  displayName,
  MySettlementSummarySection,
  MyTripsSection,
  providerForProfile,
  providerSummary,
} from '../lib/trip-ui/MyPageParts';
import { styles } from '../lib/trip-ui/MyPageStyles';
import { useMyPageController } from '../lib/trip-ui/useMyPageController';

export default function MyPageScreen() {
  const insets = useSafeAreaInsets();
  const {
    isLoggingOut,
    legalLinkState,
    load,
    loadSettlementSummary,
    loadTrips,
    logout,
    openLegalLinkRow,
    settlementSummaryState,
    state,
    tripState,
  } = useMyPageController();

  return (
    <ScreenBackground style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: getRootScreenContentTopPadding(insets.top) }]}
        style={styles.scroll}
      >
        <View style={styles.header}>
          <Text style={styles.title}>마이페이지</Text>
          <Text style={styles.subtitle}>내 정보와 여행을 한곳에서 확인해요.</Text>
        </View>

        {state.status === 'loading' ? <SkeletonCard title="마이페이지를 불러오는 중..." /> : null}

        {state.status === 'needsLogin' ? (
          <EmptyState
            action={{ label: '로그인하기', onPress: () => router.replace('/login'), variant: 'primary' }}
            body={state.message ?? '로그인이 필요합니다.'}
            title="마이페이지를 보려면 로그인해주세요."
          />
        ) : null}

        {state.status === 'error' ? (
          <ErrorState
            action={{ label: '다시 시도', onPress: load }}
            body="다시 시도해주세요."
            title="마이페이지를 불러올 수 없어요."
          />
        ) : null}

        {state.status === 'ready' ? (
          <>
            <ProfileCard
              helperLabel={state.me.user.email}
              name={displayName(state.me.user.displayName)}
              provider={providerForProfile(state.me.linkedProviders)}
              providerLabel={providerSummary(state.me.linkedProviders)}
            />

            <MySettlementSummarySection state={settlementSummaryState} onRetry={loadSettlementSummary} />

            <MyTripsSection state={tripState} onRetry={loadTrips} />

            <SettingsList title="설정">
              <SettingRow first label="알림" onPress={() => router.push('/notifications')} />
              <SettingRow label="계정 관리" onPress={() => router.push('/account')} />
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
    </ScreenBackground>
  );
}
