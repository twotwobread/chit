import type { DestinationSearchResult, TripDestinationInput } from '@i-um/api-contract';

export const tripDestinationMinCountCopy = '여행 도시를 1개 이상 선택해주세요.';
export const tripDestinationMaxCountCopy = '여행 도시는 최대 5개까지 선택할 수 있어요.';
export const tripDestinationSearchMinQueryCopy = '도시 이름을 2글자 이상 입력해주세요.';
export const tripDestinationMaxCount = 5;

export type DestinationSelectionStatus = {
  count: number;
  canAddMore: boolean;
  helperText: string | null;
};

export type DestinationSearchSubmitState = {
  query: string;
  canSearch: boolean;
  buttonLabel: string;
  helperText: string | null;
};

export type DestinationCountryMismatchConfirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
};

export function destinationKey(destination: Pick<TripDestinationInput, 'provider' | 'providerPlaceId'>): string {
  return `${destination.provider}:${destination.providerPlaceId}`;
}

export function addTripDestination(
  selected: TripDestinationInput[],
  destination: TripDestinationInput,
): TripDestinationInput[] {
  if (selected.length >= tripDestinationMaxCount) {
    return selected;
  }
  const key = destinationKey(destination);
  if (selected.some((item) => destinationKey(item) === key)) {
    return selected;
  }
  return [...selected, destination];
}

export function removeTripDestination(selected: TripDestinationInput[], key: string): TripDestinationInput[] {
  return selected.filter((item) => destinationKey(item) !== key);
}

export function destinationSelectionStatus(selected: TripDestinationInput[]): DestinationSelectionStatus {
  const canAddMore = selected.length < tripDestinationMaxCount;
  return {
    count: selected.length,
    canAddMore,
    helperText: canAddMore ? null : tripDestinationMaxCountCopy,
  };
}

export function destinationSearchSubmitState(query: string, loading: boolean): DestinationSearchSubmitState {
  const trimmedQuery = query.trim();
  const hasMinimumQuery = trimmedQuery.length >= 2;
  return {
    query: trimmedQuery,
    canSearch: hasMinimumQuery && !loading,
    buttonLabel: loading ? '검색 중' : '검색',
    helperText: hasMinimumQuery ? null : tripDestinationSearchMinQueryCopy,
  };
}

export function destinationCountryMismatchConfirmation(
  selected: Pick<TripDestinationInput, 'countryCode'>[],
  candidate: Pick<TripDestinationInput, 'countryCode' | 'displayName'>,
): DestinationCountryMismatchConfirmation | null {
  const candidateCountryCode = candidate.countryCode.trim().toUpperCase();
  if (selected.length === 0 || candidateCountryCode === '') {
    return null;
  }
  const hasDifferentCountry = selected.some(
    (destination) => destination.countryCode.trim().toUpperCase() !== candidateCountryCode,
  );
  if (!hasDifferentCountry) {
    return null;
  }
  return {
    title: '다른 국가의 도시예요.',
    message: `이미 선택한 도시와 국가가 달라요. ${candidate.displayName}을 같은 여행 도시로 추가할까요?`,
    confirmLabel: '그래도 추가',
    cancelLabel: '취소',
  };
}

export function validateTripDestinations(selected: TripDestinationInput[]): string | null {
  return selected.length > 0 ? null : tripDestinationMinCountCopy;
}

export function buildCreateTripDestinations(selected: TripDestinationInput[]): TripDestinationInput[] {
  return selected.map((destination) => ({ ...destination }));
}

export function tripDestinationInputFromSearchResult(result: DestinationSearchResult): TripDestinationInput {
  return {
    cityName: result.cityName,
    countryName: result.countryName,
    countryCode: result.countryCode,
    displayName: result.displayName,
    latitude: result.latitude,
    longitude: result.longitude,
    radiusMeters: result.radiusMeters,
    provider: result.provider,
    providerPlaceId: result.providerPlaceId,
  };
}
