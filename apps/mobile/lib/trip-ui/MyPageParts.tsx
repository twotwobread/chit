import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import type { AuthProvider } from '@i-um/api-contract';

import {
  buildAppInfoLegalRows,
  type AppInfoLegalRow as AppInfoLegalRowViewModel,
  type LegalLinkId,
  type LegalLinkOpenState,
} from '../app-info/legal';
import { SettingRow, StatRow, type AccountProvider } from '../account-ui/AccountRows';
import { ActiveTripCard, PastTripRow, UpcomingTripRow } from '../home-ui/TripCards';
import { theme } from '../design';
import { type SettlementSummaryState, type TripListState } from './useMyPageController';
import {
  buildMySettlementSummaryViewModel,
  buildMyTripsSuccessViewModel,
  tripDetailPath,
  type MySettlementSummaryViewModel,
  type MyTripCardViewModel,
  type MyTripsStatusSectionViewModel,
} from '../trips/mypage';
import { tripTodayPath } from '../trips/routes';
import { styles } from './MyPageStyles';

export function AppInfoLegalRows({ state, onOpen }: { state: LegalLinkOpenState; onOpen: (id: LegalLinkId) => void }) {
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

export function AppInfoLegalRow({
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

export function MySettlementSummarySection({ state, onRetry }: { state: SettlementSummaryState; onRetry: () => void }) {
  const viewModel = state.status === 'ready' ? buildMySettlementSummaryViewModel(state.summary) : null;

  return (
    <View style={styles.sectionStack}>
      <Text style={styles.sectionTitle}>정산 요약</Text>

      {state.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>정산 요약을 불러오는 중...</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorMessage}>정산 요약을 불러올 수 없어요.</Text>
          <Text style={styles.message}>잠시 후 다시 시도해주세요.</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      {viewModel?.status === 'empty' ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>{viewModel.title}</Text>
          <Text style={styles.message}>{viewModel.helper}</Text>
        </View>
      ) : null}

      {viewModel?.status === 'ready' ? <MySettlementSummaryList viewModel={viewModel} /> : null}
    </View>
  );
}

export function MySettlementSummaryList({
  viewModel,
}: {
  viewModel: Extract<MySettlementSummaryViewModel, { status: 'ready' }>;
}) {
  return (
    <View style={styles.settlementStack}>
      <View style={styles.card}>
        <Text style={styles.settlementSummaryTitle}>{viewModel.title}</Text>
        <Text style={styles.message}>{viewModel.helper}</Text>
      </View>
      <View style={styles.settlementList}>
        {viewModel.trips.map((trip) => (
          <Pressable
            accessibilityRole="button"
            key={trip.tripId}
            onPress={() => router.push(trip.route as Href)}
            style={styles.settlementRow}
          >
            <View style={styles.settlementRowHeader}>
              <Text style={styles.settlementTripName}>{trip.tripName}</Text>
              <Text style={styles.settlementDate}>{trip.dateRangeLabel}</Text>
            </View>
            <View style={styles.settlementChipList}>
              {trip.currencySummaries.map((summary) => (
                <View
                  key={`${trip.tripId}-${summary.currency}-${summary.direction}`}
                  style={[
                    styles.settlementChip,
                    summary.direction === 'receive' ? styles.settlementChipReceive : styles.settlementChipSend,
                  ]}
                >
                  <Text
                    style={[
                      styles.settlementChipText,
                      summary.direction === 'receive'
                        ? styles.settlementChipTextReceive
                        : styles.settlementChipTextSend,
                    ]}
                  >
                    {summary.summaryLabel}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function MyTripsSection({ state, onRetry }: { state: TripListState; onRetry: () => void }) {
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

export function MyCurrentTripCard({ trip }: { trip: MyTripCardViewModel }) {
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

export function TripSections({ sections }: { sections: MyTripsStatusSectionViewModel[] }) {
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

export function TripRow({
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

export function displayName(value: string): string {
  return value.trim() || '이름을 불러올 수 없어요.';
}

export function providerSummary(providers: AuthProvider[]): string {
  if (providers.length === 0) {
    return '연결된 로그인 없음';
  }
  return providers.map(providerLabel).join(', ');
}

export function providerLabel(provider: AuthProvider): string {
  return provider === 'apple' ? 'Apple' : 'Kakao';
}

export function providerForProfile(providers: AuthProvider[]): AccountProvider {
  return providers.includes('apple') ? 'apple' : 'kakao';
}
