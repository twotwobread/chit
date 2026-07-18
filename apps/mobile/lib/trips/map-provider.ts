export type MapProvider = 'googleMaps' | 'naverMaps';

export type MapProviderTripDestination = {
  countryCode?: string | null;
};

export type ExternalMapPlace = {
  placeName: string;
  address?: string | null;
  googleMapsUri?: string | null;
};

export const externalMapViewLabel = '지도에서 보기';
export const externalMapDetailLabel = '지도에서 자세히';
export const naverMapsAppName = 'com.twotwobread.ium';

const googleMapsSearchBaseUrl = 'https://www.google.com/maps/search/?api=1&query=';
const naverMapsSearchBaseUrl = 'https://map.naver.com/v5/search/';

export function resolveMapProvider(destinations: readonly MapProviderTripDestination[]): MapProvider {
  if (destinations.length === 0) {
    return 'googleMaps';
  }

  const countryCodes = destinations.map((destination) => destination.countryCode?.trim().toUpperCase() ?? '');
  return countryCodes.every((countryCode) => countryCode === 'KR') ? 'naverMaps' : 'googleMaps';
}

export function buildGoogleMapsSearchUrl(placeName: string, address?: string | null): string {
  return `${googleMapsSearchBaseUrl}${encodeURIComponent(buildExternalMapSearchQuery(placeName, address))}`;
}

export function buildNaverMapsSearchUrl(placeName: string, address?: string | null): string {
  return `${naverMapsSearchBaseUrl}${encodeURIComponent(buildExternalMapSearchQuery(placeName, address))}`;
}

export function buildExternalMapUrl(input: ExternalMapPlace, provider: MapProvider = 'googleMaps'): string {
  if (provider === 'naverMaps') {
    return buildNaverMapsSearchUrl(input.placeName, input.address);
  }

  const googleMapsUri = input.googleMapsUri?.trim();
  return googleMapsUri || buildGoogleMapsSearchUrl(input.placeName, input.address);
}

function buildExternalMapSearchQuery(placeName: string, address?: string | null): string {
  return [placeName, address ?? '']
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');
}
