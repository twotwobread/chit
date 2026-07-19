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
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import {
  BedDouble,
  Coffee,
  Heart,
  Landmark,
  LocateFixed,
  MapPin,
  ShoppingBag,
  TrainFront,
  Utensils,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, type Region } from 'react-native-maps';

import { ApiError, OpenAPI } from '@i-um/api-contract';

import { MobileAuthError } from '../auth/client';
import { theme } from '../design';
import { getGooglePlaceDetails, searchGooglePlaces } from '../places/client';
import {
  buildDefaultGooglePlaceDestinationSelection,
  buildGooglePlaceCurrentLocationMarkerViewModel,
  buildGooglePlaceDestinationChips,
  buildGooglePlaceDetailsErrorState,
  buildGooglePlaceDetailsIdleState,
  buildGooglePlaceDetailsLoadingState,
  buildGooglePlaceDetailsSuccessState,
  buildGooglePlaceExplorationDetail,
  buildGooglePlacePhotoImageSource,
  buildGooglePlaceSearchBiasFromRegion,
  buildGooglePlaceSearchBiasFromSource,
  buildGooglePlaceSearchFirstEntryLayoutState,
  buildGooglePlaceSearchInputState,
  buildGooglePlaceSearchMarkerPinStyle,
  buildGooglePlaceSearchMarkerScale,
  buildGooglePlaceSearchMarkerViewModels,
  buildGooglePlaceSearchResultActionView,
  buildGooglePlaceSearchRegionFromDestination,
  buildGooglePlaceSearchResultDistanceLabel,
  buildGooglePlaceSearchResultsRegion,
  buildGooglePlaceSearchResultsSectionTitle,
  buildGooglePlaceSearchSheetBookmarkListState,
  buildGooglePlaceSearchSheetLodgingListState,
  buildGooglePlaceSearchSheetIndex,
  buildGooglePlaceSearchSheetMetrics,
  buildGooglePlaceSearchSheetSnapPoints,
  buildGooglePlaceSearchSheetStateFromIndex,
  buildGooglePlaceSearchSheetTabs,
  buildGooglePlaceCurrentLocationBiasSource,
  buildGooglePlaceSelectedBiasSource,
  buildGooglePlaceSelectedMapRegion,
  canBookmarkGooglePlaceSearchResult,
  canSearchGooglePlaces,
  clearGooglePlaceSearchResultsState,
  defaultGooglePlaceSearchMapRegion,
  errorGooglePlaceSearchState,
  googlePlacePhotoDefaultWidth,
  googlePlaceSearchLoadingState,
  idleGooglePlaceAddState,
  normalizeGooglePlaceSearchQuery,
  resolveGooglePlaceSearchSelectionAfterResultsClose,
  resolveGooglePlaceSearchSheetState,
  resolveGooglePlaceSearchSheetTab,
  resolveGooglePlaceSearchSheetTopInset,
  isGooglePlaceCoordinateWithinTripDestination,
  shouldRenderGooglePlaceSearchResults,
  shouldShowGooglePlaceCurrentLocationButton,
  shouldShowGooglePlaceRegionSearchAction,
  successGooglePlaceSearchState,
  type GooglePlaceAddViewState,
  type GooglePlaceDetailsViewState,
  type GooglePlaceMapCoordinate,
  type GooglePlaceSearchMarkerIconName,
  type GooglePlaceSearchResultActionMode,
  type GooglePlaceSearchRowViewModel,
  type GooglePlaceSearchSelectionSource,
  type GooglePlaceTripDestination,
  type GooglePlaceSearchSheetState,
  type GooglePlaceSearchSheetTab,
  type GooglePlaceSearchViewState,
  type SearchBiasSource,
} from '../places/google-search';
import { resolveMapProvider, type MapProvider } from '../trips/map-provider';
import { DayChips, type DayChip } from './DayChips';
import { RouteMapOverlay, type RouteMapPlace, type RouteMapPolyline } from './RouteMap';

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
  enableDynamicSizing?: boolean;
  enablePanDownToClose?: boolean;
  handleComponent?: (() => ReactNode) | null;
  index: number;
  keyboardBehavior?: string;
  onChange?: (index: number) => void;
  topInset?: number;
  snapPoints: number[];
  style?: StyleProp<ViewStyle>;
};

type GooglePlaceSearchBottomSheetModule = {
  BottomSheetScrollView?: unknown;
  default?: unknown;
};

export type GooglePlaceMapSearchProps = {
  actionMode: GooglePlaceSearchResultActionMode;
  actionState?: GooglePlaceAddViewState;
  bookmarkResults?: GooglePlaceSearchRowViewModel[];
  bookmarkMarkerResults?: GooglePlaceSearchRowViewModel[];
  bottomSheetFooter?: ReactNode;
  dayId: string;
  favoriteActionState?: GooglePlaceAddViewState;
  lodgingResults?: GooglePlaceSearchRowViewModel[];
  lodgingMarkerResults?: GooglePlaceSearchRowViewModel[];
  lodgingEmptyAction?: { label: string; onPress: () => void };
  initialRegion?: Region | null;
  minimizedSheetBaseHeight?: number;
  notFoundAction?: { label: string; onPress: () => void };
  onBookmarkDeleteResult?: (result: GooglePlaceSearchRowViewModel) => void;
  onBookmarkSelectResult?: (result: GooglePlaceSearchRowViewModel) => void;
  onClearRoutePlaceSelection?: () => void;
  onPrimaryAction?: (result: GooglePlaceSearchRowViewModel, duplicateConfirmed: boolean) => void;
  onResetActionState?: () => void;
  onRouteChipPress?: (chipId: string) => void;
  onRoutePlacePress?: (place: RouteMapPlace) => void;
  routeChips?: DayChip[];
  routePlaces?: RouteMapPlace[];
  routePolylines?: RouteMapPolyline[];
  selectedBatchPlaceIds?: string[];
  selectedRouteChipIds?: string[];
  selectedRoutePlaceId?: string | null;
  sheetTopInset?: number;
  stickyFooter?: ReactNode;
  stickyFooterHeight?: number;
  style?: StyleProp<ViewStyle>;
  tripDestinations?: GooglePlaceTripDestination[];
  tripId: string;
};

function loadGooglePlaceSearchBottomSheetModule(): GooglePlaceSearchBottomSheetModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the native bottom-sheet stack is optional so Expo Go can fall back when RNGH initialization fails.
    return require('@gorhom/bottom-sheet') as GooglePlaceSearchBottomSheetModule;
  } catch {
    return null;
  }
}

function isCandidateSheetTab(
  tab: GooglePlaceSearchSheetTab,
): tab is Extract<GooglePlaceSearchSheetTab, 'bookmarks' | 'lodging'> {
  return tab === 'bookmarks' || tab === 'lodging';
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

export function GooglePlaceMapSearch({
  actionMode,
  actionState = idleGooglePlaceAddState(),
  bookmarkResults = [],
  bookmarkMarkerResults = bookmarkResults,
  bottomSheetFooter,
  dayId,
  favoriteActionState = idleGooglePlaceAddState(),
  initialRegion,
  lodgingMarkerResults = [],
  lodgingResults = [],
  lodgingEmptyAction,
  minimizedSheetBaseHeight,
  notFoundAction,
  onBookmarkDeleteResult,
  onBookmarkSelectResult,
  onClearRoutePlaceSelection,
  onPrimaryAction,
  onResetActionState,
  onRouteChipPress,
  onRoutePlacePress,
  routeChips = [],
  routePlaces = [],
  routePolylines,
  selectedBatchPlaceIds = [],
  selectedRouteChipIds = [],
  selectedRoutePlaceId,
  sheetTopInset,
  stickyFooter,
  stickyFooterHeight = 0,
  style,
  tripDestinations = [],
  tripId,
}: GooglePlaceMapSearchProps) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const mapProvider = useMemo(() => resolveMapProvider(tripDestinations), [tripDestinations]);
  const defaultDestinationId = useMemo(
    () => buildDefaultGooglePlaceDestinationSelection(tripDestinations),
    [tripDestinations],
  );
  const defaultTripDestination = useMemo(
    () =>
      defaultDestinationId
        ? (tripDestinations.find((destination) => destination.id === defaultDestinationId) ?? null)
        : null,
    [defaultDestinationId, tripDestinations],
  );
  const initialDestinationRegion = useMemo(
    () => (defaultTripDestination ? buildGooglePlaceSearchRegionFromDestination(defaultTripDestination) : null),
    [defaultTripDestination],
  );
  const mapRef = useRef<MapView | null>(null);
  const bottomSheetRef = useRef<GooglePlaceSearchBottomSheetHandle | null>(null);
  const resultScrollRef = useRef<GooglePlaceSearchScrollHandle | null>(null);
  const searchResultCardYByIdRef = useRef<Record<string, number>>({});
  const bookmarkResultCardYByIdRef = useRef<Record<string, number>>({});
  const pendingResultFocusRef = useRef<{ id: string; tab: GooglePlaceSearchSheetTab } | null>(null);
  const suppressNextRegionDirtyRef = useRef(false);
  const suppressNextMapTapRef = useRef(false);
  const defaultDestinationAppliedRef = useRef<string | null>(defaultDestinationId);
  const autoCurrentLocationRequestedRef = useRef(false);
  const initialMapRegion = initialRegion ?? initialDestinationRegion ?? defaultGooglePlaceSearchMapRegion;
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<GooglePlaceSearchViewState>(buildGooglePlaceSearchInputState(''));
  const [detailsState, setDetailsState] = useState<GooglePlaceDetailsViewState>(buildGooglePlaceDetailsIdleState());
  const [selectedResult, setSelectedResult] = useState<GooglePlaceSearchRowViewModel | null>(null);
  const [selectedResultSource, setSelectedResultSource] = useState<GooglePlaceSearchSelectionSource | null>(null);
  const [highlightedResultId, setHighlightedResultId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GooglePlaceMapCoordinate | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(initialMapRegion);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(defaultDestinationId);
  const [activeBiasSource, setActiveBiasSource] = useState<SearchBiasSource | null>(
    defaultDestinationId ? { kind: 'tripDestination', destinationId: defaultDestinationId } : null,
  );
  const [lastSearchBiasSource, setLastSearchBiasSource] = useState<SearchBiasSource | null>(activeBiasSource);
  const [regionDirty, setRegionDirty] = useState(false);
  const [sheetState, setSheetState] = useState<GooglePlaceSearchSheetState>('minimized');
  const [selectedSheetTab, setSelectedSheetTab] = useState<GooglePlaceSearchSheetTab>('bookmarks');
  const [activeCandidateMarkerTab, setActiveCandidateMarkerTab] = useState<Extract<
    GooglePlaceSearchSheetTab,
    'bookmarks' | 'lodging'
  > | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [mapActionMessage, setMapActionMessage] = useState<string | null>(null);
  const [imageFailures, setImageFailures] = useState<Record<string, true>>({});
  const isLoading = state.status === 'loading';
  const isActionBusy = actionState.status === 'adding';
  const isFavoriteBusy = favoriteActionState.status === 'adding';
  const isBusy = isLoading || isActionBusy;
  const selectedChipDestinationId =
    activeBiasSource?.kind === 'tripDestination'
      ? activeBiasSource.destinationId
      : activeBiasSource?.kind === 'mapRegion' ||
          activeBiasSource?.kind === 'currentLocation' ||
          activeBiasSource?.kind === 'selectedPlace'
        ? ''
        : selectedDestinationId;
  const destinationChips = useMemo(
    () => buildGooglePlaceDestinationChips(tripDestinations, selectedChipDestinationId),
    [selectedChipDestinationId, tripDestinations],
  );
  const hasDestinationChips = destinationChips.length > 0;

  const results = state.status === 'success' ? state.results : [];
  const sheetLayout = buildGooglePlaceSearchFirstEntryLayoutState(sheetState);
  const sheetContentVisible = sheetLayout.sheetContentVisible;
  const effectiveLodgingMarkerResults = useMemo(
    () => (lodgingMarkerResults.length > 0 ? lodgingMarkerResults : lodgingResults),
    [lodgingMarkerResults, lodgingResults],
  );
  const visibleBookmarkMarkerResults = useMemo(
    () => (activeCandidateMarkerTab === 'bookmarks' ? bookmarkMarkerResults : []),
    [activeCandidateMarkerTab, bookmarkMarkerResults],
  );
  const visibleLodgingMarkerResults = useMemo(
    () => (activeCandidateMarkerTab === 'lodging' ? effectiveLodgingMarkerResults : []),
    [activeCandidateMarkerTab, effectiveLodgingMarkerResults],
  );
  const visibleCandidateMarkerResults = useMemo(() => {
    if (selectedSheetTab === 'bookmarks') {
      return visibleBookmarkMarkerResults;
    }
    if (selectedSheetTab === 'lodging') {
      return visibleLodgingMarkerResults;
    }
    return [];
  }, [selectedSheetTab, visibleBookmarkMarkerResults, visibleLodgingMarkerResults]);
  const bookmarkMarkers = buildGooglePlaceSearchMarkerViewModels(visibleBookmarkMarkerResults, highlightedResultId, {
    selectedIds: selectedBatchPlaceIds,
    selectedVariant: selectedResultSource,
    variant: 'bookmark',
  });
  const lodgingMarkers = buildGooglePlaceSearchMarkerViewModels(visibleLodgingMarkerResults, highlightedResultId, {
    selectedIds: selectedBatchPlaceIds,
    selectedVariant: selectedResultSource,
    variant: 'lodging',
  });
  const markers = buildGooglePlaceSearchMarkerViewModels(results, highlightedResultId, {
    selectedIds: selectedBatchPlaceIds,
    selectedVariant: selectedResultSource,
    variant: 'search',
  });
  const currentLocationMarker = buildGooglePlaceCurrentLocationMarkerViewModel(currentLocation);
  const showRegionSearch = shouldShowGooglePlaceRegionSearchAction(query, regionDirty, isBusy, sheetState);
  const searchResultsSectionTitle =
    state.status === 'success'
      ? buildGooglePlaceSearchResultsSectionTitle(lastSearchBiasSource, tripDestinations)
      : null;
  const showCurrentLocation = shouldShowGooglePlaceCurrentLocationButton(sheetState);
  const sheetMetricHeight = containerHeight ?? window.height;
  const resolvedSheetTopInset = resolveGooglePlaceSearchSheetTopInset(sheetTopInset);
  const sheetMetrics = useMemo(
    () =>
      buildGooglePlaceSearchSheetMetrics(sheetMetricHeight, insets.bottom, {
        minimizedBaseHeight: minimizedSheetBaseHeight,
        topInset: resolvedSheetTopInset,
      }),
    [insets.bottom, minimizedSheetBaseHeight, resolvedSheetTopInset, sheetMetricHeight],
  );
  const sheetSnapPoints = useMemo(() => buildGooglePlaceSearchSheetSnapPoints(sheetMetrics), [sheetMetrics]);
  const sheetIndex = buildGooglePlaceSearchSheetIndex(sheetState);
  const visibleSheetHeight = sheetMetrics[`${sheetState}Height`];
  const visibleCandidateMarkerRegion = useMemo(() => {
    if (visibleCandidateMarkerResults.length === 0) {
      return null;
    }
    return buildGooglePlaceSearchResultsRegion(visibleCandidateMarkerResults, defaultGooglePlaceSearchMapRegion, {
      coveredBottomHeight: visibleSheetHeight,
      verticalPadding: theme.space[7],
      viewportHeight: sheetMetricHeight,
    });
  }, [sheetMetricHeight, visibleCandidateMarkerResults, visibleSheetHeight]);
  const renderSearchResults = shouldRenderGooglePlaceSearchResults(state);
  const sheetTabs = buildGooglePlaceSearchSheetTabs(selectedSheetTab);
  const bookmarkListState = buildGooglePlaceSearchSheetBookmarkListState(bookmarkResults);
  const lodgingListState = buildGooglePlaceSearchSheetLodgingListState(lodgingResults);
  const activeCandidateListState = selectedSheetTab === 'lodging' ? lodgingListState : bookmarkListState;
  const activeCandidateSelectionSource = selectedSheetTab === 'lodging' ? 'lodging' : 'bookmark';
  const stickyFooterPadding = stickyFooter ? Math.max(0, stickyFooterHeight) + theme.space[3] : 0;
  const showTopSearchClear =
    query.trim().length > 0 ||
    state.status === 'loading' ||
    state.status === 'success' ||
    state.status === 'empty' ||
    state.status === 'error';

  const resetActionState = useCallback(() => {
    onResetActionState?.();
  }, [onResetActionState]);

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

  useEffect(() => {
    if (sheetContentVisible && isCandidateSheetTab(selectedSheetTab)) {
      setActiveCandidateMarkerTab(selectedSheetTab);
    }
  }, [selectedSheetTab, sheetContentVisible]);

  useEffect(() => {
    if (!visibleCandidateMarkerRegion) {
      return;
    }
    suppressNextRegionDirtyRef.current = true;
    setMapRegion(visibleCandidateMarkerRegion);
    mapRef.current?.animateToRegion(visibleCandidateMarkerRegion, 280);
  }, [visibleCandidateMarkerRegion]);

  useEffect(() => {
    if (initialRegion || !defaultTripDestination || !defaultDestinationId) {
      return;
    }
    if (defaultDestinationAppliedRef.current === defaultDestinationId) {
      return;
    }

    const nextRegion = buildGooglePlaceSearchRegionFromDestination(defaultTripDestination);
    setSelectedDestinationId(defaultDestinationId);
    setActiveBiasSource({ kind: 'tripDestination', destinationId: defaultDestinationId });
    setRegionDirty(false);
    if (nextRegion) {
      suppressNextRegionDirtyRef.current = true;
      setMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 260);
    }
    defaultDestinationAppliedRef.current = defaultDestinationId;
  }, [defaultDestinationId, defaultTripDestination, initialRegion]);

  useEffect(() => {
    if (!initialRegion) {
      return;
    }
    suppressNextRegionDirtyRef.current = true;
    setMapRegion(initialRegion);
    mapRef.current?.animateToRegion(initialRegion, 260);
  }, [initialRegion]);

  useEffect(() => {
    if (initialRegion || !defaultTripDestination || autoCurrentLocationRequestedRef.current) {
      return;
    }
    autoCurrentLocationRequestedRef.current = true;

    let cancelled = false;
    const applyCurrentLocationIfInsideDestination = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED || cancelled) {
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        if (!isGooglePlaceCoordinateWithinTripDestination(nextLocation, defaultTripDestination) || cancelled) {
          return;
        }
        const nextSource = buildGooglePlaceCurrentLocationBiasSource(nextLocation);
        if (!nextSource) {
          return;
        }
        const nextRegion: Region = {
          ...nextLocation,
          latitudeDelta: Math.min(mapRegion.latitudeDelta, 0.03),
          longitudeDelta: Math.min(mapRegion.longitudeDelta, 0.03),
        };
        setCurrentLocation(nextLocation);
        setSelectedDestinationId(null);
        setActiveBiasSource(nextSource);
        setRegionDirty(false);
        suppressNextRegionDirtyRef.current = true;
        setMapRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 260);
      } catch {
        // Initial current-location preference is best-effort; fall back to the trip destination without noisy copy.
      }
    };

    void applyCurrentLocationIfInsideDestination();
    return () => {
      cancelled = true;
    };
  }, [defaultTripDestination, initialRegion, mapRegion.latitudeDelta, mapRegion.longitudeDelta]);

  const focusSearchInput = () => {
    setSelectedResult(null);
    setSelectedResultSource(null);
    setSelectedSheetTab('searchResults');
    setActiveCandidateMarkerTab(null);
    setHighlightedResultId(null);
    setDetailsState(buildGooglePlaceDetailsIdleState());
    setMapActionMessage(null);
    onClearRoutePlaceSelection?.();
    setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'searchInputFocus' }));
  };

  const expandSheetFromScrollStart = () => {
    setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'resultsScrollStart' }));
  };

  const focusResultInList = useCallback((resultId: string, tab: GooglePlaceSearchSheetTab) => {
    const y = (tab === 'searchResults' ? searchResultCardYByIdRef.current : bookmarkResultCardYByIdRef.current)[
      resultId
    ];
    if (!Number.isFinite(y)) {
      pendingResultFocusRef.current = { id: resultId, tab };
      return;
    }
    pendingResultFocusRef.current = null;
    resultScrollRef.current?.scrollTo({ y: Math.max(0, y - theme.space[3]), animated: true });
  }, []);

  useEffect(() => {
    const pending = pendingResultFocusRef.current;
    if (!highlightedResultId || !pending || pending.tab !== selectedSheetTab || !sheetContentVisible) {
      return;
    }
    const timer = setTimeout(() => focusResultInList(pending.id, pending.tab), 80);
    return () => clearTimeout(timer);
  }, [focusResultInList, highlightedResultId, selectedSheetTab, sheetContentVisible]);

  useEffect(() => {
    if (!tripId || !dayId || !selectedResult) {
      setDetailsState(buildGooglePlaceDetailsIdleState());
      return;
    }

    let cancelled = false;
    setDetailsState(buildGooglePlaceDetailsLoadingState(selectedResult.id));
    const loadDetails = async () => {
      try {
        const response = await getGooglePlaceDetails(tripId, dayId, selectedResult.id);
        if (!cancelled) {
          setDetailsState(buildGooglePlaceDetailsSuccessState(selectedResult, response, mapProvider));
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
  }, [dayId, mapProvider, selectedResult, tripId]);

  const buildMapRegionBiasSource = (): SearchBiasSource | null => {
    const regionBias = buildGooglePlaceSearchBiasFromRegion(mapRegion);
    return regionBias ? { kind: 'mapRegion', ...regionBias } : null;
  };

  const runSearch = async (biasSource?: SearchBiasSource | null) => {
    if (isBusy) {
      return;
    }
    if (!tripId || !dayId) {
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
    setSelectedResultSource(null);
    setSelectedSheetTab('searchResults');
    setActiveCandidateMarkerTab(null);
    setHighlightedResultId(null);
    setDetailsState(buildGooglePlaceDetailsIdleState());
    onClearRoutePlaceSelection?.();
    resetActionState();
    setState(googlePlaceSearchLoadingState());
    try {
      const searchBias = buildGooglePlaceSearchBiasFromSource(biasSource, tripDestinations);
      const response = await searchGooglePlaces(
        tripId,
        dayId,
        normalizeGooglePlaceSearchQuery(query),
        searchBias ?? undefined,
      );
      const nextState = successGooglePlaceSearchState(response.results);
      setLastSearchBiasSource(biasSource ?? null);
      setState(nextState);
      setSelectedSheetTab('searchResults');
      setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'searchResults' }));
      setRegionDirty(false);
      if (nextState.status === 'success') {
        const nextRegion = buildGooglePlaceSearchResultsRegion(nextState.results, mapRegion, {
          coveredBottomHeight: sheetMetrics.expandedHeight,
          verticalPadding: theme.space[7],
          viewportHeight: sheetMetricHeight,
        });
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

  const runActiveSearch = () => {
    const nextSource = activeBiasSource ?? buildMapRegionBiasSource();
    setActiveBiasSource(nextSource);
    void runSearch(nextSource);
  };

  const runRegionSearch = () => {
    const nextSource = buildMapRegionBiasSource();
    setSelectedDestinationId(null);
    setActiveBiasSource(nextSource);
    void runSearch(nextSource);
  };

  const selectDestinationChip = (destinationId: string) => {
    if (isBusy) {
      return;
    }
    const destination = tripDestinations.find((candidate) => candidate.id === destinationId);
    if (!destination) {
      return;
    }
    const nextRegion = buildGooglePlaceSearchRegionFromDestination(destination);
    setSelectedDestinationId(destinationId);
    setActiveBiasSource({ kind: 'tripDestination', destinationId });
    setRegionDirty(false);
    setLocationMessage(null);
    setMapActionMessage(null);
    if (nextRegion) {
      suppressNextRegionDirtyRef.current = true;
      setMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 260);
    }
  };

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    setSelectedResult(null);
    setSelectedResultSource(null);
    setSelectedSheetTab('searchResults');
    setActiveCandidateMarkerTab(null);
    setHighlightedResultId(null);
    setDetailsState(buildGooglePlaceDetailsIdleState());
    onClearRoutePlaceSelection?.();
    setRegionDirty(false);
    if (!isBusy) {
      resetActionState();
      setState(buildGooglePlaceSearchInputState(nextQuery));
    }
  };

  const selectResult = (
    result: GooglePlaceSearchRowViewModel,
    source: 'list' | 'marker',
    resultSource: GooglePlaceSearchSelectionSource,
  ) => {
    const nextTab = resolveGooglePlaceSearchSheetTab(selectedSheetTab, resultSource);
    setSelectedResult(result);
    setSelectedResultSource(resultSource);
    setSelectedSheetTab(nextTab);
    setActiveCandidateMarkerTab(isCandidateSheetTab(nextTab) ? nextTab : null);
    setHighlightedResultId(result.id);
    const selectedPlaceSource = buildGooglePlaceSelectedBiasSource(result);
    if (selectedPlaceSource) {
      setSelectedDestinationId(null);
      setActiveBiasSource(selectedPlaceSource);
      setRegionDirty(false);
    }
    if (resultSource === 'bookmark') {
      setQuery('');
      setState(clearGooglePlaceSearchResultsState(query));
    }
    if (source === 'marker') {
      pendingResultFocusRef.current = { id: result.id, tab: nextTab };
    }
    setSheetState((current) =>
      resolveGooglePlaceSearchSheetState(current, {
        kind: source === 'marker' ? 'markerPlaceSelect' : 'listPlaceSelect',
      }),
    );
    if (actionState.status !== 'adding') {
      resetActionState();
    }
    setMapActionMessage(null);
    onClearRoutePlaceSelection?.();
    const nextRegion = buildGooglePlaceSelectedMapRegion(result, mapRegion);
    if (nextRegion) {
      suppressNextRegionDirtyRef.current = true;
      setMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 260);
    }
    if (source === 'marker') {
      setTimeout(() => focusResultInList(result.id, nextTab), 0);
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
    setSelectedResult(null);
    setSelectedResultSource(null);
    setHighlightedResultId(null);
    setDetailsState(buildGooglePlaceDetailsIdleState());
    setMapActionMessage(null);
    onClearRoutePlaceSelection?.();
    setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'mapTap' }));
  };

  const handleMarkerPress = (result: GooglePlaceSearchRowViewModel, resultSource: GooglePlaceSearchSelectionSource) => {
    suppressNextMapTapRef.current = true;
    selectResult(result, 'marker', resultSource);
  };

  const handleRoutePlacePress = (place: RouteMapPlace) => {
    suppressNextMapTapRef.current = true;
    setSelectedResult(null);
    setSelectedResultSource(null);
    setSelectedSheetTab('searchResults');
    setActiveCandidateMarkerTab(null);
    setHighlightedResultId(null);
    setDetailsState(buildGooglePlaceDetailsIdleState());
    setMapActionMessage(null);
    setQuery('');
    setState(clearGooglePlaceSearchResultsState(query));
    const routePlaceSource = buildGooglePlaceSelectedBiasSource({
      id: place.id,
      placeName: place.name,
      address: '',
      typeHint: theme.placeType[place.type]?.label ?? '장소',
      latitude: place.latitude ?? undefined,
      longitude: place.longitude ?? undefined,
    });
    if (routePlaceSource) {
      setSelectedDestinationId(null);
      setActiveBiasSource(routePlaceSource);
      setRegionDirty(false);
    }
    onRoutePlacePress?.(place);
    setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'markerPlaceSelect' }));
  };

  const resolveBookmarkedResult = (result: GooglePlaceSearchRowViewModel) =>
    bookmarkResults.find((bookmark) => bookmark.id === result.id) ?? null;

  const handleResultFavoriteToggle = (result: GooglePlaceSearchRowViewModel) => {
    if (isFavoriteBusy) {
      return;
    }
    const bookmarkedResult = resolveBookmarkedResult(result);
    if (bookmarkedResult?.bookmarkId) {
      onBookmarkDeleteResult?.(bookmarkedResult);
      return;
    }
    onBookmarkSelectResult?.(result);
  };

  const handleResultPrimaryAction = (result: GooglePlaceSearchRowViewModel) => {
    if (actionMode === 'bookmark') {
      if (canBookmarkGooglePlaceSearchResult(result, bookmarkResults)) {
        onBookmarkSelectResult?.(result);
      }
      return;
    }
    onPrimaryAction?.(result, false);
  };

  const closeSearchResults = () => {
    const bookmarkSelection = resolveGooglePlaceSearchSelectionAfterResultsClose(selectedResult, bookmarkResults);
    setQuery('');
    setState(clearGooglePlaceSearchResultsState(query));
    setMapActionMessage(null);
    if (bookmarkSelection) {
      setSelectedResult(bookmarkSelection);
      setSelectedResultSource('bookmark');
      setSelectedSheetTab('bookmarks');
      setActiveCandidateMarkerTab('bookmarks');
      setHighlightedResultId(bookmarkSelection.id);
      onClearRoutePlaceSelection?.();
      setSheetState((current) => resolveGooglePlaceSearchSheetState(current, { kind: 'markerPlaceSelect' }));
      return;
    }
    setSelectedResult(null);
    setSelectedResultSource(null);
    setSelectedSheetTab('bookmarks');
    setActiveCandidateMarkerTab(null);
    setHighlightedResultId(null);
    setDetailsState(buildGooglePlaceDetailsIdleState());
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
      const nextSource = buildGooglePlaceCurrentLocationBiasSource(nextLocation);
      setCurrentLocation(nextLocation);
      if (nextSource) {
        setSelectedDestinationId(null);
        setActiveBiasSource(nextSource);
      }
      suppressNextRegionDirtyRef.current = true;
      setMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 260);
      setRegionDirty(false);
      setLocationMessage('현재 위치 기준으로 검색할게요. 검색 버튼을 눌러 주세요.');
    } catch {
      setLocationMessage('현재 위치를 가져오지 못했어요. 지도를 직접 이동해 주세요.');
    }
  };

  const openExternalMap = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setMapActionMessage('지도를 열지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (Number.isFinite(nextHeight) && Math.abs(nextHeight - (containerHeight ?? 0)) > 1) {
      setContainerHeight(nextHeight);
    }
  };

  if (state.status === 'notFound') {
    return (
      <ScrollView contentContainerStyle={styles.notFoundContent} style={styles.notFoundRoot}>
        <View style={styles.notFoundCard}>
          <Text style={styles.errorTitle}>{state.title}</Text>
          <Text style={styles.message}>{state.helper}</Text>
          {notFoundAction ? (
            <Pressable accessibilityRole="button" onPress={notFoundAction.onPress} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{notFoundAction.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <View onLayout={handleContainerLayout} style={[styles.root, style]}>
      <MapView
        initialRegion={initialMapRegion}
        onPress={handleMapTap}
        onRegionChangeComplete={handleRegionChangeComplete}
        ref={mapRef}
        region={mapRegion}
        showsMyLocationButton={false}
        style={styles.map}
      >
        <RouteMapOverlay
          onPlacePress={handleRoutePlacePress}
          places={routePlaces}
          polylines={routePolylines}
          selectedPlaceId={selectedRoutePlaceId}
        />
        {bookmarkMarkers.map((marker) => {
          const result = visibleBookmarkMarkerResults.find((candidate) => candidate.id === marker.id);
          if (!result) {
            return null;
          }
          const { badgeBackgroundColor, badgeColor, iconColor, ...markerPinStyle } =
            buildGooglePlaceSearchMarkerPinStyle(marker.category, marker.selected, marker.variant);
          const markerScale = buildGooglePlaceSearchMarkerScale(mapRegion, marker.selected);
          return (
            <Marker
              coordinate={marker.coordinate}
              key={`bookmark-${marker.id}-${marker.category}-${marker.selected ? 'selected' : 'default'}`}
              onPress={() => handleMarkerPress(result, 'bookmark')}
              title={`${marker.title} · 찜한 ${marker.categoryLabel}`}
              tracksViewChanges
              zIndex={marker.selected ? 5 : 1}
            >
              <View
                style={[
                  styles.markerPin,
                  markerPinStyle,
                  marker.selected ? styles.markerPinSelected : { transform: [{ scale: markerScale }] },
                ]}
              >
                <MarkerIcon color={iconColor} iconName={marker.iconName} selected={marker.selected} />
                {badgeBackgroundColor && badgeColor ? (
                  <View style={[styles.bookmarkMarkerBadge, { backgroundColor: badgeBackgroundColor }]}>
                    <Heart color={badgeColor} fill={badgeColor} size={10} strokeWidth={2.5} />
                  </View>
                ) : null}
              </View>
            </Marker>
          );
        })}
        {lodgingMarkers.map((marker) => {
          const result = visibleLodgingMarkerResults.find((candidate) => candidate.id === marker.id);
          if (!result) {
            return null;
          }
          const { iconColor, ...markerPinStyle } = buildGooglePlaceSearchMarkerPinStyle(
            marker.category,
            marker.selected,
            marker.variant,
          );
          const markerScale = buildGooglePlaceSearchMarkerScale(mapRegion, marker.selected);
          return (
            <Marker
              coordinate={marker.coordinate}
              key={`lodging-${marker.id}-${marker.category}-${marker.selected ? 'selected' : 'default'}`}
              onPress={() => handleMarkerPress(result, 'lodging')}
              title={`${marker.title} · 내 숙소`}
              tracksViewChanges
              zIndex={marker.selected ? 5 : 2}
            >
              <View
                style={[
                  styles.markerPin,
                  markerPinStyle,
                  marker.selected ? styles.markerPinSelected : { transform: [{ scale: markerScale }] },
                ]}
              >
                <MarkerIcon color={iconColor} iconName={marker.iconName} selected={marker.selected} />
              </View>
            </Marker>
          );
        })}
        {markers.map((marker) => {
          const result = results.find((candidate) => candidate.id === marker.id);
          if (!result) {
            return null;
          }
          const { iconColor, ...markerPinStyle } = buildGooglePlaceSearchMarkerPinStyle(
            marker.category,
            marker.selected,
            marker.variant,
          );
          const markerScale = buildGooglePlaceSearchMarkerScale(mapRegion, marker.selected);
          return (
            <Marker
              coordinate={marker.coordinate}
              key={`${marker.id}-${marker.category}-${marker.iconName}-${marker.selected ? 'selected' : 'default'}`}
              onPress={() => handleMarkerPress(result, 'search')}
              title={marker.title}
              tracksViewChanges
              zIndex={marker.selected ? 6 : 3}
            >
              <View
                style={[
                  styles.markerPin,
                  markerPinStyle,
                  marker.selected ? styles.markerPinSelected : { transform: [{ scale: markerScale }] },
                ]}
              >
                <MarkerIcon color={iconColor} iconName={marker.iconName} selected={marker.selected} />
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

      <View
        pointerEvents="box-none"
        style={[
          styles.topSearchOverlay,
          {
            paddingTop: theme.space[3],
          },
        ]}
      >
        <View style={styles.topSearchRow}>
          <TextInput
            accessibilityLabel="장소 검색어 입력"
            autoCapitalize="none"
            editable={!isBusy}
            onChangeText={updateQuery}
            onFocus={focusSearchInput}
            onSubmitEditing={runActiveSearch}
            placeholder="어디를 찾아볼까요?"
            placeholderTextColor={theme.color.textFaint}
            returnKeyType="search"
            style={styles.topSearchInput}
            value={query}
          />
          {showTopSearchClear ? (
            <Pressable
              accessibilityLabel="검색어 지우기"
              accessibilityRole="button"
              disabled={isBusy}
              onPress={closeSearchResults}
              style={[styles.topSearchClearButton, isBusy ? styles.topSearchClearButtonDisabled : null]}
            >
              <X color={theme.color.textMuted} size={17} strokeWidth={2.5} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="장소 검색"
            accessibilityRole="button"
            disabled={isBusy}
            onPress={runActiveSearch}
            style={[styles.topSearchButton, isBusy ? styles.searchButtonDisabled : null]}
          >
            {isLoading ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
            <Text style={styles.topSearchButtonText}>{isLoading ? '검색 중' : '검색'}</Text>
          </Pressable>
        </View>
        {routeChips.length > 0 ? (
          <View style={styles.topRouteChipRow}>
            <DayChips
              days={routeChips}
              edgePadding={0}
              onSelectDay={(chipId) => onRouteChipPress?.(chipId)}
              selectedDayIds={selectedRouteChipIds}
            />
          </View>
        ) : null}
      </View>

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
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        handleComponent={renderSheetHandle}
        index={sheetIndex}
        keyboardBehavior="interactive"
        onChange={handleBottomSheetChange}
        ref={bottomSheetRef}
        snapPoints={sheetSnapPoints}
        style={styles.sheet}
        topInset={resolvedSheetTopInset}
      >
        {sheetLayout.sheetContentVisible ? (
          <GooglePlaceBottomSheetScrollView
            contentContainerStyle={[
              styles.sheetContent,
              { paddingBottom: Math.max(insets.bottom, theme.space[5]) + stickyFooterPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={expandSheetFromScrollStart}
            ref={resultScrollRef}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.searchHeader}>
              <Text style={styles.sheetTitle}>{selectedSheetTab === 'searchResults' ? '검색 결과' : '장소'}</Text>
            </View>

            {selectedSheetTab === 'searchResults' ? (
              <>
                {hasDestinationChips ? (
                  <ScrollView
                    horizontal
                    keyboardShouldPersistTaps="handled"
                    showsHorizontalScrollIndicator={false}
                    style={styles.destinationChipScroller}
                  >
                    <View style={styles.destinationChipRow}>
                      {destinationChips.map((chip) => (
                        <Pressable
                          accessibilityLabel={chip.accessibilityLabel}
                          accessibilityRole="button"
                          accessibilityState={{ selected: chip.selected }}
                          disabled={isBusy}
                          key={chip.id}
                          onPress={() => selectDestinationChip(chip.id)}
                          style={[
                            styles.destinationChip,
                            chip.selected ? styles.destinationChipSelected : null,
                            isBusy ? styles.destinationChipDisabled : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.destinationChipText,
                              chip.selected ? styles.destinationChipTextSelected : null,
                            ]}
                          >
                            {chip.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}

                {'message' in state && state.message ? (
                  <Text style={state.status === 'minQuery' ? styles.fieldError : styles.sheetHelper}>
                    {state.message}
                  </Text>
                ) : null}
                {state.status === 'empty' ? <Text style={styles.message}>{state.message}</Text> : null}
                {state.status === 'error' ? (
                  <View style={styles.noticeCard}>
                    <Text style={styles.errorTitle}>{state.title}</Text>
                    <Text style={styles.message}>{state.helper}</Text>
                  </View>
                ) : null}
                {locationMessage ? <Text style={styles.sheetHelper}>{locationMessage}</Text> : null}

                {renderSearchResults ? (
                  <View style={styles.resultListContent}>
                    {searchResultsSectionTitle ? (
                      <Text style={styles.sectionTitle}>{searchResultsSectionTitle}</Text>
                    ) : null}
                    {state.results.map((item) => {
                      const bookmarkedResult = resolveBookmarkedResult(item);
                      return (
                        <PlaceResultCard
                          actionView={buildGooglePlaceSearchResultActionView({
                            addState: actionState,
                            bookmarkResults,
                            mode: actionMode,
                            result: item,
                            selectedBatchPlaceIds,
                          })}
                          basisDistanceLabel={buildGooglePlaceSearchResultDistanceLabel(
                            item,
                            lastSearchBiasSource,
                            tripDestinations,
                          )}
                          dayId={dayId}
                          detailsState={detailsState}
                          favoriteLoading={
                            favoriteActionState.status === 'adding' && favoriteActionState.googlePlaceId === item.id
                          }
                          favoriteSelected={Boolean(bookmarkedResult)}
                          imageFailed={imageFailures[item.id] === true}
                          isBusy={isBusy}
                          isExpanded={selectedResult?.id === item.id && selectedResultSource === 'search'}
                          isSelected={highlightedResultId === item.id && selectedResultSource === 'search'}
                          key={item.id}
                          mapActionMessage={selectedResult?.id === item.id ? mapActionMessage : null}
                          mapProvider={mapProvider}
                          onCancelDuplicate={resetActionState}
                          onConfirmDuplicate={() => onPrimaryAction?.(item, true)}
                          onDeleteBookmark={undefined}
                          onImageError={() => setImageFailures((current) => ({ ...current, [item.id]: true }))}
                          onLayout={(y) => {
                            searchResultCardYByIdRef.current[item.id] = y;
                            const pending = pendingResultFocusRef.current;
                            if (pending?.tab === 'searchResults' && pending.id === item.id) {
                              focusResultInList(item.id, 'searchResults');
                            }
                          }}
                          onOpenMaps={(url) => void openExternalMap(url)}
                          onPress={() => selectResult(item, 'list', 'search')}
                          onPrimaryAction={() => handleResultPrimaryAction(item)}
                          onToggleFavorite={
                            onBookmarkSelectResult || onBookmarkDeleteResult
                              ? () => handleResultFavoriteToggle(item)
                              : undefined
                          }
                          result={item}
                          tripId={tripId}
                        />
                      );
                    })}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.sheetTabRow}>
                  {sheetTabs.map((tab) => (
                    <Pressable
                      accessibilityLabel={tab.accessibilityLabel}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: tab.selected }}
                      key={tab.id}
                      onPress={() => {
                        setSelectedSheetTab(tab.id);
                        if (isCandidateSheetTab(tab.id)) {
                          setActiveCandidateMarkerTab(tab.id);
                        }
                      }}
                      style={[styles.sheetTab, tab.selected ? styles.sheetTabSelected : null]}
                    >
                      <Text style={[styles.sheetTabText, tab.selected ? styles.sheetTabTextSelected : null]}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.resultListContent}>
                  <View style={styles.bookmarkListHeader}>
                    <Text style={styles.sectionTitle}>{activeCandidateListState.title}</Text>
                  </View>
                  {activeCandidateListState.status === 'results'
                    ? activeCandidateListState.results.map((item) => (
                        <PlaceResultCard
                          actionView={buildGooglePlaceSearchResultActionView({
                            addState: actionState,
                            bookmarkResults,
                            mode: actionMode === 'bookmark' ? 'exploreOnly' : actionMode,
                            result: item,
                            selectedBatchPlaceIds,
                          })}
                          dayId={dayId}
                          detailsState={detailsState}
                          favoriteLoading={
                            favoriteActionState.status === 'adding' && favoriteActionState.googlePlaceId === item.id
                          }
                          favoriteSelected={selectedSheetTab === 'bookmarks' || Boolean(resolveBookmarkedResult(item))}
                          imageFailed={imageFailures[item.id] === true}
                          isBusy={isBusy}
                          isExpanded={
                            selectedResult?.id === item.id && selectedResultSource === activeCandidateSelectionSource
                          }
                          isSelected={
                            highlightedResultId === item.id && selectedResultSource === activeCandidateSelectionSource
                          }
                          key={`${selectedSheetTab}-list-${item.id}`}
                          mapActionMessage={selectedResult?.id === item.id ? mapActionMessage : null}
                          mapProvider={mapProvider}
                          onCancelDuplicate={resetActionState}
                          onConfirmDuplicate={() => onPrimaryAction?.(item, true)}
                          onDeleteBookmark={undefined}
                          onImageError={() => setImageFailures((current) => ({ ...current, [item.id]: true }))}
                          onLayout={(y) => {
                            bookmarkResultCardYByIdRef.current[item.id] = y;
                            const pending = pendingResultFocusRef.current;
                            if (pending?.tab === selectedSheetTab && pending.id === item.id) {
                              focusResultInList(item.id, selectedSheetTab);
                            }
                          }}
                          onOpenMaps={(url) => void openExternalMap(url)}
                          onPress={() => selectResult(item, 'list', activeCandidateSelectionSource)}
                          onPrimaryAction={() => handleResultPrimaryAction(item)}
                          onToggleFavorite={
                            onBookmarkSelectResult || onBookmarkDeleteResult
                              ? () => handleResultFavoriteToggle(item)
                              : undefined
                          }
                          result={item}
                          tripId={tripId}
                        />
                      ))
                    : null}
                  {activeCandidateListState.status === 'empty' && selectedSheetTab === 'lodging' ? (
                    <View style={styles.emptyCandidateCard}>
                      <Text style={styles.emptyCandidateTitle}>등록된 숙소가 없어요.</Text>
                      {lodgingEmptyAction ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={lodgingEmptyAction.onPress}
                          style={styles.emptyCandidateAction}
                        >
                          <Text style={styles.emptyCandidateActionText}>{lodgingEmptyAction.label}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </>
            )}
            {bottomSheetFooter}
          </GooglePlaceBottomSheetScrollView>
        ) : null}
      </GooglePlaceBottomSheet>
      {stickyFooter ? (
        <View style={[styles.stickyFooterContainer, { paddingBottom: insets.bottom }]}>{stickyFooter}</View>
      ) : null}
    </View>
  );
}

type PlaceResultActionView = ReturnType<typeof buildGooglePlaceSearchResultActionView>;

function PlaceResultCard({
  actionView,
  basisDistanceLabel,
  dayId,
  detailsState,
  favoriteLoading = false,
  favoriteSelected = false,
  imageFailed,
  isBusy,
  isExpanded,
  isSelected,
  mapActionMessage,
  mapProvider,
  onCancelDuplicate,
  onConfirmDuplicate,
  onDeleteBookmark,
  onImageError,
  onLayout,
  onOpenMaps,
  onPress,
  onPrimaryAction,
  onToggleFavorite,
  result,
  tripId,
}: {
  actionView: PlaceResultActionView;
  basisDistanceLabel?: string | null;
  result: GooglePlaceSearchRowViewModel;
  tripId: string;
  dayId: string;
  detailsState: GooglePlaceDetailsViewState;
  favoriteLoading?: boolean;
  favoriteSelected?: boolean;
  isBusy: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  imageFailed: boolean;
  mapActionMessage: string | null;
  mapProvider: MapProvider;
  onCancelDuplicate: () => void;
  onConfirmDuplicate: () => void;
  onDeleteBookmark?: () => void;
  onPrimaryAction: () => void;
  onPress: () => void;
  onToggleFavorite?: () => void;
  onImageError: () => void;
  onLayout: (y: number) => void;
  onOpenMaps: (url: string) => void;
}) {
  const detail =
    detailsState.status === 'success' && detailsState.googlePlaceId === result.id
      ? detailsState.detail
      : buildGooglePlaceExplorationDetail(result, undefined, mapProvider);
  const extraLabels = [
    basisDistanceLabel,
    ...(result.metadataLabels ?? []).filter((label) => label !== result.typeHint),
  ].filter((label): label is string => typeof label === 'string' && label.trim().length > 0);
  const actionButtonLabel = actionView.primaryAction?.isLoading
    ? actionView.primaryAction.loadingLabel
    : actionView.primaryAction?.label;
  const isPrimaryActionDisabled = isBusy || actionView.primaryAction?.disabled === true;
  const isPrimaryActionSelected = actionView.primaryAction?.label === '선택됨';

  return (
    <View
      onLayout={(event) => onLayout(event.nativeEvent.layout.y)}
      style={[
        styles.resultCard,
        isSelected ? styles.resultCardSelected : null,
        isExpanded ? styles.resultCardExpanded : null,
      ]}
    >
      <View style={styles.resultCardPressArea}>
        <Pressable accessibilityRole="button" onPress={onPress}>
          <PlacePhoto
            dayId={dayId}
            imageFailed={imageFailed}
            large={isExpanded}
            onImageError={onImageError}
            result={result}
            tripId={tripId}
          />
        </Pressable>
        <View style={styles.resultTextBlock}>
          <View style={styles.resultTitleRow}>
            <Pressable accessibilityRole="button" onPress={onPress} style={styles.resultTitlePressable}>
              <Text numberOfLines={isExpanded ? 3 : 2} style={styles.resultName}>
                {result.placeName}
              </Text>
            </Pressable>
            {onToggleFavorite ? (
              <Pressable
                accessibilityLabel={favoriteSelected ? '찜 해제' : '찜하기'}
                accessibilityRole="button"
                disabled={favoriteLoading}
                onPress={onToggleFavorite}
                style={[styles.favoriteButton, favoriteLoading ? styles.favoriteButtonDisabled : null]}
              >
                {favoriteLoading ? (
                  <ActivityIndicator color={theme.color.accent} size="small" />
                ) : (
                  <Heart
                    color={favoriteSelected ? theme.color.accent : theme.color.textMuted}
                    fill={favoriteSelected ? theme.color.accent : 'transparent'}
                    size={20}
                    strokeWidth={2.5}
                  />
                )}
              </Pressable>
            ) : null}
          </View>
          {extraLabels.length > 0 ? <Text style={styles.metadataText}>{extraLabels.join(' · ')}</Text> : null}
        </View>
        {actionView.primaryAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isPrimaryActionDisabled, selected: isPrimaryActionSelected }}
            disabled={isPrimaryActionDisabled}
            onPress={onPrimaryAction}
            style={[
              styles.resultPrimaryActionButton,
              isPrimaryActionSelected ? styles.resultPrimaryActionButtonSelected : null,
              isPrimaryActionDisabled ? styles.resultPrimaryActionButtonDisabled : null,
            ]}
          >
            {actionView.primaryAction.isLoading ? (
              <ActivityIndicator
                color={isPrimaryActionSelected ? theme.color.primary : theme.color.onPrimary}
                size="small"
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={[
                styles.resultPrimaryActionText,
                isPrimaryActionSelected ? styles.resultPrimaryActionTextSelected : null,
              ]}
            >
              {actionButtonLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
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
          {actionView.errorMessage ? (
            <View style={styles.noticeCard}>
              <Text style={styles.errorTitle}>장소를 추가할 수 없어요.</Text>
              <Text style={styles.message}>{actionView.errorMessage}</Text>
            </View>
          ) : null}
          <View style={styles.inlineActionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenMaps(detail.mapUrl)}
              style={[styles.secondaryButton, styles.inlineActionButton]}
            >
              <Text style={styles.secondaryButtonText}>{detail.mapSearchLabel}</Text>
            </Pressable>
            {onDeleteBookmark ? (
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={onDeleteBookmark}
                style={[
                  styles.secondaryButton,
                  styles.inlineActionButton,
                  isBusy ? styles.secondaryButtonDisabled : null,
                ]}
              >
                <Text style={styles.secondaryButtonText}>찜 해제</Text>
              </Pressable>
            ) : null}
          </View>
          {actionView.duplicateConfirmation ? (
            <DuplicateConfirmationCard
              confirmation={actionView.duplicateConfirmation}
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
  dayId,
  imageFailed,
  large = false,
  onImageError,
  result,
  tripId,
}: {
  result: GooglePlaceSearchRowViewModel;
  tripId: string;
  dayId: string;
  imageFailed: boolean;
  large?: boolean;
  onImageError: () => void;
}) {
  const source =
    result.photo && !imageFailed
      ? buildGooglePlacePhotoImageSource(
          OpenAPI.BASE,
          tripId,
          dayId,
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
  confirmation,
  isBusy,
  onCancel,
  onConfirm,
}: {
  confirmation: NonNullable<PlaceResultActionView['duplicateConfirmation']>;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.noticeCard}>
      <Text style={styles.errorTitle}>이미 추가된 장소예요.</Text>
      <Text style={styles.message}>{confirmation.message}</Text>
      <View style={styles.detailActions}>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onConfirm}
          style={[styles.primaryButton, isBusy ? styles.primaryButtonDisabled : null]}
        >
          {confirmation.isLoading ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
          <Text style={styles.primaryButtonText}>
            {confirmation.isLoading ? '추가 중...' : confirmation.confirmLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onCancel}
          style={[styles.secondaryButton, isBusy ? styles.secondaryButtonDisabled : null]}
        >
          <Text style={styles.secondaryButtonText}>{confirmation.cancelLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MarkerIcon({
  color,
  iconName,
  selected,
}: {
  color: string;
  iconName: GooglePlaceSearchMarkerIconName;
  selected: boolean;
}) {
  const iconSize = selected ? 22 : 17;
  const strokeWidth = selected ? 2.8 : 2.5;
  switch (iconName) {
    case 'landmark':
      return <Landmark color={color} size={iconSize} strokeWidth={strokeWidth} />;
    case 'utensils':
      return <Utensils color={color} size={iconSize} strokeWidth={strokeWidth} />;
    case 'bed':
      return <BedDouble color={color} size={iconSize} strokeWidth={strokeWidth} />;
    case 'coffee':
      return <Coffee color={color} size={iconSize} strokeWidth={strokeWidth} />;
    case 'shopping-bag':
      return <ShoppingBag color={color} size={iconSize} strokeWidth={strokeWidth} />;
    case 'train-front':
      return <TrainFront color={color} size={iconSize} strokeWidth={strokeWidth} />;
    default:
      return <MapPin color={color} size={iconSize} strokeWidth={strokeWidth} />;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topSearchOverlay: {
    gap: theme.space[2],
    left: 0,
    paddingHorizontal: theme.space[3],
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 4,
  },
  topSearchRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[2],
    minHeight: theme.layout.controlH,
    paddingLeft: theme.space[4],
    paddingRight: theme.space[2],
    ...theme.shadow.md,
  },
  topSearchInput: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    minHeight: theme.layout.controlH,
    paddingVertical: 0,
  },
  topSearchButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    minWidth: 64,
    paddingHorizontal: theme.space[4],
  },
  topSearchButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  topSearchClearButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
  },
  topSearchClearButtonDisabled: {
    opacity: 0.45,
  },
  topRouteChipRow: {
    marginHorizontal: -theme.space[1],
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
  stickyFooterContainer: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: theme.space[4],
    paddingTop: theme.space[3],
    position: 'absolute',
    right: 0,
    zIndex: 6,
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  searchCopy: {
    flex: 1,
  },
  sheetTabRow: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    gap: theme.space[1],
    padding: theme.space[1],
  },
  sheetTab: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    flex: 1,
    minHeight: theme.layout.controlHSm,
    justifyContent: 'center',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  sheetTabSelected: {
    backgroundColor: theme.color.surface,
    ...theme.shadow.xs,
  },
  sheetTabText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  sheetTabTextSelected: {
    color: theme.color.primary,
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
  destinationChipScroller: {
    marginHorizontal: -theme.space[1],
  },
  destinationChipRow: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.space[1],
  },
  destinationChip: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  destinationChipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  destinationChipDisabled: {
    opacity: 0.6,
  },
  destinationChipText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  destinationChipTextSelected: {
    color: theme.color.primary,
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
  categoryOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    justifyContent: 'center',
  },
  categoryOptionButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  resultListContent: {
    gap: theme.space[3],
    paddingBottom: theme.space[5],
  },
  bookmarkListHeader: {
    gap: theme.space[1],
  },
  emptyCandidateCard: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  emptyCandidateTitle: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  emptyCandidateAction: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[4],
  },
  emptyCandidateActionText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
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
    alignItems: 'center',
    flexDirection: 'row',
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
    height: 76,
    overflow: 'hidden',
    position: 'relative',
    width: 76,
  },
  photoFrameLarge: {
    height: 96,
    width: 96,
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
    backgroundColor: theme.color.ink[900],
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
    flex: 1,
    gap: theme.space[2],
    minWidth: 0,
  },
  resultTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  resultTitlePressable: {
    flex: 1,
  },
  resultName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  favoriteButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
  },
  favoriteButtonDisabled: {
    opacity: 0.48,
  },
  resultPrimaryActionButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[1],
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    minWidth: 66,
    paddingHorizontal: theme.space[3],
  },
  resultPrimaryActionButtonSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
    borderWidth: 2,
  },
  resultPrimaryActionButtonDisabled: {
    backgroundColor: theme.color.textFaint,
    borderColor: theme.color.textFaint,
  },
  resultPrimaryActionText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  resultPrimaryActionTextSelected: {
    color: theme.color.primary,
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
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  inlineActionButton: {
    flex: 1,
    minWidth: 120,
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
    borderRadius: 23,
    height: 46,
    transform: [{ translateY: -8 }],
    width: 46,
  },
  bookmarkMarkerBadge: {
    alignItems: 'center',
    borderColor: theme.color.surface,
    borderRadius: 8,
    borderWidth: 1,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -5,
    width: 16,
  },
  currentLocationMarkerOuter: {
    alignItems: 'center',
    backgroundColor: theme.color.accentSoft,
    borderColor: theme.color.surface,
    borderRadius: 17,
    borderWidth: 3,
    height: 34,
    justifyContent: 'center',
    width: 34,
    ...theme.shadow.sm,
  },
  currentLocationMarkerInner: {
    backgroundColor: theme.color.accent,
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
