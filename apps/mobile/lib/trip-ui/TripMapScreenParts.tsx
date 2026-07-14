import { useMemo } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';

import { theme } from '../design';
import {
  type GooglePlaceAddViewState,
  type GooglePlaceSearchRowViewModel,
  type GooglePlaceTripDestination,
} from '../places/google-search';
import { type DayItineraryMapActionFeedback } from '../trips/day-itinerary-map-actions';
import {
  buildTripMapInitialRegion,
  buildTripMapRouteLayerChips,
  buildTripMapSearchLayout,
  type TripMapRouteLayerChipId,
  type TripMapRouteNotice,
  type TripMapScheduleMarkerDetail,
} from '../trips/trip-map';
import { type TripTabUnavailableViewModel } from '../trips/trip-tabs';
import { DayChips } from './DayChips';
import { GooglePlaceMapSearch } from './GooglePlaceMapSearch';
import { type RouteMapPlace, type RouteMapPolyline } from './RouteMap';
import { TripStateCard } from './TripScreenScaffold';
import { styles } from './TripMapScreenStyles';

export function MapContent({
  bookmarkActionState,
  bookmarkLayerVisible,
  bookmarkResults,
  feedback,
  mapPlaces,
  onBookmarkSelect,
  onBookmarkDelete,
  onClearRoutePlaceSelection,
  onRoutePlacePress,
  onToggleBookmarkLayer,
  onToggleRouteLayer,
  routeChips,
  routeNotice,
  routePolylines,
  scheduleMarkerDetail,
  selectedDayId,
  selectedRouteLayerChipId,
  selectedRoutePlaceId,
  tripDestinations,
  tripId,
}: {
  bookmarkActionState: GooglePlaceAddViewState;
  bookmarkLayerVisible: boolean;
  bookmarkResults: GooglePlaceSearchRowViewModel[];
  mapPlaces: RouteMapPlace[];
  routePolylines: RouteMapPolyline[];
  tripId: string;
  routeChips: ReturnType<typeof buildTripMapRouteLayerChips>;
  routeNotice: TripMapRouteNotice | null;
  selectedDayId: string;
  selectedRouteLayerChipId: TripMapRouteLayerChipId | null;
  tripDestinations: GooglePlaceTripDestination[];
  feedback: DayItineraryMapActionFeedback | null;
  scheduleMarkerDetail: TripMapScheduleMarkerDetail | null;
  selectedRoutePlaceId: string | null;
  onBookmarkSelect: (result: GooglePlaceSearchRowViewModel) => void;
  onBookmarkDelete: (result: GooglePlaceSearchRowViewModel) => void;
  onClearRoutePlaceSelection: () => void;
  onRoutePlacePress: (place: RouteMapPlace) => void;
  onToggleBookmarkLayer: () => void;
  onToggleRouteLayer: (chipId: TripMapRouteLayerChipId) => void;
}) {
  const initialRegion = useMemo(
    () => buildTripMapInitialRegion(mapPlaces, tripDestinations),
    [mapPlaces, tripDestinations],
  );
  const layout = buildTripMapSearchLayout();
  const showDayChipsOverlay = layout.dayChipsPlacement === 'mapOverlay';
  const mapStyle = layout.screenMode === 'fullScreen' ? styles.mapSearchFullScreen : styles.mapSearch;
  const sheetTopInset = theme.space[4] + theme.layout.controlHSm + theme.space[4];
  const mapSearchKey = `${selectedDayId}:${selectedRouteLayerChipId ?? 'none'}`;

  return (
    <View style={styles.mapFullScreenRoot}>
      <GooglePlaceMapSearch
        actionMode="bookmark"
        actionState={bookmarkActionState}
        bookmarkResults={bookmarkResults}
        bottomSheetFooter={scheduleMarkerDetail ? <ScheduleMarkerDetailCard detail={scheduleMarkerDetail} /> : null}
        dayId={selectedDayId}
        initialRegion={initialRegion}
        key={mapSearchKey}
        minimizedSheetBaseHeight={40}
        onBookmarkSelectResult={onBookmarkSelect}
        onBookmarkDeleteResult={onBookmarkDelete}
        onClearRoutePlaceSelection={onClearRoutePlaceSelection}
        onRoutePlacePress={onRoutePlacePress}
        routePlaces={mapPlaces}
        routePolylines={routePolylines}
        selectedRoutePlaceId={selectedRoutePlaceId}
        sheetTopInset={sheetTopInset}
        style={mapStyle}
        tripDestinations={tripDestinations}
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
      <Pressable
        accessibilityLabel={bookmarkLayerVisible ? '찜한 장소 숨기기' : '찜한 장소 보이기'}
        accessibilityRole="button"
        accessibilityState={{ selected: bookmarkLayerVisible }}
        onPress={onToggleBookmarkLayer}
        style={[
          styles.bookmarkLayerFloatingButton,
          bookmarkLayerVisible ? styles.bookmarkLayerFloatingButtonSelected : null,
        ]}
      >
        <Heart
          color={bookmarkLayerVisible ? theme.color.onPrimary : theme.color.accent}
          fill={bookmarkLayerVisible ? theme.color.onPrimary : 'transparent'}
          size={21}
          strokeWidth={2.6}
        />
      </Pressable>
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

function ScheduleMarkerDetailCard({ detail }: { detail: TripMapScheduleMarkerDetail }) {
  return (
    <View style={styles.scheduleMarkerDetailCard}>
      <Text style={styles.scheduleMarkerDetailSubtitle}>{detail.subtitle}</Text>
      <Text style={styles.scheduleMarkerDetailTitle}>{detail.title}</Text>
      <Text style={styles.scheduleMarkerDetailMeta}>{detail.categoryLabel}</Text>
      {detail.timeLabel ? <Text style={styles.scheduleMarkerDetailMeta}>{detail.timeLabel}</Text> : null}
      {detail.address ? <Text style={styles.scheduleMarkerDetailText}>{detail.address}</Text> : null}
      {detail.memo ? <Text style={styles.scheduleMarkerDetailText}>{detail.memo}</Text> : null}
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
