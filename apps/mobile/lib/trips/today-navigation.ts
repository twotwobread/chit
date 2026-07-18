import { naverMapsAppName, resolveMapProvider, type MapProvider } from './map-provider';
import type { TravelMode } from './travel-mode';

export type TodayNavigationProvider = MapProvider;

export type TodayNavigationDestination = {
  placeName: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type TodayNavigationLauncher = {
  openURL: (url: string) => Promise<unknown>;
};

export type TodayNavigationResult =
  | { status: 'openedDirections'; url: string }
  | { status: 'openedInstall'; url: string }
  | { status: 'failed'; message: string };

type TodayNavigationTripDestination = {
  countryCode?: string | null;
};

type TodayNavigationDirectionsAttempt = {
  provider: TodayNavigationProvider;
  url: string;
};

export const todayNavigationFailureMessage = '길찾기를 열 수 없어요. 잠시 후 다시 시도해 주세요.';

export function resolveTodayNavigationProvider(
  destinations: readonly TodayNavigationTripDestination[],
): TodayNavigationProvider {
  return resolveMapProvider(destinations);
}

export function buildGoogleMapsDestinationQuery(destination: TodayNavigationDestination): string {
  const placeName = destination.placeName.trim();
  const address = destination.address?.trim() ?? '';

  return address ? `${placeName} ${address}` : placeName;
}

export function buildGoogleMapsDirectionsUrl(
  destination: TodayNavigationDestination,
  platform: string,
  travelMode?: TravelMode,
): string {
  const encodedDestination = encodeURIComponent(buildGoogleMapsDestinationQuery(destination));

  if (platform === 'ios') {
    const modeParameter = travelMode ? `&directionsmode=${travelMode}` : '';
    return `comgooglemaps://?daddr=${encodedDestination}${modeParameter}`;
  }

  if (platform === 'android') {
    const androidMode = googleNavigationModeParameter(travelMode);
    const modeParameter = androidMode ? `&mode=${androidMode}` : '';
    return `google.navigation:q=${encodedDestination}${modeParameter}`;
  }

  const modeParameter = travelMode ? `&travelmode=${travelMode}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}${modeParameter}`;
}

export function buildNaverMapsDirectionsUrl(
  destination: TodayNavigationDestination,
  travelMode?: TravelMode,
): string | null {
  const latitude = validCoordinate(destination.latitude);
  const longitude = validCoordinate(destination.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }

  const destinationName = destination.placeName.trim() || buildGoogleMapsDestinationQuery(destination).trim();
  if (!destinationName) {
    return null;
  }

  const routeMode = naverRouteModePath(travelMode);
  return `nmap://route/${routeMode}?dlat=${latitude}&dlng=${longitude}&dname=${encodeURIComponent(
    destinationName,
  )}&appname=${encodeURIComponent(naverMapsAppName)}`;
}

export function buildGoogleMapsInstallUrl(platform: string): string {
  if (platform === 'ios') {
    return 'itms-apps://apps.apple.com/app/google-maps/id585027354';
  }

  if (platform === 'android') {
    return 'market://details?id=com.google.android.apps.maps';
  }

  return 'https://www.google.com/maps';
}

export function buildNaverMapsInstallUrl(platform: string): string {
  if (platform === 'ios') {
    return 'itms-apps://apps.apple.com/app/id311867728';
  }

  if (platform === 'android') {
    return 'market://details?id=com.nhn.android.nmap';
  }

  return 'https://map.naver.com';
}

export async function openTodayNavigationDestination({
  destination,
  launcher,
  platform,
  provider = 'googleMaps',
  travelMode,
}: {
  destination: TodayNavigationDestination;
  launcher: TodayNavigationLauncher;
  platform: string;
  provider?: TodayNavigationProvider;
  travelMode?: TravelMode;
}): Promise<TodayNavigationResult> {
  const attempt = buildTodayNavigationDirectionsAttempt(destination, platform, provider, travelMode);

  try {
    await launcher.openURL(attempt.url);
    return { status: 'openedDirections', url: attempt.url };
  } catch {
    const installUrl = buildMapInstallUrl(attempt.provider, platform);

    try {
      await launcher.openURL(installUrl);
      return { status: 'openedInstall', url: installUrl };
    } catch {
      return { status: 'failed', message: todayNavigationFailureMessage };
    }
  }
}

function buildTodayNavigationDirectionsAttempt(
  destination: TodayNavigationDestination,
  platform: string,
  provider: TodayNavigationProvider,
  travelMode: TravelMode | undefined,
): TodayNavigationDirectionsAttempt {
  if (provider === 'naverMaps') {
    const naverUrl = buildNaverMapsDirectionsUrl(destination, travelMode);
    if (naverUrl) {
      return { provider: 'naverMaps', url: naverUrl };
    }
  }

  return { provider: 'googleMaps', url: buildGoogleMapsDirectionsUrl(destination, platform, travelMode) };
}

function buildMapInstallUrl(provider: TodayNavigationProvider, platform: string): string {
  return provider === 'naverMaps' ? buildNaverMapsInstallUrl(platform) : buildGoogleMapsInstallUrl(platform);
}

function validCoordinate(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function naverRouteModePath(travelMode: TravelMode | undefined): 'public' | 'walk' | 'car' {
  if (travelMode === 'walking') {
    return 'walk';
  }

  if (travelMode === 'driving') {
    return 'car';
  }

  return 'public';
}

function googleNavigationModeParameter(travelMode: TravelMode | undefined): 'd' | 'w' | null {
  if (travelMode === 'driving') {
    return 'd';
  }

  if (travelMode === 'walking') {
    return 'w';
  }

  return null;
}
