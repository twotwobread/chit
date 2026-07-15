import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { theme } from '../design/theme';
import {
  addingGooglePlaceState,
  buildCreateGooglePlaceScheduleItemRequest,
  buildGooglePlaceExplorationDetail,
  buildGooglePlaceDetailsErrorState,
  buildGooglePlaceDetailsLoadingState,
  buildGooglePlaceDetailsSuccessState,
  buildGooglePlaceCurrentLocationMarkerViewModel,
  buildGooglePlacePhotoImageSource,
  buildDefaultGooglePlaceDestinationSelection,
  buildGooglePlaceDestinationChips,
  buildGooglePlacePhotoUrl,
  buildGooglePlaceSearchBiasFromRegion,
  buildGooglePlaceSearchBiasFromSource,
  buildGooglePlaceSearchInputState,
  buildGooglePlaceSearchRegionFromDestination,
  buildGooglePlaceSearchResultActionView,
  buildGooglePlaceSearchMarkerPinStyle,
  buildGooglePlaceSearchMarkerScale,
  buildGooglePlaceSearchMarkerViewModels,
  buildGooglePlaceSearchResultsRegion,
  buildGooglePlaceSearchRoute,
  buildGooglePlaceSearchSheetIndex,
  buildGooglePlaceSearchSheetMetrics,
  buildGooglePlaceSearchSheetSnapPoints,
  buildGooglePlaceSearchSheetStateFromIndex,
  buildGooglePlaceCurrentLocationBiasSource,
  buildGooglePlaceSearchResultDistanceLabel,
  buildGooglePlaceSearchResultsSectionTitle,
  buildGooglePlaceSelectedBiasSource,
  buildGooglePlaceSelectedMapRegion,
  canSearchGooglePlaces,
  clearGooglePlaceSearchResultsState,
  confirmingDuplicateGooglePlaceState,
  duplicateDayPlaceConfirmationMessage,
  errorGooglePlaceAddState,
  errorGooglePlaceSearchState,
  getGooglePlaceTypeHint,
  googlePlaceAddFailureMessage,
  googlePlaceSearchDefaultLimit,
  googlePlaceSearchDefaultSheetTopInset,
  googlePlaceSearchLoadingState,
  resolveGooglePlaceSearchSelectionAfterResultsClose,
  resolveGooglePlaceSearchSheetContentState,
  resolveGooglePlaceSearchSheetState,
  resolveGooglePlaceSearchSheetTopInset,
  shouldNavigateBackFromGooglePlaceDetailGesture,
  shouldRenderGooglePlaceBookmarkDetail,
  shouldRenderGooglePlaceSearchResults,
  shouldShowGooglePlaceCurrentLocationButton,
  shouldShowGooglePlaceRegionSearchAction,
  idleGooglePlaceAddState,
  isGooglePlaceCoordinateWithinTripDestination,
  isDuplicateDayPlaceConfirmationError,
  normalizeGooglePlaceSearchQuery,
  successGooglePlaceSearchState,
} from './google-search';

describe('google place search helpers', () => {
  it('builds the Day-scoped search route from trip id and date', () => {
    assert.equal(
      buildGooglePlaceSearchRoute('00000000-0000-0000-0000-000000000001', '2026-07-10'),
      '/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/place-search',
    );
  });

  it('uses ten results as the default map-search limit', () => {
    assert.equal(googlePlaceSearchDefaultLimit, 10);
  });

  it('normalizes and validates query length without calling API for short input', () => {
    assert.equal(normalizeGooglePlaceSearchQuery('  도톤보리  '), '도톤보리');
    assert.equal(canSearchGooglePlaces(' 도 '), false);
    assert.equal(canSearchGooglePlaces(' 도톤 '), true);
    assert.deepEqual(buildGooglePlaceSearchInputState(''), {
      status: 'initial',
      message: '장소 이름을 검색해 보세요.',
      results: [],
    });
    assert.deepEqual(buildGooglePlaceSearchInputState('도'), {
      status: 'minQuery',
      message: '두 글자 이상 입력해 주세요.',
      results: [],
    });
  });

  it('maps loading, empty, error, and not-found states', () => {
    assert.deepEqual(googlePlaceSearchLoadingState(), {
      status: 'loading',
      message: '장소를 검색하는 중...',
      results: [],
    });
    assert.deepEqual(successGooglePlaceSearchState([]), {
      status: 'empty',
      message: '검색 결과가 없어요. 다른 이름으로 검색해 주세요.',
      results: [],
    });
    assert.deepEqual(errorGooglePlaceSearchState(), {
      status: 'error',
      title: '장소를 검색할 수 없어요.',
      helper: '잠시 후 다시 시도해 주세요.',
      canRetry: true,
      results: [],
    });
    assert.deepEqual(errorGooglePlaceSearchState(404), {
      status: 'notFound',
      title: '일정을 찾을 수 없어요.',
      helper: '삭제되었거나 접근할 수 없는 여행 일정이에요.',
      results: [],
    });
  });

  it('builds add request and add states', () => {
    const result = { id: 'google-1', placeName: '도톤보리', address: 'Osaka', typeHint: '관광지' };

    assert.deepEqual(buildCreateGooglePlaceScheduleItemRequest(' google-1 ', false, ' 도톤보리 산책 '), {
      googlePlaceId: 'google-1',
      duplicateConfirmed: false,
      title: '도톤보리 산책',
    });
    assert.deepEqual(idleGooglePlaceAddState(), { status: 'idle' });
    assert.deepEqual(addingGooglePlaceState('google-1'), { status: 'adding', googlePlaceId: 'google-1' });
    assert.deepEqual(confirmingDuplicateGooglePlaceState(result), {
      status: 'confirmingDuplicate',
      result,
      message: duplicateDayPlaceConfirmationMessage,
    });
    assert.deepEqual(errorGooglePlaceAddState(), { status: 'error', message: googlePlaceAddFailureMessage });
  });

  it('resolves screen-specific result actions without exposing add or favorite actions in explore mode', () => {
    const result = { id: 'google-1', placeName: '도톤보리', address: 'Osaka', typeHint: '관광지' };

    assert.deepEqual(
      buildGooglePlaceSearchResultActionView({ addState: idleGooglePlaceAddState(), mode: 'exploreOnly', result }),
      {
        duplicateConfirmation: null,
        errorMessage: null,
        favoriteAction: null,
        primaryAction: null,
      },
    );
    assert.deepEqual(
      buildGooglePlaceSearchResultActionView({ addState: idleGooglePlaceAddState(), mode: 'scheduleAdd', result }),
      {
        duplicateConfirmation: null,
        errorMessage: null,
        favoriteAction: null,
        primaryAction: { isLoading: false, label: '장소 추가', loadingLabel: '추가 중...' },
      },
    );
    assert.deepEqual(
      buildGooglePlaceSearchResultActionView({ addState: idleGooglePlaceAddState(), mode: 'scheduleSelect', result }),
      {
        duplicateConfirmation: null,
        errorMessage: null,
        favoriteAction: null,
        primaryAction: { isLoading: false, label: '이 장소 선택', loadingLabel: '처리 중...' },
      },
    );
    assert.deepEqual(
      buildGooglePlaceSearchResultActionView({ addState: idleGooglePlaceAddState(), mode: 'bookmark', result }),
      {
        duplicateConfirmation: null,
        errorMessage: null,
        favoriteAction: null,
        primaryAction: { isLoading: false, label: '장소 찜하기', loadingLabel: '저장 중...' },
      },
    );
    assert.deepEqual(
      buildGooglePlaceSearchResultActionView({
        addState: addingGooglePlaceState('google-1'),
        mode: 'scheduleAdd',
        result,
      }).primaryAction,
      { isLoading: true, label: '장소 추가', loadingLabel: '추가 중...' },
    );
    assert.deepEqual(
      buildGooglePlaceSearchResultActionView({
        addState: confirmingDuplicateGooglePlaceState(result),
        mode: 'scheduleAdd',
        result,
      }).duplicateConfirmation,
      {
        cancelLabel: '취소',
        confirmLabel: '한 번 더 추가',
        isLoading: false,
        message: duplicateDayPlaceConfirmationMessage,
      },
    );
    assert.equal(
      buildGooglePlaceSearchResultActionView({ addState: errorGooglePlaceAddState(), mode: 'scheduleAdd', result })
        .errorMessage,
      googlePlaceAddFailureMessage,
    );
  });

  it('detects duplicate confirmation API errors', () => {
    assert.equal(
      isDuplicateDayPlaceConfirmationError({ error: { code: 'DUPLICATE_DAY_PLACE_CONFIRMATION_REQUIRED' } }),
      true,
    );
    assert.equal(isDuplicateDayPlaceConfirmationError({ error: { code: 'CONFLICT' } }), false);
    assert.equal(isDuplicateDayPlaceConfirmationError(undefined), false);
  });

  it('builds selected inline expansion data with description and Korean map action only', () => {
    assert.deepEqual(
      buildGooglePlaceExplorationDetail(
        {
          id: 'google-1',
          placeName: '우메다 카페',
          address: 'Umeda',
          typeHint: '카페',
          latitude: 34.7,
          longitude: 135.49,
          metadataLabels: ['카페', '평점 4.2 · 리뷰 842개', '영업 중'],
          googleMapsUri: 'https://maps.google.com/?cid=1',
        },
        { description: '쇼핑 동선 중 쉬어가기 좋은 스페셜티 커피 매장입니다.' },
      ),
      {
        id: 'google-1',
        placeName: '우메다 카페',
        address: 'Umeda',
        typeHint: '카페',
        latitude: 34.7,
        longitude: 135.49,
        metadataLabels: ['카페', '평점 4.2 · 리뷰 842개', '영업 중'],
        googleMapsUri: 'https://maps.google.com/?cid=1',
        description: '쇼핑 동선 중 쉬어가기 좋은 스페셜티 커피 매장입니다.',
        mapSearchLabel: '구글 지도에서 보기',
        mapUrl: 'https://maps.google.com/?cid=1',
      },
    );
  });

  it('builds server photo proxy URLs for lazy-loaded authenticated result images', () => {
    assert.equal(
      buildGooglePlacePhotoUrl('https://api.example.test/', 'trip-1', '2026-07-11', 'signed.token', 320),
      'https://api.example.test/trips/trip-1/days/2026-07-11/places/google/photos/signed.token?maxWidthPx=320',
    );
    assert.deepEqual(
      buildGooglePlacePhotoImageSource(
        'https://api.example.test/',
        'trip-1',
        '2026-07-11',
        'signed.token',
        'access-token',
        320,
      ),
      {
        uri: 'https://api.example.test/trips/trip-1/days/2026-07-11/places/google/photos/signed.token?maxWidthPx=320',
        headers: { Authorization: 'Bearer access-token' },
      },
    );
  });

  it('builds result row view models with no address label and optional rich metadata', () => {
    assert.deepEqual(
      successGooglePlaceSearchState([
        {
          googlePlaceId: 'google-1',
          displayName: '도톤보리',
          formattedAddress: 'Osaka',
          primaryType: 'tourist_attraction',
          primaryTypeDisplayName: '관광명소',
          latitude: 34.6687,
          longitude: 135.5013,
          rating: 4.5,
          userRatingCount: 12304,
          openNow: true,
          googleMapsUri: 'https://maps.google.com/?cid=1',
          photo: {
            token: 'signed-token',
            widthPx: 600,
            heightPx: 400,
            authorAttributions: [{ displayName: 'Google User', uri: 'https://maps.google.com/contrib/1' }],
          },
        },
        {
          googlePlaceId: 'google-2',
          displayName: '우메다 카페',
          formattedAddress: 'Umeda',
          primaryType: 'cafe',
          latitude: 34.7,
          longitude: 135.49,
        },
        {
          googlePlaceId: 'google-3',
          displayName: '간사이공항역',
          formattedAddress: 'Kansai Airport',
          primaryType: 'point_of_interest',
          placeType: 'transport',
          latitude: 34.4359,
          longitude: 135.2436,
        },
      ]),
      {
        status: 'success',
        results: [
          {
            id: 'google-1',
            placeName: '도톤보리',
            address: 'Osaka',
            typeHint: '관광명소',
            latitude: 34.6687,
            longitude: 135.5013,
            metadataLabels: ['관광명소', '평점 4.5 · 리뷰 12,304개', '영업 중'],
            googleMapsUri: 'https://maps.google.com/?cid=1',
            photo: {
              token: 'signed-token',
              widthPx: 600,
              heightPx: 400,
              attributionLabel: 'Google User',
            },
          },
          {
            id: 'google-2',
            placeName: '우메다 카페',
            address: 'Umeda',
            typeHint: '카페',
            latitude: 34.7,
            longitude: 135.49,
            metadataLabels: ['카페'],
          },
          {
            id: 'google-3',
            placeName: '간사이공항역',
            address: 'Kansai Airport',
            typeHint: '교통',
            latitude: 34.4359,
            longitude: 135.2436,
            metadataLabels: ['교통'],
          },
        ],
      },
    );
    assert.equal(getGooglePlaceTypeHint('airport'), '교통');
    assert.equal(getGooglePlaceTypeHint('subway_station'), '교통');
    assert.equal(getGooglePlaceTypeHint('unknown_google_type'), '장소');
  });

  it('builds category-aware markers and highlights the selected place', () => {
    assert.deepEqual(
      buildGooglePlaceSearchMarkerViewModels(
        [
          {
            id: 'google-1',
            placeName: '도톤보리',
            address: '',
            typeHint: '관광명소',
            latitude: 34.6687,
            longitude: 135.5013,
            metadataLabels: ['관광명소'],
          },
          {
            id: 'google-2',
            placeName: '우메다 카페',
            address: '',
            typeHint: '커피숍',
            latitude: 34.7,
            longitude: 135.49,
            metadataLabels: ['커피숍'],
          },
          {
            id: 'google-3',
            placeName: '라멘집',
            address: '',
            typeHint: '음식점',
            latitude: 34.69,
            longitude: 135.5,
            metadataLabels: ['음식점'],
          },
          {
            id: 'google-4',
            placeName: '호텔',
            address: '',
            typeHint: '호텔',
            latitude: 34.68,
            longitude: 135.48,
            metadataLabels: ['호텔'],
          },
          {
            id: 'google-5',
            placeName: '쇼핑몰',
            address: '',
            typeHint: '쇼핑몰',
            latitude: 34.67,
            longitude: 135.47,
            metadataLabels: ['쇼핑몰'],
          },
          {
            id: 'google-6',
            placeName: '간사이공항역',
            address: '',
            typeHint: '교통',
            latitude: 34.43,
            longitude: 135.24,
            metadataLabels: ['교통'],
          },
        ],
        'google-2',
      ).map(({ id, category, selected, iconName, emphasis }) => ({ id, category, selected, iconName, emphasis })),
      [
        { id: 'google-1', category: 'sights', selected: false, iconName: 'landmark', emphasis: 'normal' },
        { id: 'google-2', category: 'cafe', selected: true, iconName: 'coffee', emphasis: 'focused' },
        { id: 'google-3', category: 'food', selected: false, iconName: 'utensils', emphasis: 'normal' },
        { id: 'google-4', category: 'lodging', selected: false, iconName: 'bed', emphasis: 'normal' },
        { id: 'google-5', category: 'shopping', selected: false, iconName: 'shopping-bag', emphasis: 'normal' },
        { id: 'google-6', category: 'transport', selected: false, iconName: 'train-front', emphasis: 'normal' },
      ],
    );
  });

  it('inverts selected map marker fill while keeping category-colored border and icon', () => {
    assert.deepEqual(buildGooglePlaceSearchMarkerPinStyle('transport', false), {
      backgroundColor: theme.placeType.transport.color,
      borderColor: theme.color.surface,
      borderWidth: 3,
      iconColor: theme.color.onPrimary,
    });
    assert.deepEqual(buildGooglePlaceSearchMarkerPinStyle('food', false), {
      backgroundColor: theme.placeType.food.color,
      borderColor: theme.color.surface,
      borderWidth: 3,
      iconColor: theme.color.onPrimary,
    });
    assert.deepEqual(buildGooglePlaceSearchMarkerPinStyle('food', true), {
      backgroundColor: theme.color.surface,
      borderColor: theme.placeType.food.color,
      borderWidth: 4,
      iconColor: theme.placeType.food.color,
    });
  });

  it('builds category-visible bookmark markers with a distinct bookmark treatment', () => {
    const [marker] = buildGooglePlaceSearchMarkerViewModels(
      [
        {
          id: 'bookmark-hotel',
          bookmarkId: 'bookmark-1',
          placeName: '오사카 숙소',
          address: '',
          typeHint: '숙소',
          latitude: 34.68,
          longitude: 135.48,
          metadataLabels: ['숙소'],
        },
      ],
      'bookmark-hotel',
      { selectedVariant: 'bookmark', variant: 'bookmark' },
    );

    assert.deepEqual(
      marker && {
        category: marker.category,
        categoryLabel: marker.categoryLabel,
        iconName: marker.iconName,
        selected: marker.selected,
        variant: marker.variant,
      },
      {
        category: 'lodging',
        categoryLabel: '숙소',
        iconName: 'bed',
        selected: true,
        variant: 'bookmark',
      },
    );
    assert.deepEqual(buildGooglePlaceSearchMarkerPinStyle('lodging', false, 'bookmark'), {
      backgroundColor: theme.placeType.lodging.color,
      borderColor: theme.color.accent,
      borderWidth: 3,
      iconColor: theme.color.onPrimary,
      badgeBackgroundColor: theme.color.surface,
      badgeColor: theme.color.accent,
    });
  });

  it('scales only unselected markers down as the map zooms out', () => {
    assert.equal(
      buildGooglePlaceSearchMarkerScale(
        { latitude: 34.7, longitude: 135.5, latitudeDelta: 0.04, longitudeDelta: 0.04 },
        false,
      ),
      1,
    );
    assert.equal(
      buildGooglePlaceSearchMarkerScale(
        { latitude: 34.7, longitude: 135.5, latitudeDelta: 0.18, longitudeDelta: 0.18 },
        false,
      ),
      0.82,
    );
    assert.equal(
      buildGooglePlaceSearchMarkerScale(
        { latitude: 34.7, longitude: 135.5, latitudeDelta: 0.8, longitudeDelta: 0.8 },
        false,
      ),
      0.66,
    );
    assert.equal(
      buildGooglePlaceSearchMarkerScale(
        { latitude: 34.7, longitude: 135.5, latitudeDelta: 0.8, longitudeDelta: 0.8 },
        true,
      ),
      1,
    );
  });

  it('clears search-result UI while preserving matching bookmark detail context', () => {
    const selectedSearchResult = {
      id: 'google-hotel',
      placeName: '오사카 숙소',
      address: 'Osaka',
      typeHint: '숙소',
    };
    const matchingBookmark = { ...selectedSearchResult, bookmarkId: 'bookmark-1' };

    assert.deepEqual(clearGooglePlaceSearchResultsState(' 호텔 '), {
      status: 'initial',
      message: '장소 이름을 검색해 보세요.',
      results: [],
    });
    assert.equal(shouldRenderGooglePlaceSearchResults(successGooglePlaceSearchState([selectedSearchResult])), true);
    assert.equal(shouldRenderGooglePlaceSearchResults(clearGooglePlaceSearchResultsState('호텔')), false);
    assert.equal(shouldRenderGooglePlaceBookmarkDetail('bookmark', matchingBookmark), true);
    assert.equal(shouldRenderGooglePlaceBookmarkDetail('search', matchingBookmark), false);
    assert.deepEqual(
      resolveGooglePlaceSearchSelectionAfterResultsClose(selectedSearchResult, [matchingBookmark]),
      matchingBookmark,
    );
    assert.equal(resolveGooglePlaceSearchSelectionAfterResultsClose(selectedSearchResult, []), null);
  });

  it('builds map regions for fitting results and centering selected cards', () => {
    const results = [
      {
        id: 'google-1',
        placeName: '도톤보리',
        address: '',
        typeHint: '관광명소',
        latitude: 34.6687,
        longitude: 135.5013,
      },
      {
        id: 'google-2',
        placeName: '우메다 카페',
        address: '',
        typeHint: '카페',
        latitude: 34.7,
        longitude: 135.49,
      },
    ];

    assert.deepEqual(buildGooglePlaceSearchResultsRegion(results), {
      latitude: 34.68435,
      longitude: 135.49565,
      latitudeDelta: 0.05634,
      longitudeDelta: 0.02034,
    });
    assert.deepEqual(
      buildGooglePlaceSelectedMapRegion(results[1], {
        latitude: 34.68435,
        longitude: 135.49565,
        latitudeDelta: 0.09,
        longitudeDelta: 0.07,
      }),
      { latitude: 34.6934, longitude: 135.49, latitudeDelta: 0.03, longitudeDelta: 0.03 },
    );
  });

  it('fits search-result markers into the map area visible above the expanded search sheet', () => {
    const results = [
      {
        id: 'google-1',
        placeName: '도톤보리',
        address: '',
        typeHint: '관광명소',
        latitude: 34.6687,
        longitude: 135.5013,
      },
      {
        id: 'google-2',
        placeName: '우메다 카페',
        address: '',
        typeHint: '카페',
        latitude: 34.7,
        longitude: 135.49,
      },
    ];
    const viewportHeight = 800;
    const coveredBottomHeight = 448;
    const verticalPadding = 24;
    const region = buildGooglePlaceSearchResultsRegion(results, undefined, {
      coveredBottomHeight,
      verticalPadding,
      viewportHeight,
    });
    const markerYs = results.map(
      (result) =>
        ((region.latitude + region.latitudeDelta / 2 - (result.latitude as number)) / region.latitudeDelta) *
        viewportHeight,
    );

    assert.deepEqual(region, {
      latitude: 34.642836,
      longitude: 135.49565,
      latitudeDelta: 0.14826,
      longitudeDelta: 0.02034,
    });
    assert.ok(Math.min(...markerYs) >= verticalPadding);
    assert.ok(Math.max(...markerYs) <= viewportHeight - coveredBottomHeight - verticalPadding);
  });

  it('builds destination chips and defaults to the first saved trip city', () => {
    const destinations = [
      {
        id: 'destination-osaka',
        displayName: '오사카',
        latitude: 34.693725,
        longitude: 135.502254,
        radiusMeters: 30000,
      },
      {
        id: 'destination-kyoto',
        displayName: '교토',
        latitude: 35.011636,
        longitude: 135.768029,
        radiusMeters: 20000,
      },
      {
        id: 'destination-nara',
        displayName: '나라',
        latitude: 34.685087,
        longitude: 135.805,
        radiusMeters: 16000,
      },
    ];

    assert.equal(buildDefaultGooglePlaceDestinationSelection(destinations), 'destination-osaka');
    assert.deepEqual(buildGooglePlaceDestinationChips(destinations, null), [
      {
        id: 'destination-osaka',
        label: '오사카',
        selected: true,
        accessibilityLabel: '오사카 여행 도시 선택됨',
      },
      {
        id: 'destination-kyoto',
        label: '교토',
        selected: false,
        accessibilityLabel: '교토 여행 도시 선택',
      },
      {
        id: 'destination-nara',
        label: '나라',
        selected: false,
        accessibilityLabel: '나라 여행 도시 선택',
      },
    ]);
    assert.deepEqual(
      buildGooglePlaceDestinationChips(destinations, 'destination-kyoto').map((chip) => [chip.id, chip.selected]),
      [
        ['destination-osaka', false],
        ['destination-kyoto', true],
        ['destination-nara', false],
      ],
    );
    assert.equal(buildDefaultGooglePlaceDestinationSelection([]), null);
  });

  it('converts trip destination, map region, current-location, and selected-place sources to Google Places bias', () => {
    const destinations = [
      {
        id: 'destination-osaka',
        displayName: '오사카',
        latitude: 34.693725,
        longitude: 135.502254,
        radiusMeters: 30000,
      },
      {
        id: 'destination-kyoto',
        displayName: '교토',
        latitude: 35.011636,
        longitude: 135.768029,
        radiusMeters: 20000,
      },
    ];

    assert.deepEqual(buildGooglePlaceSearchRegionFromDestination(destinations[0]), {
      latitude: 34.693725,
      longitude: 135.502254,
      latitudeDelta: 0.53899,
      longitudeDelta: 0.65554,
    });
    assert.deepEqual(
      buildGooglePlaceSearchBiasFromSource(
        { kind: 'tripDestination', destinationId: 'destination-kyoto' },
        destinations,
      ),
      { latitude: 35.011636, longitude: 135.768029, radiusMeters: 20000 },
    );
    assert.deepEqual(
      buildGooglePlaceSearchBiasFromSource(
        { kind: 'mapRegion', latitude: 34.7, longitude: 135.5, radiusMeters: 5566 },
        destinations,
      ),
      { latitude: 34.7, longitude: 135.5, radiusMeters: 5566 },
    );
    assert.deepEqual(
      buildGooglePlaceSearchBiasFromSource(
        { kind: 'currentLocation', latitude: 34.71, longitude: 135.51, radiusMeters: 1000 },
        destinations,
      ),
      { latitude: 34.71, longitude: 135.51, radiusMeters: 1000 },
    );
    assert.deepEqual(
      buildGooglePlaceSearchBiasFromSource(
        {
          kind: 'selectedPlace',
          googlePlaceId: 'google-1',
          placeName: '우메다 카페',
          latitude: 34.7,
          longitude: 135.5,
          radiusMeters: 1000,
        },
        destinations,
      ),
      { latitude: 34.7, longitude: 135.5, radiusMeters: 1000 },
    );
    assert.equal(
      buildGooglePlaceSearchBiasFromSource({ kind: 'tripDestination', destinationId: 'missing' }, destinations),
      null,
    );
  });

  it('builds lightweight result-section titles without top-ten copy', () => {
    const destinations = [
      {
        id: 'destination-osaka',
        displayName: '오사카',
        latitude: 34.693725,
        longitude: 135.502254,
        radiusMeters: 30000,
      },
    ];

    assert.equal(
      buildGooglePlaceSearchResultsSectionTitle(
        { kind: 'tripDestination', destinationId: 'destination-osaka' },
        destinations,
      ),
      '오사카 주변 결과',
    );
    assert.equal(
      buildGooglePlaceSearchResultsSectionTitle(
        { kind: 'mapRegion', latitude: 34.7, longitude: 135.5, radiusMeters: 5566 },
        destinations,
      ),
      '현재 지도 영역 주변 결과',
    );
    assert.equal(
      buildGooglePlaceSearchResultsSectionTitle(
        { kind: 'currentLocation', latitude: 34.71, longitude: 135.51, radiusMeters: 1000 },
        destinations,
      ),
      '현재 위치 주변 결과',
    );
    assert.equal(
      buildGooglePlaceSearchResultsSectionTitle(
        {
          kind: 'selectedPlace',
          googlePlaceId: 'google-1',
          placeName: '우메다 카페',
          latitude: 34.7,
          longitude: 135.5,
          radiusMeters: 1000,
        },
        destinations,
      ),
      '우메다 카페 주변 결과',
    );
    assert.equal(buildGooglePlaceSearchResultsSectionTitle(null, destinations), '현재 지도 영역 주변 결과');
  });

  it('builds subtle per-result distance labels from the active search basis', () => {
    const result = {
      id: 'google-1',
      placeName: '우메다 카페',
      address: 'Umeda',
      typeHint: '카페',
      latitude: 34.711,
      longitude: 135.51,
    };
    const destinations = [
      {
        id: 'destination-osaka',
        displayName: '오사카',
        latitude: 34.693725,
        longitude: 135.502254,
        radiusMeters: 30000,
      },
    ];

    assert.equal(
      buildGooglePlaceSearchResultDistanceLabel(
        result,
        { kind: 'currentLocation', latitude: 34.71, longitude: 135.51, radiusMeters: 1000 },
        destinations,
      ),
      '현재 위치에서 110m',
    );
    assert.equal(
      buildGooglePlaceSearchResultDistanceLabel(
        result,
        {
          kind: 'selectedPlace',
          googlePlaceId: 'station-1',
          placeName: '우메다역',
          latitude: 34.711,
          longitude: 135.51,
          radiusMeters: 1000,
        },
        destinations,
      ),
      '우메다역에서 0m',
    );
    assert.equal(
      buildGooglePlaceSearchResultDistanceLabel(
        result,
        { kind: 'tripDestination', destinationId: 'destination-osaka' },
        destinations,
      ),
      '오사카 중심에서 2.0km',
    );
    assert.equal(
      buildGooglePlaceSearchResultDistanceLabel({ ...result, latitude: undefined }, null, destinations),
      null,
    );
  });

  it('builds selected-place nearby search sources only for coordinate-backed places', () => {
    const result = {
      id: 'google-1',
      placeName: ' 우메다 카페 ',
      address: 'Umeda',
      typeHint: '카페',
      latitude: 34.7,
      longitude: 135.5,
    };

    assert.deepEqual(buildGooglePlaceSelectedBiasSource(result), {
      kind: 'selectedPlace',
      googlePlaceId: 'google-1',
      placeName: '우메다 카페',
      latitude: 34.7,
      longitude: 135.5,
      radiusMeters: 1000,
    });
    assert.equal(buildGooglePlaceSelectedBiasSource({ ...result, latitude: Number.NaN }), null);
  });

  it('builds current-location search source and can detect whether it is inside the trip destination', () => {
    const destination = {
      id: 'destination-osaka',
      displayName: '오사카',
      latitude: 34.693725,
      longitude: 135.502254,
      radiusMeters: 30000,
    };
    const inside = { latitude: 34.71, longitude: 135.51 };
    const outside = { latitude: 35.6895, longitude: 139.6917 };

    assert.deepEqual(buildGooglePlaceCurrentLocationBiasSource(inside), {
      kind: 'currentLocation',
      latitude: 34.71,
      longitude: 135.51,
      radiusMeters: 1000,
    });
    assert.equal(isGooglePlaceCoordinateWithinTripDestination(inside, destination), true);
    assert.equal(isGooglePlaceCoordinateWithinTripDestination(outside, destination), false);
    assert.equal(buildGooglePlaceCurrentLocationBiasSource({ ...inside, latitude: Number.NaN }), null);
  });

  it('keeps map region search and destination chip search as switchable bias sources', () => {
    const destinations = [
      {
        id: 'destination-osaka',
        displayName: '오사카',
        latitude: 34.693725,
        longitude: 135.502254,
        radiusMeters: 30000,
      },
    ];
    const destinationSource = { kind: 'tripDestination' as const, destinationId: 'destination-osaka' };
    const mapRegionSource = { kind: 'mapRegion' as const, latitude: 35, longitude: 136, radiusMeters: 12000 };

    assert.deepEqual(buildGooglePlaceSearchBiasFromSource(destinationSource, destinations), {
      latitude: 34.693725,
      longitude: 135.502254,
      radiusMeters: 30000,
    });
    assert.deepEqual(buildGooglePlaceSearchBiasFromSource(mapRegionSource, destinations), {
      latitude: 35,
      longitude: 136,
      radiusMeters: 12000,
    });
    assert.deepEqual(buildGooglePlaceSearchBiasFromSource(destinationSource, destinations), {
      latitude: 34.693725,
      longitude: 135.502254,
      radiusMeters: 30000,
    });
  });

  it('builds explicit map-region search bias without auto-searching on pan', () => {
    assert.deepEqual(
      buildGooglePlaceSearchBiasFromRegion({ latitude: 0, longitude: 0, latitudeDelta: 0.1, longitudeDelta: 0.1 }),
      { latitude: 0, longitude: 0, radiusMeters: 5566 },
    );
    assert.deepEqual(
      buildGooglePlaceSearchBiasFromRegion({ latitude: 37.5, longitude: 127, latitudeDelta: 3, longitudeDelta: 3 }),
      { latitude: 37.5, longitude: 127, radiusMeters: 50000 },
    );
    assert.equal(shouldShowGooglePlaceRegionSearchAction(' 도톤보리 ', true, false, 'minimized'), true);
    assert.equal(shouldShowGooglePlaceRegionSearchAction('도', true, false, 'minimized'), false);
    assert.equal(shouldShowGooglePlaceRegionSearchAction('도톤보리', false, false, 'minimized'), false);
    assert.equal(shouldShowGooglePlaceRegionSearchAction('도톤보리', true, true, 'minimized'), false);
    assert.equal(shouldShowGooglePlaceRegionSearchAction('도톤보리', true, false, 'expanded'), false);
    assert.equal(shouldShowGooglePlaceRegionSearchAction('도톤보리', true, false, 'full'), false);
  });

  it('resolves the search sheet with handle focus, list scroll expansion, and map-tap-only minimization', () => {
    assert.equal(resolveGooglePlaceSearchSheetState('minimized', { kind: 'handleFocus' }), 'expanded');
    assert.equal(resolveGooglePlaceSearchSheetState('expanded', { kind: 'searchInputFocus' }), 'full');
    assert.equal(resolveGooglePlaceSearchSheetState('minimized', { kind: 'searchInputFocus' }), 'full');
    assert.equal(resolveGooglePlaceSearchSheetState('minimized', { kind: 'listPlaceSelect' }), 'minimized');
    assert.equal(resolveGooglePlaceSearchSheetState('expanded', { kind: 'listPlaceSelect' }), 'expanded');
    assert.equal(resolveGooglePlaceSearchSheetState('full', { kind: 'listPlaceSelect' }), 'full');
    assert.equal(resolveGooglePlaceSearchSheetState('minimized', { kind: 'markerPlaceSelect' }), 'expanded');
    assert.equal(resolveGooglePlaceSearchSheetState('expanded', { kind: 'markerPlaceSelect' }), 'expanded');
    assert.equal(resolveGooglePlaceSearchSheetState('full', { kind: 'markerPlaceSelect' }), 'expanded');
    assert.equal(resolveGooglePlaceSearchSheetState('full', { kind: 'searchResults' }), 'expanded');
    assert.equal(resolveGooglePlaceSearchSheetState('expanded', { kind: 'resultsScrollStart' }), 'full');
    assert.equal(resolveGooglePlaceSearchSheetState('full', { kind: 'resultsScrollStart' }), 'full');
    assert.equal(resolveGooglePlaceSearchSheetState('full', { kind: 'mapPan' }), 'full');
    assert.equal(resolveGooglePlaceSearchSheetState('full', { kind: 'mapTap' }), 'minimized');
    assert.equal(shouldShowGooglePlaceCurrentLocationButton('minimized'), true);
    assert.equal(shouldShowGooglePlaceCurrentLocationButton('expanded'), false);
    assert.equal(shouldShowGooglePlaceCurrentLocationButton('full'), false);
  });

  it('maps bottom-sheet library snap points and indices to sheet states', () => {
    const metrics = buildGooglePlaceSearchSheetMetrics(800, 24);

    assert.deepEqual(buildGooglePlaceSearchSheetSnapPoints(metrics), [80, 448, 608]);
    assert.equal(buildGooglePlaceSearchSheetIndex('minimized'), 0);
    assert.equal(buildGooglePlaceSearchSheetIndex('expanded'), 1);
    assert.equal(buildGooglePlaceSearchSheetIndex('full'), 2);
    assert.equal(buildGooglePlaceSearchSheetStateFromIndex(0), 'minimized');
    assert.equal(buildGooglePlaceSearchSheetStateFromIndex(1), 'expanded');
    assert.equal(buildGooglePlaceSearchSheetStateFromIndex(2), 'full');
    assert.equal(buildGooglePlaceSearchSheetStateFromIndex(-1), 'minimized');
    assert.equal(buildGooglePlaceSearchSheetStateFromIndex(99), 'full');
  });

  it('caps full sheet height below a reserved map overlay and supports a smaller minimized handle state', () => {
    const metrics = buildGooglePlaceSearchSheetMetrics(800, 24, {
      minimizedBaseHeight: 40,
      topInset: 240,
    });

    assert.deepEqual(buildGooglePlaceSearchSheetSnapPoints(metrics), [64, 448, 560]);
  });

  it('keeps focused full search sheet below the shared Day-chip reserved inset', () => {
    assert.equal(
      googlePlaceSearchDefaultSheetTopInset,
      theme.space[4] + theme.layout.controlHSm + theme.space[2] + theme.space[6],
    );
    assert.equal(
      resolveGooglePlaceSearchSheetTopInset(theme.space[4] + theme.layout.controlHSm + theme.space[4]),
      googlePlaceSearchDefaultSheetTopInset,
    );
    assert.equal(resolveGooglePlaceSearchSheetTopInset(120), 120);

    const metrics = buildGooglePlaceSearchSheetMetrics(280, 0, {
      minimizedBaseHeight: 40,
      topInset: theme.space[4] + theme.layout.controlHSm + theme.space[4],
    });

    assert.deepEqual(buildGooglePlaceSearchSheetSnapPoints(metrics), [40, 157, 208]);
  });

  it('builds a current-location marker after locating the user', () => {
    assert.deepEqual(buildGooglePlaceCurrentLocationMarkerViewModel({ latitude: 37.5665, longitude: 126.978 }), {
      id: 'current-location',
      coordinate: { latitude: 37.5665, longitude: 126.978 },
      title: '내 위치',
    });
    assert.equal(buildGooglePlaceCurrentLocationMarkerViewModel(null), null);
    assert.equal(buildGooglePlaceCurrentLocationMarkerViewModel({ latitude: Number.NaN, longitude: 126.978 }), null);
  });

  it('keeps selected places in the search results sheet for inline expansion', () => {
    const result = {
      id: 'google-1',
      placeName: '우메다 카페',
      address: 'Umeda',
      typeHint: '카페',
    };

    assert.equal(resolveGooglePlaceSearchSheetContentState(null), 'results');
    assert.equal(resolveGooglePlaceSearchSheetContentState(result), 'results');
    assert.equal(shouldNavigateBackFromGooglePlaceDetailGesture(72, 8), false);
  });

  it('maps selected-only detail loading success and error states', () => {
    const result = {
      id: 'google-1',
      placeName: '우메다 카페',
      address: 'Umeda',
      typeHint: '카페',
      latitude: 34.7,
      longitude: 135.49,
      metadataLabels: ['카페'],
    };

    assert.deepEqual(buildGooglePlaceDetailsLoadingState('google-1'), {
      status: 'loading',
      googlePlaceId: 'google-1',
      message: '장소 설명을 불러오는 중...',
    });
    assert.deepEqual(buildGooglePlaceDetailsSuccessState(result, { description: '대표 쇼핑몰 근처 카페입니다.' }), {
      status: 'success',
      googlePlaceId: 'google-1',
      detail: {
        ...result,
        description: '대표 쇼핑몰 근처 카페입니다.',
        mapSearchLabel: '구글 지도에서 보기',
        mapUrl:
          'https://www.google.com/maps/search/?api=1&query=%EC%9A%B0%EB%A9%94%EB%8B%A4%20%EC%B9%B4%ED%8E%98%20Umeda',
      },
    });
    assert.deepEqual(buildGooglePlaceDetailsErrorState('google-1'), {
      status: 'error',
      googlePlaceId: 'google-1',
      message: '장소 설명을 불러오지 못했어요. 구글 지도에서 자세한 정보를 확인해 주세요.',
    });
  });
});
