import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { FilterChip, PrimaryButton, theme } from '../design';
import {
  type GooglePlaceAddViewState,
  type GooglePlaceSearchRowViewModel,
  type GooglePlaceTripDestination,
} from '../places/google-search';
import { buildDayItineraryLodgingManagementRoute } from '../trips/day-itinerary-add-place-navigation';
import { type DayItineraryMapActionFeedback } from '../trips/day-itinerary-map-actions';
import {
  buildTripMapBookmarkLayerViewModel,
  buildTripMapDayChips,
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
  allBookmarkResults,
  bookmarkActionState,
  feedback,
  lodgingResults,
  mapPlaces,
  onBookmarkSelect,
  onBookmarkDelete,
  onClearRoutePlaceSelection,
  onRemoveScheduleResult,
  onResetScheduleAddState,
  onRoutePlacePress,
  onScheduleSelect,
  onSubmitScheduleBatch,
  onToggleRouteLayer,
  routeChips,
  routeNotice,
  routePolylines,
  scheduleAddState,
  scheduleFeedbackMessage,
  scheduleMarkerDetail,
  scheduleTargetDayChips,
  selectedDayId,
  selectedRouteLayerChipIds,
  selectedRoutePlaceId,
  selectedScheduleResults,
  tripDestinations,
  tripId,
}: {
  allBookmarkResults: GooglePlaceSearchRowViewModel[];
  bookmarkActionState: GooglePlaceAddViewState;
  lodgingResults: GooglePlaceSearchRowViewModel[];
  mapPlaces: RouteMapPlace[];
  routePolylines: RouteMapPolyline[];
  tripId: string;
  routeChips: ReturnType<typeof buildTripMapRouteLayerChips>;
  routeNotice: TripMapRouteNotice | null;
  scheduleAddState: GooglePlaceAddViewState;
  scheduleFeedbackMessage: string | null;
  scheduleTargetDayChips: ReturnType<typeof buildTripMapDayChips>;
  selectedDayId: string;
  selectedRouteLayerChipIds: TripMapRouteLayerChipId[];
  tripDestinations: GooglePlaceTripDestination[];
  feedback: DayItineraryMapActionFeedback | null;
  scheduleMarkerDetail: TripMapScheduleMarkerDetail | null;
  selectedRoutePlaceId: string | null;
  selectedScheduleResults: GooglePlaceSearchRowViewModel[];
  onBookmarkSelect: (result: GooglePlaceSearchRowViewModel) => void;
  onBookmarkDelete: (result: GooglePlaceSearchRowViewModel) => void;
  onClearRoutePlaceSelection: () => void;
  onRemoveScheduleResult: (googlePlaceId: string) => void;
  onResetScheduleAddState: () => void;
  onRoutePlacePress: (place: RouteMapPlace) => void;
  onScheduleSelect: (result: GooglePlaceSearchRowViewModel) => void;
  onSubmitScheduleBatch: (targetDayId: string) => void;
  onToggleRouteLayer: (chipId: TripMapRouteLayerChipId) => void;
}) {
  const initialRegion = useMemo(
    () => buildTripMapInitialRegion(mapPlaces, tripDestinations),
    [mapPlaces, tripDestinations],
  );
  const layout = buildTripMapSearchLayout();
  const bookmarkLayer = buildTripMapBookmarkLayerViewModel(allBookmarkResults, true);
  const mapStyle = layout.screenMode === 'fullScreen' ? styles.mapSearchFullScreen : styles.mapSearch;
  const routeChipInset = layout.dayChipsPlacement === 'searchOverlay' && routeChips.length > 0 ? 72 : 0;
  const sheetTopInset = theme.space[4] + theme.layout.controlHSm + theme.space[4] + routeChipInset;
  const selectedSchedulePlaceIds = useMemo(
    () => selectedScheduleResults.map((result) => result.id),
    [selectedScheduleResults],
  );
  const mapSearchKey = selectedDayId;

  return (
    <View style={styles.mapFullScreenRoot}>
      <GooglePlaceMapSearch
        actionMode="scheduleAdd"
        actionState={scheduleAddState}
        bookmarkMarkerResults={bookmarkLayer.allBookmarkResults}
        bookmarkResults={bookmarkLayer.allBookmarkResults}
        bottomSheetFooter={scheduleMarkerDetail ? <ScheduleMarkerDetailCard detail={scheduleMarkerDetail} /> : null}
        dayId={selectedDayId}
        favoriteActionState={bookmarkActionState}
        initialRegion={initialRegion}
        key={mapSearchKey}
        lodgingResults={lodgingResults}
        lodgingEmptyAction={{
          label: '숙소 등록하러 가기',
          onPress: () => router.push(buildDayItineraryLodgingManagementRoute(tripId, selectedDayId)),
        }}
        minimizedSheetBaseHeight={40}
        onBookmarkDeleteResult={onBookmarkDelete}
        onBookmarkSelectResult={onBookmarkSelect}
        onClearRoutePlaceSelection={onClearRoutePlaceSelection}
        onPrimaryAction={(result) => onScheduleSelect(result)}
        onResetActionState={onResetScheduleAddState}
        onRouteChipPress={(chipId) => onToggleRouteLayer(chipId as TripMapRouteLayerChipId)}
        onRoutePlacePress={onRoutePlacePress}
        routeChips={routeChips}
        routePlaces={mapPlaces}
        routePolylines={routePolylines}
        selectedBatchPlaceIds={selectedSchedulePlaceIds}
        selectedRouteChipIds={selectedRouteLayerChipIds}
        selectedRoutePlaceId={selectedRoutePlaceId}
        sheetTopInset={sheetTopInset}
        stickyFooter={
          selectedScheduleResults.length > 0 ? (
            <MapScheduleAddTray
              actionState={scheduleAddState}
              feedbackMessage={scheduleFeedbackMessage}
              onRemoveResult={onRemoveScheduleResult}
              onSubmit={onSubmitScheduleBatch}
              results={selectedScheduleResults}
              targetDays={scheduleTargetDayChips}
            />
          ) : null
        }
        stickyFooterHeight={selectedScheduleResults.length > 0 ? 220 : 0}
        style={mapStyle}
        tripDestinations={tripDestinations}
        tripId={tripId}
      />
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

function MapScheduleAddTray({
  actionState,
  feedbackMessage,
  onRemoveResult,
  onSubmit,
  results,
  targetDays,
}: {
  actionState: GooglePlaceAddViewState;
  feedbackMessage: string | null;
  results: GooglePlaceSearchRowViewModel[];
  targetDays: ReturnType<typeof buildTripMapDayChips>;
  onRemoveResult: (googlePlaceId: string) => void;
  onSubmit: (targetDayId: string) => void;
}) {
  const [choosingDay, setChoosingDay] = useState(false);
  const [targetDayId, setTargetDayId] = useState<string | null>(null);
  const isSubmitting = actionState.status === 'adding' && actionState.googlePlaceId === 'batch';
  const targetDay = targetDays.find((day) => day.id === targetDayId) ?? null;

  useEffect(() => {
    if (results.length === 0) {
      setChoosingDay(false);
      setTargetDayId(null);
    }
  }, [results.length]);

  if (results.length === 0) {
    return null;
  }

  const submitLabel = isSubmitting
    ? '등록 중...'
    : choosingDay
      ? targetDay
        ? `${targetDay.label}에 일정 등록`
        : '등록할 Day 선택'
      : '선택된 장소 일정 등록';

  return (
    <View style={styles.scheduleAddTray}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scheduleAddChipScroller}>
        <View style={styles.scheduleAddChipRow}>
          {results.map((result) => (
            <FilterChip
              accessibilityLabel={`${result.placeName} 제거`}
              disabled={isSubmitting}
              key={`map-selected-${result.id}`}
              label={result.placeName}
              labelNumberOfLines={1}
              onPress={() => onRemoveResult(result.id)}
              statusLabel="제거"
              style={styles.scheduleAddSelectedChip}
            />
          ))}
        </View>
      </ScrollView>
      {choosingDay ? (
        <View style={styles.scheduleAddTargetWrap}>
          <DayChips days={targetDays} edgePadding={0} onSelectDay={setTargetDayId} selectedDayId={targetDayId} />
        </View>
      ) : null}
      {feedbackMessage ? <Text style={styles.scheduleAddFeedback}>{feedbackMessage}</Text> : null}
      <PrimaryButton
        disabled={isSubmitting || (choosingDay && !targetDay)}
        label={submitLabel}
        loading={isSubmitting}
        loadingLabel="등록 중..."
        onPress={() => {
          if (!choosingDay) {
            setChoosingDay(true);
            return;
          }
          if (targetDay) {
            onSubmit(targetDay.id);
          }
        }}
      />
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
