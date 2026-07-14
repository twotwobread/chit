import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { DestinationSearchResult, TripDestinationInput } from '@i-um/api-contract';

import { theme } from '../design/theme';
import {
  addTripDestination,
  buildCreateTripDestinations,
  destinationCountryMismatchConfirmation,
  buildDestinationSearchContentTopPadding,
  destinationKey,
  destinationSearchSubmitState,
  destinationSelectionStatus,
  removeTripDestination,
  tripDestinationInputFromSearchResult,
  validateTripDestinations,
} from './destinations';

const osaka: TripDestinationInput = {
  cityName: '오사카',
  countryName: '일본',
  countryCode: 'JP',
  displayName: '오사카, 일본',
  latitude: 34.6937,
  longitude: 135.5023,
  radiusMeters: 25000,
  provider: 'google',
  providerPlaceId: 'google-city-osaka',
};

const kyoto: TripDestinationInput = {
  cityName: '교토',
  countryName: '일본',
  countryCode: 'JP',
  displayName: '교토, 일본',
  latitude: 35.0116,
  longitude: 135.7681,
  radiusMeters: 20000,
  provider: 'google',
  providerPlaceId: 'google-city-kyoto',
};

const seoul: TripDestinationInput = {
  cityName: '서울',
  countryName: '대한민국',
  countryCode: 'KR',
  displayName: '서울, 대한민국',
  latitude: 37.5665,
  longitude: 126.978,
  radiusMeters: 25000,
  provider: 'google',
  providerPlaceId: 'google-city-seoul',
};

test('destinationKey uses provider identity for duplicate prevention', () => {
  assert.equal(destinationKey(osaka), 'google:google-city-osaka');
});

test('addTripDestination appends new destinations and prevents duplicates', () => {
  const first = addTripDestination([], osaka);
  assert.deepEqual(first, [osaka]);
  assert.strictEqual(addTripDestination(first, { ...osaka }), first);
  assert.deepEqual(addTripDestination(first, kyoto), [osaka, kyoto]);
});

test('addTripDestination keeps max five destinations and returns disabled status copy', () => {
  const selected = [0, 1, 2, 3, 4].map((index) => ({ ...osaka, providerPlaceId: `google-${index}` }));
  assert.strictEqual(addTripDestination(selected, kyoto), selected);
  assert.deepEqual(destinationSelectionStatus(selected), {
    count: 5,
    canAddMore: false,
    helperText: '여행 도시는 최대 5개까지 선택할 수 있어요.',
  });
});

test('removeTripDestination removes by provider identity without mutating other selections', () => {
  assert.deepEqual(removeTripDestination([osaka, kyoto], destinationKey(osaka)), [kyoto]);
});

test('destinationSearchSubmitState enables an explicit search action only for trimmed two-character queries', () => {
  assert.deepEqual(destinationSearchSubmitState(' 오 ', false), {
    query: '오',
    canSearch: false,
    buttonLabel: '검색',
    helperText: '도시 이름을 2글자 이상 입력해주세요.',
  });
  assert.deepEqual(destinationSearchSubmitState(' 오사카 ', false), {
    query: '오사카',
    canSearch: true,
    buttonLabel: '검색',
    helperText: null,
  });
  assert.deepEqual(destinationSearchSubmitState('오사카', true), {
    query: '오사카',
    canSearch: false,
    buttonLabel: '검색 중',
    helperText: null,
  });
});

test('destination search content keeps the travel-registration search header below the top safe area', () => {
  assert.equal(buildDestinationSearchContentTopPadding(0), theme.space[7]);
  assert.equal(buildDestinationSearchContentTopPadding(47), theme.space[7] + 47);
  assert.equal(buildDestinationSearchContentTopPadding(-8), theme.space[7]);
});

test('destinationCountryMismatchConfirmation warns when adding a city from another country without blocking it', () => {
  assert.equal(destinationCountryMismatchConfirmation([], seoul), null);
  assert.equal(destinationCountryMismatchConfirmation([osaka], kyoto), null);
  assert.deepEqual(destinationCountryMismatchConfirmation([osaka], seoul), {
    title: '다른 국가의 도시예요.',
    message: '이미 선택한 도시와 국가가 달라요. 서울, 대한민국을 같은 여행 도시로 추가할까요?',
    confirmLabel: '그래도 추가',
    cancelLabel: '취소',
  });
});

test('validateTripDestinations requires at least one selected destination', () => {
  assert.equal(validateTripDestinations([]), '여행 도시를 1개 이상 선택해주세요.');
  assert.equal(validateTripDestinations([osaka]), null);
});

test('buildCreateTripDestinations preserves append order for representative city', () => {
  const destinations = buildCreateTripDestinations([osaka, kyoto]);
  assert.deepEqual(destinations, [osaka, kyoto]);
  assert.equal(destinations[0].displayName, '오사카, 일본');
});

test('tripDestinationInputFromSearchResult maps server search result to create request item', () => {
  const result: DestinationSearchResult = {
    cityName: '나라',
    countryName: '일본',
    countryCode: 'JP',
    displayName: '나라, 일본',
    latitude: 34.6851,
    longitude: 135.8048,
    radiusMeters: 15000,
    provider: 'google',
    providerPlaceId: 'google-city-nara',
  };

  assert.deepEqual(tripDestinationInputFromSearchResult(result), {
    cityName: '나라',
    countryName: '일본',
    countryCode: 'JP',
    displayName: '나라, 일본',
    latitude: 34.6851,
    longitude: 135.8048,
    radiusMeters: 15000,
    provider: 'google',
    providerPlaceId: 'google-city-nara',
  });
});
