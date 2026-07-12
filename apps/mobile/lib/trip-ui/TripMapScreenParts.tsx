import { useMemo } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { theme } from '../design';
import { type DayItineraryMapActionFeedback } from '../trips/day-itinerary-map-actions';
import { buildTripMapDayChips, buildTripMapInitialRegion, buildTripMapSearchLayout } from '../trips/trip-map';
import { type TripTabUnavailableViewModel } from '../trips/trip-tabs';
import { DayChips } from './DayChips';
import { GooglePlaceMapSearch } from './GooglePlaceMapSearch';
import { type RouteMapPlace } from './RouteMap';
import { TripStateCard } from './TripScreenScaffold';
import { styles } from './TripMapScreenStyles';

export function MapContent({
  dayChips,
  feedback,
  onSelectDay,
  selectedDayId,
  tripId,
  mapPlaces,
}: {
  mapPlaces: RouteMapPlace[];
  tripId: string;
  dayChips: ReturnType<typeof buildTripMapDayChips>;
  selectedDayId: string;
  feedback: DayItineraryMapActionFeedback | null;
  onSelectDay: (dayId: string) => void;
}) {
  const initialRegion = useMemo(() => buildTripMapInitialRegion(mapPlaces), [mapPlaces]);
  const layout = buildTripMapSearchLayout();
  const showDayChipsOverlay = layout.dayChipsPlacement === 'mapOverlay';
  const mapStyle = layout.screenMode === 'fullScreen' ? styles.mapSearchFullScreen : styles.mapSearch;

  return (
    <View style={styles.mapFullScreenRoot}>
      <GooglePlaceMapSearch
        actionMode="exploreOnly"
        dayId={selectedDayId}
        initialRegion={initialRegion}
        key={selectedDayId}
        routePlaces={mapPlaces}
        style={mapStyle}
        tripId={tripId}
      />
      {showDayChipsOverlay ? (
        <View pointerEvents="box-none" style={styles.dayChipsOverlay}>
          <DayChips
            days={dayChips}
            edgePadding={theme.space[4]}
            selectedDayId={selectedDayId}
            onSelectDay={onSelectDay}
          />
        </View>
      ) : null}
      {feedback ? (
        <View pointerEvents="box-none" style={styles.mapFeedbackOverlay}>
          <TripStateCard helper={feedback.kind === 'error' ? undefined : feedback.message} title={feedback.message} />
        </View>
      ) : null}
    </View>
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
