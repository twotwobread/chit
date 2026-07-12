import { useMemo } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { theme } from '../design';
import { type DayItineraryMapActionFeedback } from '../trips/day-itinerary-map-actions';
import {
  buildTripMapInitialRegion,
  buildTripMapRouteLayerChips,
  buildTripMapSearchLayout,
  type TripMapRouteLayerChipId,
  type TripMapRouteNotice,
} from '../trips/trip-map';
import { type TripTabUnavailableViewModel } from '../trips/trip-tabs';
import { DayChips } from './DayChips';
import { GooglePlaceMapSearch } from './GooglePlaceMapSearch';
import { type RouteMapPlace, type RouteMapPolyline } from './RouteMap';
import { TripStateCard } from './TripScreenScaffold';
import { styles } from './TripMapScreenStyles';

export function MapContent({
  feedback,
  mapPlaces,
  onToggleRouteLayer,
  routeChips,
  routeNotice,
  routePolylines,
  selectedDayId,
  selectedRouteLayerChipId,
  tripId,
}: {
  mapPlaces: RouteMapPlace[];
  routePolylines: RouteMapPolyline[];
  tripId: string;
  routeChips: ReturnType<typeof buildTripMapRouteLayerChips>;
  routeNotice: TripMapRouteNotice | null;
  selectedDayId: string;
  selectedRouteLayerChipId: TripMapRouteLayerChipId | null;
  feedback: DayItineraryMapActionFeedback | null;
  onToggleRouteLayer: (chipId: TripMapRouteLayerChipId) => void;
}) {
  const initialRegion = useMemo(() => buildTripMapInitialRegion(mapPlaces), [mapPlaces]);
  const layout = buildTripMapSearchLayout();
  const showDayChipsOverlay = layout.dayChipsPlacement === 'mapOverlay';
  const mapStyle = layout.screenMode === 'fullScreen' ? styles.mapSearchFullScreen : styles.mapSearch;
  const sheetTopInset = theme.space[4] + theme.layout.controlHSm + theme.space[2] + theme.space[6];
  const mapSearchKey = `${selectedDayId}:${selectedRouteLayerChipId ?? 'none'}`;

  return (
    <View style={styles.mapFullScreenRoot}>
      <GooglePlaceMapSearch
        actionMode="exploreOnly"
        dayId={selectedDayId}
        initialRegion={initialRegion}
        key={mapSearchKey}
        minimizedSheetBaseHeight={40}
        routePlaces={mapPlaces}
        routePolylines={routePolylines}
        sheetTopInset={sheetTopInset}
        style={mapStyle}
        tripId={tripId}
      />
      {showDayChipsOverlay ? (
        <View pointerEvents="box-none" style={styles.dayChipsOverlay}>
          <DayChips
            days={routeChips}
            edgePadding={theme.space[4]}
            selectedDayId={selectedRouteLayerChipId}
            onSelectDay={(chipId) => onToggleRouteLayer(chipId as TripMapRouteLayerChipId)}
          />
        </View>
      ) : null}
      {routeNotice ? (
        <View pointerEvents="box-none" style={styles.routeNoticeOverlay}>
          <TripStateCard helper={routeNotice.helper} title={routeNotice.title} />
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
