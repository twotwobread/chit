import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  type RefAttributes,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { BedDouble, Coffee, Landmark, LocateFixed, MapPin, ShoppingBag, Utensils } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, type Region } from 'react-native-maps';

import { ApiError, OpenAPI } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../lib/auth/client';
import { theme } from '../../../../../lib/design';
import {
  applySelectedPlaceToPlaceScheduleForm,
  buildPlaceScheduleDetailRoute,
  parsePlaceScheduleDetailParams,
  selectedPlaceFromGoogleSearchResult,
} from '../../../../../lib/places/place-schedule-detail';
import { resolveDayItineraryAddPlaceReturnNavigation } from '../../../../../lib/trips/day-itinerary-add-place-navigation';
import {
  createGooglePlaceScheduleItem,
  getGooglePlaceDetails,
  searchGooglePlaces,
} from '../../../../../lib/places/client';
import {
  addingGooglePlaceState,
  buildGooglePlaceCurrentLocationMarkerViewModel,
  buildGooglePlaceDetailsErrorState,
  buildGooglePlaceDetailsIdleState,
  buildGooglePlaceDetailsLoadingState,
  buildGooglePlaceDetailsSuccessState,
  buildGooglePlaceExplorationDetail,
  buildGooglePlacePhotoImageSource,
  buildGooglePlaceSearchBiasFromRegion,
  buildGooglePlaceSearchInputState,
  buildGooglePlaceSearchMarkerViewModels,
  buildGooglePlaceSearchResultsRegion,
  buildGooglePlaceSearchSheetIndex,
  buildGooglePlaceSearchSheetMetrics,
  buildGooglePlaceSearchSheetSnapPoints,
  buildGooglePlaceSearchSheetStateFromIndex,
  buildGooglePlaceSelectedMapRegion,
  canSearchGooglePlaces,
  confirmingDuplicateGooglePlaceState,
  defaultGooglePlaceSearchMapRegion,
  errorGooglePlaceAddState,
  errorGooglePlaceSearchState,
  googlePlacePhotoDefaultWidth,
  googlePlaceSearchLoadingState,
  idleGooglePlaceAddState,
  isDuplicateDayPlaceConfirmationError,
  normalizeGooglePlaceSearchQuery,
  resolveGooglePlaceSearchSheetState,
  shouldShowGooglePlaceCurrentLocationButton,
  shouldShowGooglePlaceRegionSearchAction,
  successGooglePlaceSearchState,
  type GooglePlaceAddViewState,
  type GooglePlaceDetailsViewState,
  type GooglePlaceMapCoordinate,
  type GooglePlaceSearchBias,
  type GooglePlaceSearchMarkerCategory,
  type GooglePlaceSearchMarkerIconName,
  type GooglePlaceSearchRowViewModel,
  type GooglePlaceSearchSheetState,
  type GooglePlaceSearchViewState,
} from '../../../../../lib/places/google-search';

type GooglePlaceSearchBottomSheetHandle = {
  snapToIndex: (index: number) => void;
};

type GooglePlaceSearchScrollHandle = {
  scrollTo: (options: { y: number; animated?: boolean }) => void;
};

type GooglePlaceSearchBottomSheetProps = {
  backgroundStyle?: StyleProp<ViewStyle>;
  bottomInset?: number;
  children?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  enablePanDownToClose?: boolean;
  handleComponent?: (() => ReactNode) | null;
  index: number;
  keyboardBehavior?: string;
  onChange?: (index: number) => void;
  snapPoints: number[];
  style?: StyleProp<ViewStyle>;
};

type GooglePlaceSearchBottomSheetModule = {
  BottomSheetScrollView?: unknown;
  BottomSheetTextInput?: unknown;
  default?: unknown;
};

function loadGooglePlaceSearchBottomSheetModule(): GooglePlaceSearchBottomSheetModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the native bottom-sheet stack is optional so Expo Go can fall back when RNGH initialization fails.
    return require('@gorhom/bottom-sheet') as GooglePlaceSearchBottomSheetModule;
  } catch {
    return null;
  }
}

function clampBottomSheetIndex(index: number, snapPointCount: number): number {
  if (snapPointCount <= 0) {
    return 0;
  }
  return Math.min(Math.max(Math.round(index), 0), snapPointCount - 1);
}

function clampBottomSheetHeight(height: number, snapPoints: number[]): number {
  if (snapPoints.length === 0) {
    return Math.max(0, height);
  }
  const min = Math.min(...snapPoints);
  const max = Math.max(...snapPoints);
  return Math.min(Math.max(height, min), max);
}

function nearestBottomSheetIndex(height: number, snapPoints: number[]): number {
  if (snapPoints.length <= 1) {
    return 0;
  }
  return snapPoints.reduce((nearestIndex, candidateHeight, candidateIndex) => {
    const nearestDistance = Math.abs((snapPoints[nearestIndex] ?? 0) - height);
    const candidateDistance = Math.abs(candidateHeight - height);
    return candidateDistance < nearestDistance ? candidateIndex : nearestIndex;
  }, 0);
}

function resolveFallbackBottomSheetReleaseIndex({
  currentHeight,
  currentIndex,
  dy,
  snapPoints,
  vy,
}: {
  currentHeight: number;
  currentIndex: number;
  dy: number;
  snapPoints: number[];
  vy: number;
}): number {
  const isIntentionalDrag = Math.abs(dy) >= 48 || Math.abs(vy) >= 0.55;
  if (isIntentionalDrag) {
    const direction = dy < 0 || vy < -0.55 ? 1 : -1;
    return clampBottomSheetIndex(currentIndex + direction, snapPoints.length);
  }
  return nearestBottomSheetIndex(currentHeight, snapPoints);
}

const FallbackGooglePlaceSearchBottomSheet = forwardRef<
  GooglePlaceSearchBottomSheetHandle,
  GooglePlaceSearchBottomSheetProps
>(function FallbackGooglePlaceSearchBottomSheet(
  { backgroundStyle, children, containerStyle, handleComponent, index, onChange, snapPoints, style },
  ref,
) {
  const currentIndexRef = useRef(index);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const safeIndex = clampBottomSheetIndex(index, snapPoints.length);
  const baseHeight = snapPoints[safeIndex] ?? 0;
  const visibleHeight = dragHeight ?? baseHeight;

  useEffect(() => {
    currentIndexRef.current = safeIndex;
  }, [safeIndex]);

  useImperativeHandle(
    ref,
    () => ({
      snapToIndex: (nextIndex: number) => onChange?.(clampBottomSheetIndex(nextIndex, snapPoints.length)),
    }),
    [onChange, snapPoints.length],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 6,
        onPanResponderMove: (_, gestureState) => {
          const currentBaseHeight = snapPoints[currentIndexRef.current] ?? baseHeight;
          setDragHeight(clampBottomSheetHeight(currentBaseHeight - gestureState.dy, snapPoints));
        },
        onPanResponderRelease: (_, gestureState) => {
          const currentBaseHeight = snapPoints[currentIndexRef.current] ?? baseHeight;
          const currentHeight = clampBottomSheetHeight(currentBaseHeight - gestureState.dy, snapPoints);
          setDragHeight(null);
          onChange?.(
            resolveFallbackBottomSheetReleaseIndex({
              currentHeight,
              currentIndex: currentIndexRef.current,
              dy: gestureState.dy,
              snapPoints,
              vy: gestureState.vy,
            }),
          );
        },
        onPanResponderTerminate: () => setDragHeight(null),
        onPanResponderTerminationRequest: () => false,
      }),
    [baseHeight, onChange, snapPoints],
  );

  return (
    <View pointerEvents="box-none" style={[styles.fallbackSheetContainer, containerStyle]}>
      <View style={[styles.fallbackSheetSurface, style, backgroundStyle, { height: visibleHeight }]}>
        <View {...panResponder.panHandlers}>{handleComponent?.()}</View>
        {children}
      </View>
    </View>
  );
});

const nativeBottomSheetModule = loadGooglePlaceSearchBottomSheetModule();
const GooglePlaceBottomSheet = (nativeBottomSheetModule?.default ??
  FallbackGooglePlaceSearchBottomSheet) as ComponentType<
  GooglePlaceSearchBottomSheetProps & RefAttributes<GooglePlaceSearchBottomSheetHandle>
>;
const GooglePlaceBottomSheetScrollView = (nativeBottomSheetModule?.BottomSheetScrollView ??
  ScrollView) as ComponentType<ComponentProps<typeof ScrollView> & RefAttributes<GooglePlaceSearchScrollHandle>>;
const GooglePlaceBottomSheetTextInput = (nativeBottomSheetModule?.BottomSheetTextInput ?? TextInput) as ComponentType<
  ComponentProps<typeof TextInput>
>;

export default function GooglePlaceSearchScreen() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const mapRef = useRef<MapView | null>(null);
  const bottomSheetRef = useRef<GooglePlaceSearchBottomSheetHandle | null>(null);
  const resultScrollRef = useRef<GooglePlaceSearchScrollHandle | null>(null);
  const resultCardYByIdRef = useRef<Record<string, number>>({});
  const pendingResultFocusIdRef = useRef<string | null>(null);
  const suppressNextRegionDirtyRef = useRef(false);
  const suppressNextMapTapRef = useRef(false);
  const {
    tripId: tripIdParam,
    date: dateParam,
    returnTo: returnToParam,
    mode: modeParam,
    title: titleParam,
    titleTouched: titleTouchedParam,
    startTime: startTimeParam,
    endTime: endTimeParam,
    memo: memoParam,
    googlePlaceId: googlePlaceIdParam,
    placeName: placeNameParam,
    address: addressParam,
    typeHint: typeHintParam,
  } = useLocalSearchParams<{
    tripId?: string | string[];
    date?: string | string[];
    returnTo?: string | string[];
    mode?: string | string[];
    title?: string | string[];
    titleTouched?: string | string[];
    startTime?: string | string[];
    endTime?: string | string[];
    memo?: string | string[];
    googlePlaceId?: string | string[];
    placeName?: string | string[];
    address?: string | string[];
    typeHint?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const mode = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const isSelectorMode = mode === 'select';
  const [query, setQuery] = useState('');
  const [state, setState] = useState<GooglePlaceSearchViewState>(buildGooglePlaceSearchInputState(''));
  const [addState, setAddState] = useState<GooglePlaceAddViewState>(idleGooglePlaceAddState());
  const [detailsState, setDetailsState] = useState<GooglePlaceDetailsViewState>(buildGooglePlaceDetailsIdleState());
  const [selectedResult, setSelectedResult] = useState<GooglePlaceSearchRowViewModel | null>(null);
  const [highlightedResultId, setHighlightedResultId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GooglePlaceMapCoordinate | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(defaultGooglePlaceSearchMapRegion);
  const [regionDirty, setRegionDirty] = useState(false);
  const [sheetState, setSheetState] = useState<GooglePlaceSearchSheetState>('minimized');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [mapActionMessage, setMapActionMessage] = useState<string | null>(null);
  const [imageFailures, setImageFailures] = useState<Record<string, true>>({});
  const isLoading = state.status === 'loading';
  const isAdding = addState.status === 'adding';
  const isBusy = isLoading || isAdding;

  const results = state.status === 'success' ? state.results : [];
  const markers = buildGooglePlaceSearchMarkerViewModels(results, highlightedResultId);
  const currentLocationMarker = buildGooglePlaceCurrentLocationMarkerViewModel(currentLocation);
  const showRegionSearch = shouldShowGooglePlaceRegionSearchAction(query, regionDirty, isBusy, sheetState);
  const showCurrentLocation = shouldShowGooglePlaceCurrentLocationButton(sheetState);
  const sheetMetrics = useMemo(
    () => buildGooglePlaceSearchSheetMetrics(window.height, insets.bottom),
    [insets.bottom, window.height],
  );
  const sheetSnapPoints = useMemo(() => buildGooglePlaceSearchSheetSnapPoints(sheetMetrics), [sheetMetrics]);
  const sheetIndex = buildGooglePlaceSearchSheetIndex(sheetState);
  const visibleSheetHeight = sheetMetrics[`${sheetState}Height`];

  const expandSheetFromHandle = useCallback(() => {
    setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'handleFocus' }));
  }, []);

  const handleBottomSheetChange = useCallback((index: number) => {
    setSheetState(buildGooglePlaceSearchSheetStateFromIndex(index));
  }, []);

  const renderSheetHandle = useCallback(
    () => (
      <Pressable
        accessibilityLabel="검색 창 펼치기"
        accessibilityRole="button"
        onFocus={expandSheetFromHandle}
        onPress={expandSheetFromHandle}
        style={styles.handleArea}
      >
        <View style={styles.grabber} />
      </Pressable>
    ),
    [expandSheetFromHandle],
  );

  useEffect(() => {
    bottomSheetRef.current?.snapToIndex(sheetIndex);
  }, [sheetIndex, sheetSnapPoints]);

  const focusSearchInput = () => {
    setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'searchInputFocus' }));
  };

  const expandSheetFromScrollStart = () => {
    setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'resultsScrollStart' }));
  };

  const focusResultInList = (resultId: string) => {
    const y = resultCardYByIdRef.current[resultId];
    if (!Number.isFinite(y)) {
      pendingResultFocusIdRef.current = resultId;
      return;
    }
    pendingResultFocusIdRef.current = null;
    resultScrollRef.current?.scrollTo({ y: Math.max(0, y - theme.space[3]), animated: true });
  };

  useEffect(() => {
    if (!tripId || !date || !selectedResult) {
      setDetailsState(buildGooglePlaceDetailsIdleState());
      return;
    }

    let cancelled = false;
    setDetailsState(buildGooglePlaceDetailsLoadingState(selectedResult.id));
    const loadDetails = async () => {
      try {
        const response = await getGooglePlaceDetails(tripId, date, selectedResult.id);
        if (!cancelled) {
          setDetailsState(buildGooglePlaceDetailsSuccessState(selectedResult, response));
        }
      } catch (error) {
        if (
          error instanceof MobileAuthError &&
          (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
        ) {
          router.replace('/login');
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }
        if (!cancelled) {
          setDetailsState(buildGooglePlaceDetailsErrorState(selectedResult.id));
        }
      }
    };

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [date, selectedResult, tripId]);

  const returnToDay = () => {
    if (!tripId || !date) {
      router.replace('/');
      return;
    }

    const navigation = resolveDayItineraryAddPlaceReturnNavigation({ tripId, date, returnTo: returnToParam });
    if (navigation.kind === 'dismissToDay') {
      router.dismissTo(navigation.href);
      return;
    }
    router.replace(navigation.href);
  };

  const runSearch = async (bias?: GooglePlaceSearchBias | null) => {
    if (isBusy) {
      return;
    }
    if (!tripId || !date) {
      setState(errorGooglePlaceSearchState(404));
      return;
    }

    const inputState = buildGooglePlaceSearchInputState(query);
    if (!canSearchGooglePlaces(query)) {
      setState(inputState);
      return;
    }

    setLocationMessage(null);
    setMapActionMessage(null);
    setSelectedResult(null);
    setHighlightedResultId(null);
    setDetailsState(buildGooglePlaceDetailsIdleState());
    setAddState(idleGooglePlaceAddState());
    setState(googlePlaceSearchLoadingState());
    try {
      const response = await searchGooglePlaces(
        tripId,
        date,
        normalizeGooglePlaceSearchQuery(query),
        bias ?? undefined,
      );
      const nextState = successGooglePlaceSearchState(response.results);
      setState(nextState);
      setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'searchResults' }));
      setRegionDirty(false);
      if (nextState.status === 'success') {
        const nextRegion = buildGooglePlaceSearchResultsRegion(nextState.results, mapRegion);
        suppressNextRegionDirtyRef.current = true;
        setMapRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 320);
      }
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        router.replace('/login');
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          router.replace('/login');
          return;
        }
        setState(errorGooglePlaceSearchState(error.status));
        return;
      }
      setState(errorGooglePlaceSearchState());
    }
  };

  const runRegionSearch = () => {
    void runSearch(buildGooglePlaceSearchBiasFromRegion(mapRegion));
  };

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    setSelectedResult(null);
    setHighlightedResultId(null);
    setDetailsState(buildGooglePlaceDetailsIdleState());
    setRegionDirty(false);
    if (!isBusy) {
      setAddState(idleGooglePlaceAddState());
      setState(buildGooglePlaceSearchInputState(nextQuery));
    }
  };

  const selectResult = (result: GooglePlaceSearchRowViewModel, source: 'list' | 'marker') => {
    setSelectedResult(result);
    setHighlightedResultId(result.id);
    if (source === 'marker') {
      pendingResultFocusIdRef.current = result.id;
    }
    setSheetState((current) =>
      resolveGooglePlaceSearchSheetState(current, {
        kind: source === 'marker' ? 'markerPlaceSelect' : 'listPlaceSelect',
      }),
    );
    setAddState((current) => (current.status === 'adding' ? current : idleGooglePlaceAddState()));
    setMapActionMessage(null);
    const nextRegion = buildGooglePlaceSelectedMapRegion(result, mapRegion);
    if (nextRegion) {
      suppressNextRegionDirtyRef.current = true;
      setMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 260);
    }
    if (source === 'marker') {
      setTimeout(() => focusResultInList(result.id), 0);
    }
  };

  const handleRegionChangeComplete = (region: Region) => {
    setMapRegion(region);
    if (suppressNextRegionDirtyRef.current) {
      suppressNextRegionDirtyRef.current = false;
      return;
    }
    if (state.status === 'success' || canSearchGooglePlaces(query)) {
      setRegionDirty(true);
    }
  };

  const handleMapTap = () => {
    if (suppressNextMapTapRef.current) {
      suppressNextMapTapRef.current = false;
      return;
    }
    setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'mapTap' }));
  };

  const handleMarkerPress = (result: GooglePlaceSearchRowViewModel) => {
    suppressNextMapTapRef.current = true;
    selectResult(result, 'marker');
  };

  const moveToCurrentLocation = async () => {
    if (isBusy) {
      return;
    }
    setLocationMessage(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationMessage('현재 위치 권한이 필요해요. 권한을 허용하거나 지도를 직접 이동해 주세요.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const nextRegion: Region = {
        ...nextLocation,
        latitudeDelta: Math.min(mapRegion.latitudeDelta, 0.03),
        longitudeDelta: Math.min(mapRegion.longitudeDelta, 0.03),
      };
      setCurrentLocation(nextLocation);
      suppressNextRegionDirtyRef.current = true;
      setMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 260);
      setRegionDirty(canSearchGooglePlaces(query));
      setLocationMessage('현재 위치로 지도를 이동했어요. 이 지역에서 다시 검색을 눌러 검색하세요.');
    } catch {
      setLocationMessage('현재 위치를 가져오지 못했어요. 지도를 직접 이동해 주세요.');
    }
  };

  const submitAdd = async (result: GooglePlaceSearchRowViewModel, duplicateConfirmed: boolean) => {
    if (isBusy || !tripId || !date) {
      return;
    }

    if (isSelectorMode) {
      const values = parsePlaceScheduleDetailParams({
        title: titleParam,
        titleTouched: titleTouchedParam,
        startTime: startTimeParam,
        endTime: endTimeParam,
        memo: memoParam,
        googlePlaceId: googlePlaceIdParam,
        placeName: placeNameParam,
        address: addressParam,
        typeHint: typeHintParam,
      });
      router.replace(
        buildPlaceScheduleDetailRoute(
          tripId,
          date,
          applySelectedPlaceToPlaceScheduleForm(values, selectedPlaceFromGoogleSearchResult(result)),
        ),
      );
      return;
    }

    setAddState(addingGooglePlaceState(result.id));
    try {
      await createGooglePlaceScheduleItem(tripId, date, result.id, duplicateConfirmed, result.placeName);
      returnToDay();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        router.replace('/login');
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          router.replace('/login');
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setAddState(idleGooglePlaceAddState());
          setState(errorGooglePlaceSearchState(error.status));
          return;
        }
        if (error.status === 409 && isDuplicateDayPlaceConfirmationError(error.body)) {
          setAddState(confirmingDuplicateGooglePlaceState(result));
          return;
        }
      }
      setAddState(errorGooglePlaceAddState());
    }
  };

  const openGoogleMaps = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setMapActionMessage('Google Maps를 열지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  if (!tripId || !date || state.status === 'notFound') {
    const title = state.status === 'notFound' ? state.title : '일정을 찾을 수 없어요.';
    const helper = state.status === 'notFound' ? state.helper : '삭제되었거나 접근할 수 없는 여행 일정이에요.';
    return (
      <ScrollView contentContainerStyle={styles.notFoundContent} style={styles.notFoundRoot}>
        <View style={styles.notFoundCard}>
          <Text style={styles.errorTitle}>{title}</Text>
          <Text style={styles.message}>{helper}</Text>
          <Pressable accessibilityRole="button" onPress={returnToDay} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>일정으로</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        initialRegion={defaultGooglePlaceSearchMapRegion}
        onPress={handleMapTap}
        onRegionChangeComplete={handleRegionChangeComplete}
        ref={mapRef}
        region={mapRegion}
        showsMyLocationButton={false}
        style={styles.map}
      >
        {markers.map((marker) => {
          const result = results.find((candidate) => candidate.id === marker.id);
          if (!result) {
            return null;
          }
          return (
            <Marker
              coordinate={marker.coordinate}
              key={`${marker.id}-${marker.category}-${marker.iconName}-${marker.selected ? 'selected' : 'default'}`}
              onPress={() => handleMarkerPress(result)}
              title={marker.title}
              tracksViewChanges
              zIndex={marker.selected ? 4 : 1}
            >
              <View
                style={[
                  styles.markerPin,
                  { backgroundColor: marker.selected ? selectedMarkerColor : markerCategoryColor(marker.category) },
                  marker.selected ? styles.markerPinSelected : null,
                ]}
              >
                <MarkerIcon iconName={marker.iconName} selected={marker.selected} />
              </View>
            </Marker>
          );
        })}
        {currentLocationMarker ? (
          <Marker
            coordinate={currentLocationMarker.coordinate}
            key={currentLocationMarker.id}
            title={currentLocationMarker.title}
            tracksViewChanges={false}
            zIndex={5}
          >
            <View style={styles.currentLocationMarkerOuter}>
              <View style={styles.currentLocationMarkerInner} />
            </View>
          </Marker>
        ) : null}
      </MapView>

      {showCurrentLocation ? (
        <Pressable
          accessibilityLabel="현재 위치로 이동"
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() => void moveToCurrentLocation()}
          style={[
            styles.locationButton,
            { bottom: Math.max(visibleSheetHeight + theme.space[4], theme.space[6]) },
            isBusy ? styles.floatingButtonDisabled : null,
          ]}
        >
          <LocateFixed color={theme.color.textBody} size={22} strokeWidth={2.4} />
        </Pressable>
      ) : null}

      {showRegionSearch ? (
        <Pressable
          accessibilityRole="button"
          onPress={runRegionSearch}
          style={[styles.regionSearchButton, { bottom: Math.max(visibleSheetHeight + theme.space[4], theme.space[6]) }]}
        >
          <Text style={styles.regionSearchButtonText}>이 지역에서 다시 검색</Text>
        </Pressable>
      ) : null}

      <GooglePlaceBottomSheet
        backgroundStyle={styles.sheetBackground}
        bottomInset={0}
        containerStyle={styles.sheetContainer}
        enablePanDownToClose={false}
        handleComponent={renderSheetHandle}
        index={sheetIndex}
        keyboardBehavior="interactive"
        onChange={handleBottomSheetChange}
        ref={bottomSheetRef}
        snapPoints={sheetSnapPoints}
        style={styles.sheet}
      >
        {sheetState !== 'minimized' ? (
          <GooglePlaceBottomSheetScrollView
            contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, theme.space[5]) }]}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={expandSheetFromScrollStart}
            ref={resultScrollRef}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.searchHeader}>
              <View style={styles.searchCopy}>
                <Text style={styles.sheetTitle}>장소 검색</Text>
                <Text style={styles.sheetHelper}>주소는 카드에 표시하지 않아요. 지도 핀으로 위치를 확인하세요.</Text>
              </View>
            </View>
            <View style={styles.searchRow}>
              <GooglePlaceBottomSheetTextInput
                autoCapitalize="none"
                editable={!isBusy}
                onChangeText={updateQuery}
                onFocus={focusSearchInput}
                onSubmitEditing={() => void runSearch()}
                placeholder="예: 도톤보리, 우메다 카페"
                placeholderTextColor={theme.color.textFaint}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() => void runSearch()}
                style={[styles.searchButton, isBusy ? styles.searchButtonDisabled : null]}
              >
                {isLoading ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
                <Text style={styles.searchButtonText}>{isLoading ? '검색 중' : '검색'}</Text>
              </Pressable>
            </View>

            {'message' in state && state.message ? (
              <Text style={state.status === 'minQuery' ? styles.fieldError : styles.sheetHelper}>{state.message}</Text>
            ) : null}
            {state.status === 'empty' ? <Text style={styles.message}>{state.message}</Text> : null}
            {state.status === 'error' ? (
              <View style={styles.noticeCard}>
                <Text style={styles.errorTitle}>{state.title}</Text>
                <Text style={styles.message}>{state.helper}</Text>
              </View>
            ) : null}
            {locationMessage ? <Text style={styles.sheetHelper}>{locationMessage}</Text> : null}

            {state.status === 'success' ? (
              <View style={styles.resultListContent}>
                {state.results.map((item) => (
                  <PlaceResultCard
                    addState={addState}
                    date={date}
                    detailsState={detailsState}
                    imageFailed={imageFailures[item.id] === true}
                    isBusy={isBusy}
                    isExpanded={selectedResult?.id === item.id}
                    isSelected={highlightedResultId === item.id}
                    key={item.id}
                    mapActionMessage={selectedResult?.id === item.id ? mapActionMessage : null}
                    addActionLabel={isSelectorMode ? '이 장소 선택' : '장소 추가'}
                    onAdd={() => void submitAdd(item, false)}
                    onCancelDuplicate={() => setAddState(idleGooglePlaceAddState())}
                    onConfirmDuplicate={() => void submitAdd(item, true)}
                    onImageError={() => setImageFailures((current) => ({ ...current, [item.id]: true }))}
                    onLayout={(y) => {
                      resultCardYByIdRef.current[item.id] = y;
                      if (pendingResultFocusIdRef.current === item.id) {
                        focusResultInList(item.id);
                      }
                    }}
                    onOpenMaps={(url) => void openGoogleMaps(url)}
                    onPress={() => selectResult(item, 'list')}
                    result={item}
                    tripId={tripId}
                  />
                ))}
              </View>
            ) : null}
          </GooglePlaceBottomSheetScrollView>
        ) : null}
      </GooglePlaceBottomSheet>
    </View>
  );
}

function PlaceResultCard({
  addActionLabel,
  addState,
  date,
  detailsState,
  imageFailed,
  isBusy,
  isExpanded,
  isSelected,
  mapActionMessage,
  onAdd,
  onCancelDuplicate,
  onConfirmDuplicate,
  onImageError,
  onLayout,
  onOpenMaps,
  onPress,
  result,
  tripId,
}: {
  addActionLabel: string;
  result: GooglePlaceSearchRowViewModel;
  tripId: string;
  date: string;
  detailsState: GooglePlaceDetailsViewState;
  addState: GooglePlaceAddViewState;
  isBusy: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  imageFailed: boolean;
  mapActionMessage: string | null;
  onAdd: () => void;
  onCancelDuplicate: () => void;
  onConfirmDuplicate: () => void;
  onPress: () => void;
  onImageError: () => void;
  onLayout: (y: number) => void;
  onOpenMaps: (url: string) => void;
}) {
  const detail =
    detailsState.status === 'success' && detailsState.googlePlaceId === result.id
      ? detailsState.detail
      : buildGooglePlaceExplorationDetail(result);
  const extraLabels = (result.metadataLabels ?? []).filter((label) => label !== result.typeHint);
  const isAddingThisResult = addState.status === 'adding' && addState.googlePlaceId === result.id;
  const isDuplicateConfirmationForThisResult =
    addState.status === 'confirmingDuplicate' && addState.result.id === result.id;

  return (
    <View
      onLayout={(event) => onLayout(event.nativeEvent.layout.y)}
      style={[
        styles.resultCard,
        isSelected ? styles.resultCardSelected : null,
        isExpanded ? styles.resultCardExpanded : null,
      ]}
    >
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.resultCardPressArea}>
        <PlacePhoto
          date={date}
          imageFailed={imageFailed}
          large={isExpanded}
          onImageError={onImageError}
          result={result}
          tripId={tripId}
        />
        <View style={styles.resultTextBlock}>
          <View style={styles.resultTitleRow}>
            <Text numberOfLines={isExpanded ? 3 : 2} style={styles.resultName}>
              {result.placeName}
            </Text>
            <Text style={styles.categoryPill}>{result.typeHint}</Text>
          </View>
          {extraLabels.length > 0 ? <Text style={styles.metadataText}>{extraLabels.join(' · ')}</Text> : null}
        </View>
      </Pressable>
      {isExpanded ? (
        <View style={styles.resultExpansion}>
          {detailsState.status === 'loading' && detailsState.googlePlaceId === result.id ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator color={theme.color.primary} />
              <Text style={styles.sheetHelper}>{detailsState.message}</Text>
            </View>
          ) : null}
          {detail.description ? <Text style={styles.description}>{detail.description}</Text> : null}
          {mapActionMessage ? <Text style={styles.fieldError}>{mapActionMessage}</Text> : null}
          {addState.status === 'error' ? (
            <View style={styles.noticeCard}>
              <Text style={styles.errorTitle}>장소를 추가할 수 없어요.</Text>
              <Text style={styles.message}>{addState.message}</Text>
            </View>
          ) : null}
          <View style={styles.inlineActionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onAdd}
              style={[styles.primaryButton, styles.inlineActionButton, isBusy ? styles.primaryButtonDisabled : null]}
            >
              {isAddingThisResult ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
              <Text style={styles.primaryButtonText}>{isAddingThisResult ? '추가 중...' : addActionLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenMaps(detail.mapUrl)}
              style={[styles.secondaryButton, styles.inlineActionButton]}
            >
              <Text style={styles.secondaryButtonText}>{detail.mapSearchLabel}</Text>
            </Pressable>
          </View>
          {isDuplicateConfirmationForThisResult ? (
            <DuplicateConfirmationCard
              addState={addState}
              isAdding={isAddingThisResult}
              isBusy={isBusy}
              onCancel={onCancelDuplicate}
              onConfirm={onConfirmDuplicate}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function PlacePhoto({
  date,
  imageFailed,
  large = false,
  onImageError,
  result,
  tripId,
}: {
  result: GooglePlaceSearchRowViewModel;
  tripId: string;
  date: string;
  imageFailed: boolean;
  large?: boolean;
  onImageError: () => void;
}) {
  const source =
    result.photo && !imageFailed
      ? buildGooglePlacePhotoImageSource(
          OpenAPI.BASE,
          tripId,
          date,
          result.photo.token,
          typeof OpenAPI.TOKEN === 'string' ? OpenAPI.TOKEN : null,
          googlePlacePhotoDefaultWidth,
        )
      : null;

  return (
    <View style={[styles.photoFrame, large ? styles.photoFrameLarge : null]}>
      {source ? <Image onError={onImageError} resizeMode="cover" source={source} style={styles.photoImage} /> : null}
      {!source ? (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>{result.typeHint}</Text>
        </View>
      ) : null}
      {result.photo?.attributionLabel ? (
        <Text numberOfLines={1} style={styles.photoAttribution}>
          사진: {result.photo.attributionLabel}
        </Text>
      ) : null}
    </View>
  );
}

function DuplicateConfirmationCard({
  addState,
  isAdding,
  isBusy,
  onCancel,
  onConfirm,
}: {
  addState: Extract<GooglePlaceAddViewState, { status: 'confirmingDuplicate' }>;
  isBusy: boolean;
  isAdding: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.noticeCard}>
      <Text style={styles.errorTitle}>이미 추가된 장소예요.</Text>
      <Text style={styles.message}>{addState.message}</Text>
      <View style={styles.detailActions}>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onConfirm}
          style={[styles.primaryButton, isBusy ? styles.primaryButtonDisabled : null]}
        >
          {isAdding ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
          <Text style={styles.primaryButtonText}>{isAdding ? '추가 중...' : '한 번 더 추가'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onCancel}
          style={[styles.secondaryButton, isBusy ? styles.secondaryButtonDisabled : null]}
        >
          <Text style={styles.secondaryButtonText}>취소</Text>
        </Pressable>
      </View>
    </View>
  );
}

const selectedMarkerColor = '#22C55E';

function MarkerIcon({ iconName, selected }: { iconName: GooglePlaceSearchMarkerIconName; selected: boolean }) {
  const iconColor = theme.color.onPrimary;
  const iconSize = selected ? 22 : 17;
  const strokeWidth = selected ? 2.8 : 2.5;
  switch (iconName) {
    case 'landmark':
      return <Landmark color={iconColor} size={iconSize} strokeWidth={strokeWidth} />;
    case 'utensils':
      return <Utensils color={iconColor} size={iconSize} strokeWidth={strokeWidth} />;
    case 'bed':
      return <BedDouble color={iconColor} size={iconSize} strokeWidth={strokeWidth} />;
    case 'coffee':
      return <Coffee color={iconColor} size={iconSize} strokeWidth={strokeWidth} />;
    case 'shopping-bag':
      return <ShoppingBag color={iconColor} size={iconSize} strokeWidth={strokeWidth} />;
    default:
      return <MapPin color={iconColor} size={iconSize} strokeWidth={strokeWidth} />;
  }
}

function markerCategoryColor(category: GooglePlaceSearchMarkerCategory): string {
  return theme.placeType[category].color;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  locationButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: theme.space[4],
    width: 48,
    zIndex: 2,
    ...theme.shadow.sm,
  },
  floatingButtonDisabled: {
    opacity: 0.55,
  },
  regionSearchButton: {
    alignSelf: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
    position: 'absolute',
    zIndex: 2,
    ...theme.shadow.md,
  },
  regionSearchButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  fallbackSheetContainer: {
    bottom: 0,
    justifyContent: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  fallbackSheetSurface: {
    overflow: 'hidden',
  },
  sheetContainer: {
    zIndex: 3,
  },
  sheet: {
    ...theme.shadow.lg,
  },
  sheetBackground: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius['2xl'],
    borderTopRightRadius: theme.radius['2xl'],
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingTop: theme.space[2],
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: theme.color.ink[200],
    borderRadius: 2,
    height: 4,
    width: 40,
  },
  sheetContent: {
    gap: theme.space[3],
    paddingHorizontal: theme.space[5],
  },
  searchHeader: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  searchCopy: {
    flex: 1,
  },
  sheetTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  sheetHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  searchRow: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  searchInput: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    minWidth: 74,
    paddingHorizontal: theme.space[4],
  },
  searchButtonDisabled: {
    backgroundColor: theme.color.textFaint,
  },
  searchButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  fieldError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    lineHeight: theme.font.size.label * theme.font.leading.normal,
    textAlign: 'center',
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  noticeCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  resultListContent: {
    gap: theme.space[3],
    paddingBottom: theme.space[5],
  },
  resultCard: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[3],
    width: '100%',
    ...theme.shadow.xs,
  },
  resultCardSelected: {
    borderColor: theme.color.primary,
    borderWidth: 2,
  },
  resultCardPressArea: {
    gap: theme.space[3],
  },
  resultCardExpanded: {
    backgroundColor: theme.color.surfaceSunken,
    gap: theme.space[4],
    padding: theme.space[4],
  },
  photoFrame: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.md,
    height: 104,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  photoFrameLarge: {
    height: 146,
  },
  photoImage: {
    height: '100%',
    width: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    backgroundColor: theme.color.primarySoft,
    flex: 1,
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  photoAttribution: {
    backgroundColor: 'rgba(26, 26, 23, 0.62)',
    bottom: 0,
    color: theme.color.textOnDark,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.micro,
    left: 0,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    position: 'absolute',
    right: 0,
  },
  resultTextBlock: {
    gap: theme.space[2],
  },
  resultTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  resultName: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
    minWidth: 120,
  },
  categoryPill: {
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.pill,
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
    overflow: 'hidden',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  metadataText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  description: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    lineHeight: theme.font.size.label * theme.font.leading.normal,
  },
  resultExpansion: {
    gap: theme.space[3],
  },
  detailActions: {
    gap: theme.space[2],
  },
  inlineActionRow: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  inlineActionButton: {
    flex: 1,
    paddingHorizontal: theme.space[3],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  primaryButtonDisabled: {
    backgroundColor: theme.color.textFaint,
  },
  primaryButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  secondaryButtonDisabled: {
    backgroundColor: theme.color.surfaceSunken,
  },
  secondaryButtonText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  markerPin: {
    alignItems: 'center',
    borderColor: theme.color.surface,
    borderRadius: 17,
    borderWidth: 3,
    height: 34,
    justifyContent: 'center',
    width: 34,
    ...theme.shadow.md,
  },
  markerPinSelected: {
    borderColor: theme.color.surface,
    borderWidth: 4,
    height: 46,
    width: 46,
    borderRadius: 23,
    transform: [{ translateY: -8 }],
  },
  markerPinText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  currentLocationMarkerOuter: {
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderColor: theme.color.surface,
    borderRadius: 17,
    borderWidth: 3,
    height: 34,
    justifyContent: 'center',
    width: 34,
    ...theme.shadow.sm,
  },
  currentLocationMarkerInner: {
    backgroundColor: '#F97316',
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  notFoundRoot: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  notFoundContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.space[7],
  },
  notFoundCard: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.sm,
  },
});
