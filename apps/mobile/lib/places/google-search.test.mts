import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addingGooglePlaceState,
  buildCreateGooglePlaceScheduleItemRequest,
  buildGooglePlaceExplorationDetail,
  buildGooglePlaceDetailsErrorState,
  buildGooglePlaceDetailsLoadingState,
  buildGooglePlaceDetailsSuccessState,
  buildGooglePlaceCurrentLocationMarkerViewModel,
  buildGooglePlacePhotoImageSource,
  buildGooglePlacePhotoUrl,
  buildGooglePlaceSearchBiasFromRegion,
  buildGooglePlaceSearchInputState,
  buildGooglePlaceSearchMarkerViewModels,
  buildGooglePlaceSearchResultsRegion,
  buildGooglePlaceSearchRoute,
  buildGooglePlaceSearchSheetIndex,
  buildGooglePlaceSearchSheetMetrics,
  buildGooglePlaceSearchSheetSnapPoints,
  buildGooglePlaceSearchSheetStateFromIndex,
  buildGooglePlaceSelectedMapRegion,
  canSearchGooglePlaces,
  confirmingDuplicateGooglePlaceState,
  duplicateDayPlaceConfirmationMessage,
  errorGooglePlaceAddState,
  errorGooglePlaceSearchState,
  getGooglePlaceTypeHint,
  googlePlaceAddFailureMessage,
  googlePlaceSearchDefaultLimit,
  googlePlaceSearchLoadingState,
  resolveGooglePlaceSearchSheetContentState,
  resolveGooglePlaceSearchSheetState,
  shouldNavigateBackFromGooglePlaceDetailGesture,
  shouldShowGooglePlaceCurrentLocationButton,
  shouldShowGooglePlaceRegionSearchAction,
  idleGooglePlaceAddState,
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

  it('detects duplicate confirmation API errors', () => {
    assert.equal(
      isDuplicateDayPlaceConfirmationError({ error: { code: 'DUPLICATE_DAY_PLACE_CONFIRMATION_REQUIRED' } }),
      true,
    );
    assert.equal(isDuplicateDayPlaceConfirmationError({ error: { code: 'CONFLICT' } }), false);
    assert.equal(isDuplicateDayPlaceConfirmationError(undefined), false);
  });

  it('builds selected inline expansion data with description and Google Maps action only', () => {
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
        mapSearchLabel: 'Google Maps',
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
        ],
      },
    );
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
        ],
        'google-2',
      ).map(({ id, category, selected, iconName, emphasis }) => ({ id, category, selected, iconName, emphasis })),
      [
        { id: 'google-1', category: 'sights', selected: false, iconName: 'landmark', emphasis: 'normal' },
        { id: 'google-2', category: 'cafe', selected: true, iconName: 'coffee', emphasis: 'focused' },
        { id: 'google-3', category: 'food', selected: false, iconName: 'utensils', emphasis: 'normal' },
        { id: 'google-4', category: 'lodging', selected: false, iconName: 'bed', emphasis: 'normal' },
        { id: 'google-5', category: 'shopping', selected: false, iconName: 'shopping-bag', emphasis: 'normal' },
      ],
    );
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
        mapSearchLabel: 'Google Maps',
        mapUrl:
          'https://www.google.com/maps/search/?api=1&query=%EC%9A%B0%EB%A9%94%EB%8B%A4%20%EC%B9%B4%ED%8E%98%20Umeda',
      },
    });
    assert.deepEqual(buildGooglePlaceDetailsErrorState('google-1'), {
      status: 'error',
      googlePlaceId: 'google-1',
      message: '장소 설명을 불러오지 못했어요. Google Maps에서 자세한 정보를 확인해 주세요.',
    });
  });
});
