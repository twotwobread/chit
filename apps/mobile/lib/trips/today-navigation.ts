export type TodayNavigationDestination = {
  placeName: string;
  address?: string | null;
};

export type TodayNavigationLauncher = {
  openURL: (url: string) => Promise<unknown>;
};

export type TodayNavigationResult =
  | { status: 'openedDirections'; url: string }
  | { status: 'openedInstall'; url: string }
  | { status: 'failed'; message: string };

export const todayNavigationFailureMessage = '길찾기를 열 수 없어요. 잠시 후 다시 시도해 주세요.';

export function buildGoogleMapsDestinationQuery(destination: TodayNavigationDestination): string {
  const placeName = destination.placeName.trim();
  const address = destination.address?.trim() ?? '';

  return address ? `${placeName} ${address}` : placeName;
}

export function buildGoogleMapsDirectionsUrl(destination: TodayNavigationDestination, platform: string): string {
  const encodedDestination = encodeURIComponent(buildGoogleMapsDestinationQuery(destination));

  if (platform === 'ios') {
    return `comgooglemaps://?daddr=${encodedDestination}`;
  }

  if (platform === 'android') {
    return `google.navigation:q=${encodedDestination}`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;
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

export async function openTodayNavigationDestination({
  destination,
  launcher,
  platform,
}: {
  destination: TodayNavigationDestination;
  launcher: TodayNavigationLauncher;
  platform: string;
}): Promise<TodayNavigationResult> {
  const directionsUrl = buildGoogleMapsDirectionsUrl(destination, platform);

  try {
    await launcher.openURL(directionsUrl);
    return { status: 'openedDirections', url: directionsUrl };
  } catch {
    const installUrl = buildGoogleMapsInstallUrl(platform);

    try {
      await launcher.openURL(installUrl);
      return { status: 'openedInstall', url: installUrl };
    } catch {
      return { status: 'failed', message: todayNavigationFailureMessage };
    }
  }
}
