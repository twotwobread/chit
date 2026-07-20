import { Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import type { AuthProvider } from '@i-um/api-contract';

import {
  buildAppInfoLegalRows,
  type AppInfoLegalRow as AppInfoLegalRowViewModel,
  type LegalLinkId,
  type LegalLinkOpenState,
} from '../app-info/legal';
import { SettingRow, StatRow, type AccountProvider } from '../account-ui/AccountRows';
import { PastTripRow, UpcomingTripRow } from '../home-ui/TripCards';
import { EmptyState, ErrorState, SecondaryButton, SkeletonCard } from '../design';
import { type SettlementSummaryState, type TripListState } from './useMyPageController';
import {
  buildMySettlementSummaryViewModel,
  buildMyTripsSuccessViewModel,
  myTripRowVariant,
  tripDetailPath,
  type MySettlementSummaryViewModel,
  type MyTripCardViewModel,
  type MyTripsStatusSectionViewModel,
} from '../trips/mypage';
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

      {state.status === 'loading' ? <SkeletonCard title="정산 요약을 불러오는 중..." /> : null}

      {state.status === 'error' ? (
        <ErrorState
          action={{ label: '다시 시도', onPress: onRetry }}
          body="잠시 후 다시 시도해주세요."
          title="정산 요약을 불러올 수 없어요."
        />
      ) : null}

      {viewModel?.status === 'empty' ? <EmptyState body={viewModel.helper} title={viewModel.title} /> : null}

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
  const groupedTrips = viewModel?.sections ?? [];

  return (
    <View style={styles.sectionStack}>
      <Text style={styles.sectionTitle}>내 여행</Text>

      {state.status === 'loading' ? <SkeletonCard title="내 여행을 불러오는 중..." /> : null}

      {state.status === 'error' ? (
        <ErrorState action={{ label: '다시 시도', onPress: onRetry }} title="내 여행을 불러올 수 없어요." />
      ) : null}

      {state.status === 'ready' && state.trips.length === 0 ? (
        <EmptyState
          action={{ label: '새 여행 만들기', onPress: () => router.push('/trips/new'), variant: 'primary' }}
          body="새 여행을 만들고 여정을 이어가요."
          title="아직 여행이 없어요."
        />
      ) : null}

      {state.status === 'ready' && state.trips.length > 0 && viewModel ? (
        <>
          <StatRow
            stats={[
              { label: '전체 여행', value: state.trips.length },
              { label: '진행 중', value: viewModel.ongoingTripCount },
            ]}
          />
          <TripSections sections={groupedTrips} />
          <SecondaryButton label="새 여행 만들기" onPress={() => router.push('/trips/new')} />
        </>
      ) : null}
    </View>
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
  const variant = myTripRowVariant(section.status);

  if (variant.kind === 'pastRow') {
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
      statusLabel={variant.statusLabel}
      statusTone={variant.statusTone}
      surfaceTone={variant.surfaceTone}
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
