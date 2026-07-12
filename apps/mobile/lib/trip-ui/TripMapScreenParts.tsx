import { useMemo } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { ListRow, PlacePin, PlaceTag, PrimaryButton, SecondaryButton } from '../design';
import { buildDayItineraryMapRowActions, type DayItineraryMapActionFeedback } from '../trips/day-itinerary-map-actions';
import { type DayItineraryViewModel } from '../trips/day-itinerary';
import { tripItineraryPath } from '../trips/routes';
import { buildTripMapDayChips, buildTripMapInitialRegion } from '../trips/trip-map';
import { type TripTabUnavailableViewModel } from '../trips/trip-tabs';
import { DayChips } from './DayChips';
import { GooglePlaceMapSearch } from './GooglePlaceMapSearch';
import { type RouteMapPlace } from './RouteMap';
import { TripListCard, TripStateCard } from './TripScreenScaffold';
import { styles } from './TripMapScreenStyles';

export function MapContent({
  copyAddress,
  dayChips,
  feedback,
  onSelectDay,
  openMap,
  selectedDayId,
  tripId,
  viewModel,
  mapPlaces,
}: {
  viewModel: DayItineraryViewModel;
  mapPlaces: RouteMapPlace[];
  tripId: string;
  dayChips: ReturnType<typeof buildTripMapDayChips>;
  selectedDayId: string;
  feedback: DayItineraryMapActionFeedback | null;
  openMap: (url: string) => void;
  copyAddress: (address: string) => void;
  onSelectDay: (dayId: string) => void;
}) {
  const initialRegion = useMemo(() => buildTripMapInitialRegion(mapPlaces), [mapPlaces]);
  const footer =
    viewModel.status === 'empty' ? (
      <TripStateCard
        helper="선택한 Day에 장소를 추가하면 지도에서 바로 열 수 있어요."
        primaryAction={{ label: '일정 보기', onPress: () => router.push(tripItineraryPath(tripId)) }}
        title={`${viewModel.dayLabel}에 등록된 장소가 없어요.`}
      />
    ) : (
      <SelectedDayList
        copyAddress={copyAddress}
        items={viewModel.items}
        openMap={openMap}
        summary={`${viewModel.formattedDate} · 일정 ${viewModel.items.length}개 · 지도 ${mapPlaces.length}곳`}
        title={`${viewModel.dayLabel} 지도 동선`}
      />
    );

  return (
    <>
      <DayChips days={dayChips} selectedDayId={selectedDayId} onSelectDay={onSelectDay} />
      <GooglePlaceMapSearch
        actionMode="exploreOnly"
        bottomSheetFooter={footer}
        dayId={selectedDayId}
        initialRegion={initialRegion}
        key={selectedDayId}
        routePlaces={mapPlaces}
        style={styles.mapSearch}
        tripId={tripId}
      />
      {feedback ? (
        <TripStateCard helper={feedback.kind === 'error' ? undefined : feedback.message} title={feedback.message} />
      ) : null}
    </>
  );
}

export function SelectedDayList({
  copyAddress,
  items,
  openMap,
  summary,
  title,
}: {
  items: Extract<DayItineraryViewModel, { status: 'success' }>['items'];
  title: string;
  summary: string;
  openMap: (url: string) => void;
  copyAddress: (address: string) => void;
}) {
  return (
    <TripListCard>
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summaryHelper}>{summary}</Text>
      </View>
      {items.map((item, index) => {
        const actions = buildDayItineraryMapRowActions({ address: item.address, placeName: item.placeName });

        return (
          <ListRow
            first={index === 0}
            key={item.id}
            leading={<PlacePin order={Number(item.orderLabel)} type={item.placeType} />}
            subtitle={
              <View style={styles.rowSubtitle}>
                <PlaceTag type={item.placeType} />
                <Text style={styles.address}>{item.address || '주소 정보가 없어요.'}</Text>
              </View>
            }
            title={item.placeName}
            trailing={
              <View style={styles.actionColumn}>
                <PrimaryButton
                  label={actions.map.label}
                  onPress={() => openMap(actions.map.url)}
                  style={styles.rowButton}
                />
                <SecondaryButton
                  accessibilityLabel={actions.copy.accessibilityLabel}
                  disabled={actions.copy.disabled}
                  label={actions.copy.label}
                  onPress={() => {
                    if (actions.copy.address) {
                      copyAddress(actions.copy.address);
                    }
                  }}
                  style={styles.rowButton}
                />
              </View>
            }
          />
        );
      })}
    </TripListCard>
  );
}

export function UnavailableState({ viewModel }: { viewModel: TripTabUnavailableViewModel }) {
  return (
    <TripStateCard
      helper={viewModel.helper}
      primaryAction={{
        label: viewModel.primaryAction.label,
        onPress: () => router.push(viewModel.primaryAction.route),
      }}
      secondaryAction={{
        label: viewModel.secondaryAction.label,
        onPress: () => router.push(viewModel.secondaryAction.route),
      }}
      title={viewModel.title}
    />
  );
}
