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
const naverMapsSearchBaseUrl = 'nmap://search?query=';

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
  return `${naverMapsSearchBaseUrl}${encodeURIComponent(buildNaverMapsSearchQuery(placeName, address))}&appname=${encodeURIComponent(
    naverMapsAppName,
  )}`;
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

function buildNaverMapsSearchQuery(placeName: string, address?: string | null): string {
  const normalizedAddress = normalizeNaverMapsAddress(address);
  return normalizedAddress || placeName.trim();
}

function normalizeNaverMapsAddress(address?: string | null): string {
  const rawAddress = address?.trim() ?? '';

  if (!rawAddress) {
    return '';
  }

  return rawAddress
    .split(',')
    .map((part) => stripKoreaCountryToken(part.trim()))
    .filter(Boolean)
    .join(' ')
    .trim();
}

function stripKoreaCountryToken(value: string): string {
  if (/^(?:KR|KOR|대한민국|South Korea)$/i.test(value)) {
    return '';
  }

  return value
    .replace(/^(?:KR|KOR|대한민국|South Korea)[\s,]+/i, '')
    .replace(/[\s,]+(?:KR|KOR|대한민국|South Korea)$/i, '')
    .trim();
}
