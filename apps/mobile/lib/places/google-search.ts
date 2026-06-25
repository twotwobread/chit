import type { Href } from 'expo-router';

import type { CreateGooglePlaceDayItineraryItemRequest, GooglePlaceSearchResult } from '@i-um/api-contract';

export const googlePlaceSearchMinLength = 2;
export const googlePlaceSearchDefaultLimit = 5;
export const duplicateDayPlaceConfirmationCode = 'DUPLICATE_DAY_PLACE_CONFIRMATION_REQUIRED';
export const duplicateDayPlaceConfirmationMessage =
  '이미 이 Day에 추가된 장소입니다. 같은 장소를 한 번 더 일정에 추가할까요?';
export const googlePlaceAddFailureMessage = '장소를 추가할 수 없어요. 다시 검색한 뒤 시도해 주세요.';

export type GooglePlaceSearchStatus = 'initial' | 'minQuery' | 'loading' | 'empty' | 'error' | 'notFound' | 'success';

export type GooglePlaceSearchRowViewModel = {
  id: string;
  placeName: string;
  address: string;
  typeHint: string;
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
};

export function buildGooglePlaceSearchRoute(tripId: string, date: string): Href {
  return `/trips/${tripId}/days/${date}/place-search` as Href;
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

export function buildCreateGooglePlaceDayItineraryItemRequest(
  googlePlaceId: string,
  duplicateConfirmed: boolean,
): CreateGooglePlaceDayItineraryItemRequest {
  return { googlePlaceId: googlePlaceId.trim(), duplicateConfirmed };
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
    results: results.map((result) => ({
      id: result.googlePlaceId,
      placeName: result.displayName,
      address: result.formattedAddress,
      typeHint: getGooglePlaceTypeHint(result.primaryType),
    })),
  };
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
