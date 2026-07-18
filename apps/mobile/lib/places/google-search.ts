import type { Href } from 'expo-router';

import type {
  CreateGooglePlaceScheduleItemRequest,
  GooglePlaceDetailsResponse,
  GooglePlaceSearchResult,
} from '@i-um/api-contract';

import { theme } from '../design/theme';
import { buildExternalMapUrl, externalMapViewLabel, type MapProvider } from '../trips/map-provider';

export const googlePlaceSearchMinLength = 2;
export const googlePlaceSearchDefaultLimit = 10;
export const googlePlacePhotoDefaultWidth = 320;
export const googlePlaceSearchMinBiasRadiusMeters = 1000;
export const googlePlaceSearchMaxBiasRadiusMeters = 50000;
export const duplicateDayPlaceConfirmationCode = 'DUPLICATE_DAY_PLACE_CONFIRMATION_REQUIRED';
export const duplicateDayPlaceConfirmationMessage =
  '이미 이 일차에 추가된 장소입니다. 같은 장소를 한 번 더 일정에 추가할까요?';
export const googlePlaceAddFailureMessage = '장소를 추가할 수 없어요. 다시 검색한 뒤 시도해 주세요.';
export const googlePlaceSearchDefaultSheetTopInset =
  theme.space[4] + theme.layout.controlHSm + theme.space[2] + theme.space[6];

export type GooglePlaceSearchStatus = 'initial' | 'minQuery' | 'loading' | 'empty' | 'error' | 'notFound' | 'success';

export type GooglePlacePhotoViewModel = {
  token: string;
  widthPx?: number;
  heightPx?: number;
  attributionLabel: string;
};

export type GooglePlacePhotoImageSource = {
  uri: string;
  headers?: Record<string, string>;
};

export type GooglePlaceSearchRowViewModel = {
  id: string;
  bookmarkId?: string;
  placeName: string;
  address: string;
  typeHint: string;
  latitude?: number;
  longitude?: number;
  metadataLabels?: string[];
  googleMapsUri?: string;
  photo?: GooglePlacePhotoViewModel;
};

export type GooglePlaceExplorationDetailViewModel = GooglePlaceSearchRowViewModel & {
  description?: string;
  mapSearchLabel: string;
  mapUrl: string;
};

export type GooglePlaceSearchMarkerCategory = 'sights' | 'food' | 'lodging' | 'cafe' | 'shopping' | 'transport' | 'etc';

export type GooglePlaceSearchMarkerIconName =
  | 'landmark'
  | 'utensils'
  | 'bed'
  | 'coffee'
  | 'shopping-bag'
  | 'train-front'
  | 'map-pin';

export type GooglePlaceSearchMarkerEmphasis = 'normal' | 'focused';
export type GooglePlaceSearchMarkerVariant = 'search' | 'bookmark';
export type GooglePlaceSearchSelectionSource = GooglePlaceSearchMarkerVariant;

export type GooglePlaceMapCoordinate = { latitude: number; longitude: number };

export type GooglePlaceSearchMarkerViewModel = {
  id: string;
  coordinate: GooglePlaceMapCoordinate;
  title: string;
  category: GooglePlaceSearchMarkerCategory;
  categoryLabel: string;
  selected: boolean;
  iconName: GooglePlaceSearchMarkerIconName;
  variant: GooglePlaceSearchMarkerVariant;
  emphasis: GooglePlaceSearchMarkerEmphasis;
};

export type GooglePlaceSearchMarkerPinStyle = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  iconColor: string;
  badgeBackgroundColor?: string;
  badgeColor?: string;
};

export type GooglePlaceSearchMarkerOptions = {
  selectedVariant?: GooglePlaceSearchMarkerVariant | null;
  variant?: GooglePlaceSearchMarkerVariant;
};

export type GooglePlaceSearchMapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type GooglePlaceSearchResultsRegionOptions = {
  viewportHeight?: number;
  coveredBottomHeight?: number;
  verticalPadding?: number;
};

export type GooglePlaceSearchBias = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type GooglePlaceTripDestination = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  countryCode?: string | null;
};

export type GooglePlaceDestinationChipViewModel = {
  id: string;
  label: string;
  selected: boolean;
  accessibilityLabel: string;
};

export type SearchBiasSource =
  | { kind: 'tripDestination'; destinationId: string }
  | { kind: 'mapRegion'; latitude: number; longitude: number; radiusMeters: number }
  | { kind: 'currentLocation'; latitude: number; longitude: number; radiusMeters: number }
  | {
      kind: 'selectedPlace';
      googlePlaceId: string;
      placeName: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
    };

export type GooglePlaceDetailsViewState =
  | { status: 'idle' }
  | { status: 'loading'; googlePlaceId: string; message: string }
  | { status: 'success'; googlePlaceId: string; detail: GooglePlaceExplorationDetailViewModel }
  | { status: 'error'; googlePlaceId: string; message: string };

export type GooglePlaceSearchSheetState = 'minimized' | 'expanded' | 'full';
export type GooglePlaceSearchSheetTab = 'searchResults' | 'bookmarks';

export type GooglePlaceSearchFirstEntryLayoutState = {
  searchBarVisible: boolean;
  sheetContentVisible: boolean;
  sheetHandleVisible: boolean;
};

export type GooglePlaceSearchSheetTabViewModel = {
  id: GooglePlaceSearchSheetTab;
  label: string;
  accessibilityLabel: string;
  selected: boolean;
};

export type GooglePlaceSearchBookmarkListState =
  | {
      status: 'empty';
      title: string;
      helper: string;
      results: [];
    }
  | {
      status: 'results';
      title: string;
      helper: null;
      results: GooglePlaceSearchRowViewModel[];
    };

export type GooglePlaceSearchMarkerSelection = {
  result: GooglePlaceSearchRowViewModel;
  source: GooglePlaceSearchSelectionSource;
};

export type GooglePlaceSearchSheetMetrics = {
  minimizedHeight: number;
  expandedHeight: number;
  fullHeight: number;
};

export type GooglePlaceSearchSheetMetricsOptions = {
  minimizedBaseHeight?: number;
  topInset?: number;
};

export type GooglePlaceSearchSheetContentState = 'results';

export type GooglePlaceSearchSheetEvent =
  | { kind: 'handleFocus' }
  | { kind: 'searchInputFocus' }
  | { kind: 'searchResults' }
  | { kind: 'listPlaceSelect' }
  | { kind: 'markerPlaceSelect' }
  | { kind: 'resultsScrollStart' }
  | { kind: 'mapTap' }
  | { kind: 'mapPan' };

export type GooglePlaceCurrentLocationMarkerViewModel = {
  id: 'current-location';
  coordinate: GooglePlaceMapCoordinate;
  title: '내 위치';
};

export type GooglePlaceSearchViewState =
  | { status: 'initial'; message: string; results: [] }
  | { status: 'minQuery'; message: string; results: [] }
  | { status: 'loading'; message: string; results: [] }
  | { status: 'empty'; message: string; results: [] }
  | { status: 'error'; title: string; helper: string; canRetry: true; results: [] }
  | { status: 'notFound'; title: string; helper: string; results: [] }
  | { status: 'success'; results: GooglePlaceSearchRowViewModel[] };

export type GooglePlaceAddViewState =
  | { status: 'idle' }
  | { status: 'adding'; googlePlaceId: string }
  | { status: 'confirmingDuplicate'; result: GooglePlaceSearchRowViewModel; message: string }
  | { status: 'error'; message: string };

export type GooglePlaceSearchResultActionMode =
  | 'exploreOnly'
  | 'scheduleAdd'
  | 'scheduleSelect'
  | 'lodgingRegister'
  | 'bookmark';

export type GooglePlaceSearchResultActionView = {
  primaryAction: { label: string; loadingLabel: string; isLoading: boolean; disabled?: boolean } | null;
  favoriteAction: null;
  duplicateConfirmation: { message: string; confirmLabel: string; cancelLabel: string; isLoading: boolean } | null;
  errorMessage: string | null;
};

const typeHintByPrimaryType: Record<string, string> = {
  tourist_attraction: '관광지',
  museum: '관광지',
  park: '관광지',
  restaurant: '식당',
  meal_takeaway: '식당',
  bakery: '식당',
  lodging: '숙소',
  hotel: '숙소',
  cafe: '카페',
  coffee_shop: '카페',
  shopping_mall: '쇼핑',
  store: '쇼핑',
  airport: '교통',
  bus_station: '교통',
  bus_stop: '교통',
  subway_station: '교통',
  train_station: '교통',
  transit_station: '교통',
  light_rail_station: '교통',
  ferry_terminal: '교통',
  taxi_stand: '교통',
  parking: '교통',
  car_rental: '교통',
};

export function buildGooglePlaceSearchRoute(tripId: string, tripDayId: string): Href {
  return `/trips/${tripId}/days/${tripDayId}/place-search` as Href;
}

export function normalizeGooglePlaceSearchQuery(value: string): string {
  return value.trim();
}

export function canSearchGooglePlaces(value: string): boolean {
  return [...normalizeGooglePlaceSearchQuery(value)].length >= googlePlaceSearchMinLength;
}

export function buildGooglePlaceSearchInputState(query: string): GooglePlaceSearchViewState {
  const normalized = normalizeGooglePlaceSearchQuery(query);
  if (normalized.length === 0) {
    return { status: 'initial', message: '장소 이름을 검색해 보세요.', results: [] };
  }
  if (!canSearchGooglePlaces(normalized)) {
    return { status: 'minQuery', message: '두 글자 이상 입력해 주세요.', results: [] };
  }
  return { status: 'initial', message: '', results: [] };
}

export function clearGooglePlaceSearchResultsState(_query: string): GooglePlaceSearchViewState {
  return buildGooglePlaceSearchInputState('');
}

export function shouldRenderGooglePlaceSearchResults(state: GooglePlaceSearchViewState): boolean {
  return state.status === 'success';
}

export function shouldRenderGooglePlaceBookmarkDetail(
  selectionSource: GooglePlaceSearchSelectionSource | null,
  selectedResult?: GooglePlaceSearchRowViewModel | null,
): boolean {
  return selectionSource === 'bookmark' && Boolean(selectedResult?.bookmarkId);
}

export function resolveGooglePlaceSearchResultBookmark(
  result: GooglePlaceSearchRowViewModel,
  bookmarkResults: GooglePlaceSearchRowViewModel[],
): GooglePlaceSearchRowViewModel | null {
  return bookmarkResults.find((bookmark) => bookmark.id === result.id) ?? null;
}

export function canBookmarkGooglePlaceSearchResult(
  result: GooglePlaceSearchRowViewModel,
  bookmarkResults: GooglePlaceSearchRowViewModel[],
): boolean {
  return !resolveGooglePlaceSearchResultBookmark(result, bookmarkResults);
}

export function resolveGooglePlaceSearchSelectionAfterResultsClose(
  selectedResult: GooglePlaceSearchRowViewModel | null,
  bookmarkResults: GooglePlaceSearchRowViewModel[],
): GooglePlaceSearchRowViewModel | null {
  if (!selectedResult) {
    return null;
  }
  return resolveGooglePlaceSearchResultBookmark(selectedResult, bookmarkResults);
}

export function buildGooglePlaceSearchFirstEntryLayoutState(
  sheetState: GooglePlaceSearchSheetState,
): GooglePlaceSearchFirstEntryLayoutState {
  return {
    searchBarVisible: true,
    sheetContentVisible: sheetState !== 'minimized',
    sheetHandleVisible: true,
  };
}

export function buildGooglePlaceSearchSheetTabs(
  selectedTab: GooglePlaceSearchSheetTab,
): GooglePlaceSearchSheetTabViewModel[] {
  return [
    {
      id: 'searchResults',
      label: '검색 결과',
      accessibilityLabel: `검색 결과 탭 ${selectedTab === 'searchResults' ? '선택됨' : '선택'}`,
      selected: selectedTab === 'searchResults',
    },
    {
      id: 'bookmarks',
      label: '찜한 장소',
      accessibilityLabel: `찜한 장소 탭 ${selectedTab === 'bookmarks' ? '선택됨' : '선택'}`,
      selected: selectedTab === 'bookmarks',
    },
  ];
}

export function resolveGooglePlaceSearchSheetTab(
  current: GooglePlaceSearchSheetTab,
  selectionSource: GooglePlaceSearchSelectionSource | null,
): GooglePlaceSearchSheetTab {
  if (selectionSource === 'search') {
    return 'searchResults';
  }
  if (selectionSource === 'bookmark') {
    return 'bookmarks';
  }
  return current;
}

export function buildGooglePlaceSearchSheetBookmarkListState(
  bookmarkResults: GooglePlaceSearchRowViewModel[],
): GooglePlaceSearchBookmarkListState {
  if (bookmarkResults.length === 0) {
    return {
      status: 'empty',
      title: '찜한 장소가 없어요.',
      helper: '여행 중 가보고 싶은 장소를 찜하면 여기에서 바로 볼 수 있어요.',
      results: [],
    };
  }
  return {
    status: 'results',
    title: '찜한 장소',
    helper: null,
    results: bookmarkResults,
  };
}

export function resolveGooglePlaceSearchMarkerSelection(
  markerId: string,
  searchResults: GooglePlaceSearchRowViewModel[],
  bookmarkResults: GooglePlaceSearchRowViewModel[],
): GooglePlaceSearchMarkerSelection | null {
  const searchResult = searchResults.find((candidate) => candidate.id === markerId);
  if (searchResult) {
    return { result: searchResult, source: 'search' };
  }
  const bookmarkResult = bookmarkResults.find((candidate) => candidate.id === markerId);
  if (bookmarkResult) {
    return { result: bookmarkResult, source: 'bookmark' };
  }
  return null;
}

export function googlePlaceSearchLoadingState(): GooglePlaceSearchViewState {
  return { status: 'loading', message: '장소를 검색하는 중...', results: [] };
}

export function idleGooglePlaceAddState(): GooglePlaceAddViewState {
  return { status: 'idle' };
}

export function addingGooglePlaceState(googlePlaceId: string): GooglePlaceAddViewState {
  return { status: 'adding', googlePlaceId };
}

export function confirmingDuplicateGooglePlaceState(result: GooglePlaceSearchRowViewModel): GooglePlaceAddViewState {
  return { status: 'confirmingDuplicate', result, message: duplicateDayPlaceConfirmationMessage };
}

export function errorGooglePlaceAddState(): GooglePlaceAddViewState {
  return { status: 'error', message: googlePlaceAddFailureMessage };
}

export function buildGooglePlaceSearchResultActionView({
  addState,
  bookmarkResults = [],
  mode,
  result,
}: {
  mode: GooglePlaceSearchResultActionMode;
  result: GooglePlaceSearchRowViewModel;
  addState: GooglePlaceAddViewState;
  bookmarkResults?: GooglePlaceSearchRowViewModel[];
}): GooglePlaceSearchResultActionView {
  if (mode === 'exploreOnly') {
    return {
      duplicateConfirmation: null,
      errorMessage: null,
      favoriteAction: null,
      primaryAction: null,
    };
  }

  const isAlreadyBookmarked = mode === 'bookmark' && !canBookmarkGooglePlaceSearchResult(result, bookmarkResults);
  const label = isAlreadyBookmarked
    ? '이미 찜한 장소입니다.'
    : mode === 'scheduleSelect'
      ? '이 장소 선택'
      : mode === 'lodgingRegister'
        ? '숙소로 등록'
        : mode === 'bookmark'
          ? '장소 찜하기'
          : '장소 추가';
  const loadingLabel =
    mode === 'scheduleSelect'
      ? '처리 중...'
      : mode === 'lodgingRegister'
        ? '등록 중...'
        : mode === 'bookmark'
          ? '저장 중...'
          : '추가 중...';
  const isLoading = addState.status === 'adding' && addState.googlePlaceId === result.id;
  const duplicateConfirmation =
    addState.status === 'confirmingDuplicate' && addState.result.id === result.id
      ? {
          cancelLabel: '취소',
          confirmLabel: '한 번 더 추가',
          isLoading,
          message: addState.message,
        }
      : null;

  return {
    duplicateConfirmation,
    errorMessage: addState.status === 'error' ? addState.message : null,
    favoriteAction: null,
    primaryAction: { isLoading, label, loadingLabel, ...(isAlreadyBookmarked ? { disabled: true } : {}) },
  };
}

export function buildCreateGooglePlaceScheduleItemRequest(
  googlePlaceId: string,
  duplicateConfirmed: boolean,
  title: string,
): CreateGooglePlaceScheduleItemRequest {
  return { googlePlaceId: googlePlaceId.trim(), duplicateConfirmed, title: title.trim() };
}

export function buildCreateGooglePlaceScheduleItemRequestFromSearchResult(
  result: GooglePlaceSearchRowViewModel,
  duplicateConfirmed: boolean,
): CreateGooglePlaceScheduleItemRequest {
  return buildCreateGooglePlaceScheduleItemRequest(result.id, duplicateConfirmed, result.placeName);
}

export function isDuplicateDayPlaceConfirmationError(errorBody: unknown): boolean {
  if (!errorBody || typeof errorBody !== 'object' || !('error' in errorBody)) {
    return false;
  }
  const error = (errorBody as { error?: { code?: unknown } }).error;
  return error?.code === duplicateDayPlaceConfirmationCode;
}

export function successGooglePlaceSearchState(results: GooglePlaceSearchResult[]): GooglePlaceSearchViewState {
  if (results.length === 0) {
    return { status: 'empty', message: '검색 결과가 없어요. 다른 이름으로 검색해 주세요.', results: [] };
  }

  return {
    status: 'success',
    results: results.map((result) => {
      const mappedTypeHint = result.placeType ? theme.placeType[result.placeType]?.label : undefined;
      const typeHint =
        result.primaryTypeDisplayName?.trim() || mappedTypeHint || getGooglePlaceTypeHint(result.primaryType);
      const row: GooglePlaceSearchRowViewModel = {
        id: result.googlePlaceId,
        placeName: result.displayName,
        address: result.formattedAddress,
        typeHint,
        latitude: result.latitude,
        longitude: result.longitude,
        metadataLabels: buildGooglePlaceMetadataLabels(typeHint, result),
      };
      if (result.googleMapsUri) {
        row.googleMapsUri = result.googleMapsUri;
      }
      const photo = buildGooglePlacePhotoViewModel(result);
      if (photo) {
        row.photo = photo;
      }
      return row;
    }),
  };
}

export function buildGooglePlaceExplorationDetail(
  result: GooglePlaceSearchRowViewModel,
  details?: GooglePlaceDetailsResponse,
  mapProvider: MapProvider = 'googleMaps',
): GooglePlaceExplorationDetailViewModel {
  return {
    ...result,
    description: details?.description?.trim() || undefined,
    mapSearchLabel: externalMapViewLabel,
    mapUrl: buildExternalMapUrl(
      { placeName: result.placeName, address: result.address, googleMapsUri: result.googleMapsUri },
      mapProvider,
    ),
  };
}

export function buildGooglePlacePhotoUrl(
  apiBaseUrl: string,
  tripId: string,
  tripDayId: string,
  photoToken: string,
  maxWidthPx = googlePlacePhotoDefaultWidth,
): string {
  const base = apiBaseUrl.replace(/\/+$/, '');
  return `${base}/trips/${encodeURIComponent(tripId)}/days/${encodeURIComponent(
    tripDayId,
  )}/places/google/photos/${encodeURIComponent(photoToken)}?maxWidthPx=${maxWidthPx}`;
}

export function buildGooglePlacePhotoImageSource(
  apiBaseUrl: string,
  tripId: string,
  tripDayId: string,
  photoToken: string,
  accessToken?: string | null,
  maxWidthPx = googlePlacePhotoDefaultWidth,
): GooglePlacePhotoImageSource {
  const source: GooglePlacePhotoImageSource = {
    uri: buildGooglePlacePhotoUrl(apiBaseUrl, tripId, tripDayId, photoToken, maxWidthPx),
  };
  if (accessToken) {
    source.headers = { Authorization: `Bearer ${accessToken}` };
  }
  return source;
}

export function buildGooglePlaceSearchMarkerViewModels(
  results: GooglePlaceSearchRowViewModel[],
  selectedId?: string | null,
  options: GooglePlaceSearchMarkerOptions = {},
): GooglePlaceSearchMarkerViewModel[] {
  const variant = options.variant ?? 'search';
  return results
    .filter((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude))
    .map((result) => {
      const category = getGooglePlaceMarkerCategory(result.typeHint);
      const selected = result.id === selectedId && (!options.selectedVariant || options.selectedVariant === variant);
      return {
        id: result.id,
        coordinate: { latitude: result.latitude as number, longitude: result.longitude as number },
        title: result.placeName,
        category,
        categoryLabel: theme.placeType[category].label,
        selected,
        iconName: getGooglePlaceMarkerIconName(category),
        variant,
        emphasis: selected ? 'focused' : 'normal',
      };
    });
}

export function buildGooglePlaceSearchResultsRegion(
  results: GooglePlaceSearchRowViewModel[],
  fallback: GooglePlaceSearchMapRegion = defaultGooglePlaceSearchMapRegion,
  options: GooglePlaceSearchResultsRegionOptions = {},
): GooglePlaceSearchMapRegion {
  const points = results.filter(
    (result): result is GooglePlaceSearchRowViewModel & { latitude: number; longitude: number } =>
      Number.isFinite(result.latitude) && Number.isFinite(result.longitude),
  );
  if (points.length === 0) {
    return fallback;
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const baseLatitudeDelta = Math.max((maxLatitude - minLatitude) * 1.8, 0.01);
  const verticalFit = buildGooglePlaceSearchResultsVerticalFit(baseLatitudeDelta, options);

  return {
    latitude: roundCoordinate((minLatitude + maxLatitude) / 2 - verticalFit.centerOffset),
    longitude: roundCoordinate((minLongitude + maxLongitude) / 2),
    latitudeDelta: roundDelta(verticalFit.latitudeDelta),
    longitudeDelta: roundDelta(Math.max((maxLongitude - minLongitude) * 1.8, 0.01)),
  };
}

function buildGooglePlaceSearchResultsVerticalFit(
  latitudeDelta: number,
  options: GooglePlaceSearchResultsRegionOptions,
): { latitudeDelta: number; centerOffset: number } {
  const viewportHeight = options.viewportHeight ?? 0;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return { centerOffset: 0, latitudeDelta };
  }

  const coveredBottomHeight = clampNumber(options.coveredBottomHeight ?? 0, 0, viewportHeight);
  if (coveredBottomHeight <= 0) {
    return { centerOffset: 0, latitudeDelta };
  }

  const verticalPadding = Math.max(0, options.verticalPadding ?? 0);
  const visibleHeight = Math.max(1, viewportHeight - coveredBottomHeight);
  const visibleInnerHeight = Math.max(1, visibleHeight - verticalPadding * 2);
  const visibleFraction = clampNumber(visibleInnerHeight / viewportHeight, 0.1, 1);
  const fittedLatitudeDelta = latitudeDelta / visibleFraction;
  const centerOffset = fittedLatitudeDelta * (coveredBottomHeight / (2 * viewportHeight));
  return { centerOffset, latitudeDelta: fittedLatitudeDelta };
}

export function buildGooglePlaceSelectedMapRegion(
  result: GooglePlaceSearchRowViewModel,
  currentRegion?: GooglePlaceSearchMapRegion,
): GooglePlaceSearchMapRegion | null {
  if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
    return null;
  }
  const latitudeDelta = Math.min(currentRegion?.latitudeDelta ?? 0.03, 0.03);
  const longitudeDelta = Math.min(currentRegion?.longitudeDelta ?? 0.03, 0.03);
  return {
    latitude: roundCoordinate((result.latitude as number) - latitudeDelta * 0.22),
    longitude: result.longitude as number,
    latitudeDelta,
    longitudeDelta,
  };
}

export function buildGooglePlaceSearchBiasFromRegion(region: GooglePlaceSearchMapRegion): GooglePlaceSearchBias | null {
  if (!Number.isFinite(region.latitude) || !Number.isFinite(region.longitude)) {
    return null;
  }
  const latitudeMeters = Math.abs(region.latitudeDelta) * 111_320;
  const longitudeMeters =
    Math.abs(region.longitudeDelta) * 111_320 * Math.max(Math.cos(toRadians(region.latitude)), 0.01);
  const radiusMeters = clampGooglePlaceSearchBiasRadius(Math.round(Math.max(latitudeMeters, longitudeMeters) / 2));
  return { latitude: region.latitude, longitude: region.longitude, radiusMeters };
}

export function buildDefaultGooglePlaceDestinationSelection(destinations: GooglePlaceTripDestination[]): string | null {
  return destinations[0]?.id ?? null;
}

export function buildGooglePlaceDestinationChips(
  destinations: GooglePlaceTripDestination[],
  selectedDestinationId: string | null,
): GooglePlaceDestinationChipViewModel[] {
  const resolvedSelectedDestinationId =
    selectedDestinationId ?? buildDefaultGooglePlaceDestinationSelection(destinations);
  return destinations.map((destination) => {
    const selected = destination.id === resolvedSelectedDestinationId;
    return {
      id: destination.id,
      label: destination.displayName,
      selected,
      accessibilityLabel: `${destination.displayName} 여행 도시 ${selected ? '선택됨' : '선택'}`,
    };
  });
}

export function buildGooglePlaceSearchRegionFromDestination(
  destination: GooglePlaceTripDestination,
): GooglePlaceSearchMapRegion | null {
  if (!isValidGooglePlaceTripDestination(destination)) {
    return null;
  }
  const radiusMeters = clampGooglePlaceSearchBiasRadius(destination.radiusMeters);
  const latitudeDelta = clampNumber((radiusMeters * 2) / 111_320, 0.03, 1);
  const longitudeDelta = clampNumber(
    latitudeDelta / Math.max(Math.cos(toRadians(destination.latitude)), 0.01),
    0.03,
    1,
  );
  return {
    latitude: roundCoordinate(destination.latitude),
    longitude: roundCoordinate(destination.longitude),
    latitudeDelta: roundDelta(latitudeDelta),
    longitudeDelta: roundDelta(longitudeDelta),
  };
}

export function buildGooglePlaceSearchBiasFromSource(
  source: SearchBiasSource | null | undefined,
  destinations: GooglePlaceTripDestination[],
): GooglePlaceSearchBias | null {
  if (!source) {
    return null;
  }
  if (source.kind === 'mapRegion' || source.kind === 'currentLocation' || source.kind === 'selectedPlace') {
    if (!Number.isFinite(source.latitude) || !Number.isFinite(source.longitude)) {
      return null;
    }
    return {
      latitude: roundCoordinate(source.latitude),
      longitude: roundCoordinate(source.longitude),
      radiusMeters: clampGooglePlaceSearchBiasRadius(source.radiusMeters),
    };
  }

  const destination = destinations.find((candidate) => candidate.id === source.destinationId);
  if (!destination || !isValidGooglePlaceTripDestination(destination)) {
    return null;
  }
  return {
    latitude: roundCoordinate(destination.latitude),
    longitude: roundCoordinate(destination.longitude),
    radiusMeters: clampGooglePlaceSearchBiasRadius(destination.radiusMeters),
  };
}

export function buildGooglePlaceSearchResultsSectionTitle(
  source: SearchBiasSource | null | undefined,
  destinations: GooglePlaceTripDestination[],
): string {
  if (source?.kind === 'tripDestination') {
    const destination = destinations.find((candidate) => candidate.id === source.destinationId);
    const label = destination?.displayName.trim();
    if (label) {
      return `${label} 주변 결과`;
    }
  }
  if (source?.kind === 'currentLocation') {
    return '현재 위치 주변 결과';
  }
  if (source?.kind === 'selectedPlace') {
    const label = source.placeName.trim();
    if (label) {
      return `${label} 주변 결과`;
    }
  }
  return '현재 지도 영역 주변 결과';
}

export function buildGooglePlaceSearchResultDistanceLabel(
  result: GooglePlaceSearchRowViewModel,
  source: SearchBiasSource | null | undefined,
  destinations: GooglePlaceTripDestination[],
): string | null {
  if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
    return null;
  }
  const anchor = resolveGooglePlaceSearchDistanceAnchor(source, destinations);
  if (!anchor) {
    return null;
  }
  const distanceMeters = distanceMetersBetweenCoordinates(
    { latitude: result.latitude as number, longitude: result.longitude as number },
    anchor.coordinate,
  );
  return `${anchor.label}에서 ${formatGooglePlaceDistance(distanceMeters)}`;
}

export function buildGooglePlaceCurrentLocationBiasSource(
  coordinate: GooglePlaceMapCoordinate | null | undefined,
): SearchBiasSource | null {
  if (!coordinate || !Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
    return null;
  }
  return {
    kind: 'currentLocation',
    latitude: roundCoordinate(coordinate.latitude),
    longitude: roundCoordinate(coordinate.longitude),
    radiusMeters: googlePlaceSearchMinBiasRadiusMeters,
  };
}

export function isGooglePlaceCoordinateWithinTripDestination(
  coordinate: GooglePlaceMapCoordinate | null | undefined,
  destination: GooglePlaceTripDestination | null | undefined,
): boolean {
  if (
    !coordinate ||
    !destination ||
    !Number.isFinite(coordinate.latitude) ||
    !Number.isFinite(coordinate.longitude) ||
    !isValidGooglePlaceTripDestination(destination)
  ) {
    return false;
  }
  return (
    distanceMetersBetweenCoordinates(coordinate, destination) <=
    clampGooglePlaceSearchBiasRadius(destination.radiusMeters)
  );
}

export function buildGooglePlaceSelectedBiasSource(
  result: GooglePlaceSearchRowViewModel | null | undefined,
): SearchBiasSource | null {
  if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
    return null;
  }
  return {
    kind: 'selectedPlace',
    googlePlaceId: result.id,
    placeName: result.placeName.trim() || '선택한 장소',
    latitude: roundCoordinate(result.latitude as number),
    longitude: roundCoordinate(result.longitude as number),
    radiusMeters: googlePlaceSearchMinBiasRadiusMeters,
  };
}

export function shouldShowGooglePlaceRegionSearchAction(
  query: string,
  regionDirty: boolean,
  isBusy: boolean,
  sheetState: GooglePlaceSearchSheetState,
): boolean {
  return sheetState === 'minimized' && regionDirty && !isBusy && canSearchGooglePlaces(query);
}

export function resolveGooglePlaceSearchSheetTopInset(topInset?: number): number {
  return Math.max(googlePlaceSearchDefaultSheetTopInset, Math.max(0, topInset ?? 0));
}

export function buildGooglePlaceSearchSheetMetrics(
  windowHeight: number,
  bottomInset = 0,
  options: GooglePlaceSearchSheetMetricsOptions = {},
): GooglePlaceSearchSheetMetrics {
  const safeWindowHeight = Math.max(1, windowHeight);
  const safeBottomInset = Math.max(0, bottomInset);
  const minimizedBaseHeight = Math.max(1, options.minimizedBaseHeight ?? 56);
  const minimizedHeight = Math.round(minimizedBaseHeight + safeBottomInset);
  const maxSheetHeight = Math.max(
    minimizedHeight,
    Math.round(safeWindowHeight - resolveGooglePlaceSearchSheetTopInset(options.topInset)),
  );
  const expandedHeight = Math.round(clampNumber(safeWindowHeight * 0.56, minimizedHeight, maxSheetHeight));
  const fullHeight = Math.round(clampNumber(safeWindowHeight * 0.76, expandedHeight, maxSheetHeight));
  return {
    minimizedHeight,
    expandedHeight,
    fullHeight,
  };
}

export function buildGooglePlaceSearchSheetSnapPoints(metrics: GooglePlaceSearchSheetMetrics): number[] {
  return [metrics.minimizedHeight, metrics.expandedHeight, metrics.fullHeight];
}

export function buildGooglePlaceSearchSheetIndex(state: GooglePlaceSearchSheetState): number {
  if (state === 'full') {
    return 2;
  }
  if (state === 'expanded') {
    return 1;
  }
  return 0;
}

export function buildGooglePlaceSearchSheetStateFromIndex(index: number): GooglePlaceSearchSheetState {
  if (index <= 0) {
    return 'minimized';
  }
  if (index === 1) {
    return 'expanded';
  }
  return 'full';
}

export function resolveGooglePlaceSearchSheetState(
  current: GooglePlaceSearchSheetState,
  event: GooglePlaceSearchSheetEvent,
): GooglePlaceSearchSheetState {
  if (event.kind === 'mapTap') {
    return 'minimized';
  }
  if (event.kind === 'mapPan') {
    return current;
  }
  if (event.kind === 'handleFocus') {
    return current === 'minimized' ? 'expanded' : current;
  }
  if (event.kind === 'searchInputFocus') {
    return 'full';
  }
  if (event.kind === 'searchResults') {
    return 'expanded';
  }
  if (event.kind === 'listPlaceSelect') {
    return current;
  }
  if (event.kind === 'markerPlaceSelect') {
    return 'expanded';
  }
  if (event.kind === 'resultsScrollStart') {
    return current === 'minimized' ? 'minimized' : 'full';
  }
  return current;
}

export function shouldShowGooglePlaceCurrentLocationButton(sheetState: GooglePlaceSearchSheetState): boolean {
  return sheetState === 'minimized';
}

export function buildGooglePlaceCurrentLocationMarkerViewModel(
  coordinate?: GooglePlaceMapCoordinate | null,
): GooglePlaceCurrentLocationMarkerViewModel | null {
  if (!coordinate || !Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
    return null;
  }
  return { id: 'current-location', coordinate, title: '내 위치' };
}

export function resolveGooglePlaceSearchSheetContentState(
  _selectedResult?: GooglePlaceSearchRowViewModel | null,
): GooglePlaceSearchSheetContentState {
  return 'results';
}

export function shouldNavigateBackFromGooglePlaceDetailGesture(_translationX: number, _translationY: number): boolean {
  return false;
}

export function buildGooglePlaceDetailsIdleState(): GooglePlaceDetailsViewState {
  return { status: 'idle' };
}

export function buildGooglePlaceDetailsLoadingState(googlePlaceId: string): GooglePlaceDetailsViewState {
  return { status: 'loading', googlePlaceId, message: '장소 설명을 불러오는 중...' };
}

export function buildGooglePlaceDetailsSuccessState(
  result: GooglePlaceSearchRowViewModel,
  details?: GooglePlaceDetailsResponse,
  mapProvider: MapProvider = 'googleMaps',
): GooglePlaceDetailsViewState {
  return {
    status: 'success',
    googlePlaceId: result.id,
    detail: buildGooglePlaceExplorationDetail(result, details, mapProvider),
  };
}

export function buildGooglePlaceDetailsErrorState(googlePlaceId: string): GooglePlaceDetailsViewState {
  return {
    status: 'error',
    googlePlaceId,
    message: '장소 설명을 불러오지 못했어요. 지도에서 자세한 정보를 확인해 주세요.',
  };
}

export function buildGooglePlaceSearchMarkerPinStyle(
  category: GooglePlaceSearchMarkerCategory,
  selected: boolean,
  variant: GooglePlaceSearchMarkerVariant = 'search',
): GooglePlaceSearchMarkerPinStyle {
  const categoryColor = theme.placeType[category].color;
  if (variant === 'bookmark') {
    return {
      backgroundColor: selected ? theme.color.surface : categoryColor,
      borderColor: theme.color.accent,
      borderWidth: selected ? 4 : 3,
      iconColor: selected ? categoryColor : theme.color.onPrimary,
      badgeBackgroundColor: theme.color.surface,
      badgeColor: theme.color.accent,
    };
  }
  return {
    backgroundColor: selected ? theme.color.surface : categoryColor,
    borderColor: selected ? categoryColor : theme.color.surface,
    borderWidth: selected ? 4 : 3,
    iconColor: selected ? categoryColor : theme.color.onPrimary,
  };
}

export function buildGooglePlaceSearchMarkerScale(region: GooglePlaceSearchMapRegion, selected: boolean): number {
  if (selected) {
    return 1;
  }
  const zoomDelta = Math.max(Math.abs(region.latitudeDelta), Math.abs(region.longitudeDelta));
  if (zoomDelta >= 0.5) {
    return 0.66;
  }
  if (zoomDelta >= 0.12) {
    return 0.82;
  }
  return 1;
}

export const defaultGooglePlaceSearchMapRegion: GooglePlaceSearchMapRegion = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function buildGooglePlaceMetadataLabels(typeHint: string, result: GooglePlaceSearchResult): string[] {
  const labels = [typeHint];
  const ratingLabel = buildGooglePlaceRatingLabel(result.rating, result.userRatingCount);
  if (ratingLabel) {
    labels.push(ratingLabel);
  }
  const openStatusLabel = buildGooglePlaceOpenStatusLabel(result.openNow);
  if (openStatusLabel) {
    labels.push(openStatusLabel);
  }
  return labels;
}

function buildGooglePlaceRatingLabel(rating?: number, userRatingCount?: number): string | null {
  if (!Number.isFinite(rating)) {
    return null;
  }
  const ratingText = `평점 ${(rating as number).toFixed(1)}`;
  if (!Number.isFinite(userRatingCount)) {
    return ratingText;
  }
  return `${ratingText} · 리뷰 ${new Intl.NumberFormat('ko-KR').format(userRatingCount as number)}개`;
}

function buildGooglePlaceOpenStatusLabel(openNow?: boolean): string | null {
  if (openNow === true) {
    return '영업 중';
  }
  if (openNow === false) {
    return '영업 종료';
  }
  return null;
}

function buildGooglePlacePhotoViewModel(result: GooglePlaceSearchResult): GooglePlacePhotoViewModel | undefined {
  if (!result.photo?.token) {
    return undefined;
  }
  return {
    token: result.photo.token,
    widthPx: result.photo.widthPx,
    heightPx: result.photo.heightPx,
    attributionLabel: result.photo.authorAttributions.map((attribution) => attribution.displayName).join(', '),
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMetersBetweenCoordinates(from: GooglePlaceMapCoordinate, to: GooglePlaceMapCoordinate): number {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveGooglePlaceSearchDistanceAnchor(
  source: SearchBiasSource | null | undefined,
  destinations: GooglePlaceTripDestination[],
): { label: string; coordinate: GooglePlaceMapCoordinate } | null {
  if (source?.kind === 'currentLocation') {
    return { label: '현재 위치', coordinate: { latitude: source.latitude, longitude: source.longitude } };
  }
  if (source?.kind === 'mapRegion') {
    return { label: '지도 중심', coordinate: { latitude: source.latitude, longitude: source.longitude } };
  }
  if (source?.kind === 'selectedPlace') {
    return {
      label: source.placeName.trim() || '선택한 장소',
      coordinate: { latitude: source.latitude, longitude: source.longitude },
    };
  }
  if (source?.kind === 'tripDestination') {
    const destination = destinations.find((candidate) => candidate.id === source.destinationId);
    const label = destination?.displayName.trim();
    if (!destination || !label || !isValidGooglePlaceTripDestination(destination)) {
      return null;
    }
    return { label: `${label} 중심`, coordinate: destination };
  }
  return null;
}

function formatGooglePlaceDistance(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters)) {
    return '';
  }
  if (distanceMeters < 1000) {
    return `${Math.max(0, Math.round(distanceMeters / 10) * 10)}m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampGooglePlaceSearchBiasRadius(value: number): number {
  return clampNumber(Math.round(value), googlePlaceSearchMinBiasRadiusMeters, googlePlaceSearchMaxBiasRadiusMeters);
}

function isValidGooglePlaceTripDestination(destination: GooglePlaceTripDestination): boolean {
  return (
    Number.isFinite(destination.latitude) &&
    Number.isFinite(destination.longitude) &&
    Number.isFinite(destination.radiusMeters)
  );
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

function roundDelta(value: number): number {
  return Number(value.toFixed(5));
}

function getGooglePlaceMarkerIconName(category: GooglePlaceSearchMarkerCategory): GooglePlaceSearchMarkerIconName {
  switch (category) {
    case 'sights':
      return 'landmark';
    case 'food':
      return 'utensils';
    case 'lodging':
      return 'bed';
    case 'cafe':
      return 'coffee';
    case 'shopping':
      return 'shopping-bag';
    case 'transport':
      return 'train-front';
    default:
      return 'map-pin';
  }
}

function getGooglePlaceMarkerCategory(typeHint: string): GooglePlaceSearchMarkerCategory {
  const normalized = typeHint.trim().toLowerCase();
  if (
    normalized.includes('관광') ||
    normalized.includes('명소') ||
    normalized.includes('museum') ||
    normalized.includes('park') ||
    normalized.includes('공원') ||
    normalized.includes('미술관') ||
    normalized.includes('박물관')
  ) {
    return 'sights';
  }
  if (
    normalized.includes('식당') ||
    normalized.includes('음식') ||
    normalized.includes('레스토랑') ||
    normalized.includes('restaurant') ||
    normalized.includes('bakery') ||
    normalized.includes('베이커리') ||
    normalized.includes('라멘')
  ) {
    return 'food';
  }
  if (
    normalized.includes('카페') ||
    normalized.includes('커피') ||
    normalized.includes('coffee') ||
    normalized.includes('cafe')
  ) {
    return 'cafe';
  }
  if (
    normalized.includes('숙소') ||
    normalized.includes('호텔') ||
    normalized.includes('lodging') ||
    normalized.includes('hotel')
  ) {
    return 'lodging';
  }
  if (
    normalized.includes('쇼핑') ||
    normalized.includes('몰') ||
    normalized.includes('상점') ||
    normalized.includes('store') ||
    normalized.includes('mall')
  ) {
    return 'shopping';
  }
  if (
    normalized.includes('교통') ||
    normalized.includes('이동수단') ||
    normalized.includes('공항') ||
    normalized.includes('역') ||
    normalized.includes('터미널') ||
    normalized.includes('정류장') ||
    normalized.includes('airport') ||
    normalized.includes('station') ||
    normalized.includes('terminal') ||
    normalized.includes('subway') ||
    normalized.includes('train') ||
    normalized.includes('bus') ||
    normalized.includes('ferry') ||
    normalized.includes('transit') ||
    normalized.includes('parking') ||
    normalized.includes('taxi') ||
    normalized.includes('rental')
  ) {
    return 'transport';
  }
  return 'etc';
}

export function errorGooglePlaceSearchState(status?: number): GooglePlaceSearchViewState {
  if (status === 403 || status === 404) {
    return {
      status: 'notFound',
      title: '일정을 찾을 수 없어요.',
      helper: '삭제되었거나 접근할 수 없는 여행 일정이에요.',
      results: [],
    };
  }

  return {
    status: 'error',
    title: '장소를 검색할 수 없어요.',
    helper: '잠시 후 다시 시도해 주세요.',
    canRetry: true,
    results: [],
  };
}

export function getGooglePlaceTypeHint(primaryType: string): string {
  return typeHintByPrimaryType[primaryType] ?? '장소';
}
