import { MapContent, UnavailableState } from '../../../../lib/trip-ui/TripMapScreenParts';
import { TripScreen, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { useTripMapController } from '../../../../lib/trip-ui/useTripMapController';

export default function TripMapTabScreen() {
  const {
    bookmarkActionState,
    clearRoutePlaceSelection,
    createBookmark,
    deleteBookmark,
    feedback,
    goHome,
    goLogin,
    load,
    selectRoutePlace,
    state,
    toggleBookmarkLayer,
    toggleRouteLayer,
    tripId,
  } = useTripMapController();

  if (state.status === 'success') {
    return (
      <MapContent
        allBookmarkResults={state.allBookmarkResults}
        bookmarkActionState={bookmarkActionState}
        bookmarkLayerVisible={state.bookmarkLayerVisible}
        bookmarkResults={state.bookmarkResults}
        feedback={feedback}
        mapPlaces={state.mapPlaces}
        onBookmarkSelect={(result) => void createBookmark(result)}
        onBookmarkDelete={(result) => void deleteBookmark(result)}
        onClearRoutePlaceSelection={clearRoutePlaceSelection}
        onRoutePlacePress={selectRoutePlace}
        onToggleBookmarkLayer={toggleBookmarkLayer}
        onToggleRouteLayer={toggleRouteLayer}
        routeChips={state.routeChips}
        routeNotice={state.routeNotice}
        routePolylines={state.routePolylines}
        scheduleMarkerDetail={state.scheduleMarkerDetail}
        selectedDayId={state.selectedDayId}
        selectedRouteLayerChipId={state.selectedRouteLayerChipId}
        selectedRoutePlaceId={state.selectedRoutePlaceId}
        tripDestinations={state.tripDestinations}
        tripId={tripId ?? ''}
      />
    );
  }

  return (
    <TripScreen>
      {state.status === 'loading' ? <TripStateCard loading title="지도 정보를 불러오는 중..." /> : null}
      {state.status === 'auth' ? (
        <TripStateCard primaryAction={{ label: '로그인하기', onPress: goLogin }} title="다시 로그인해주세요." />
      ) : null}
      {state.status === 'notFound' ? (
        <TripStateCard
          helper="삭제되었거나 접근할 수 없는 여행이에요."
          primaryAction={{ label: '홈으로', onPress: goHome }}
          title="여행을 찾을 수 없어요."
        />
      ) : null}
      {state.status === 'error' ? (
        <TripStateCard
          helper="잠시 후 다시 시도해주세요."
          primaryAction={{ label: '다시 시도', onPress: () => void load() }}
          title="지도 정보를 불러올 수 없어요."
        />
      ) : null}
      {state.status === 'unavailable' ? <UnavailableState viewModel={state.viewModel} /> : null}
    </TripScreen>
  );
}
