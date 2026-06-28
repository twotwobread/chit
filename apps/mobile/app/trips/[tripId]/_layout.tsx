import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, type TripListItem } from '@i-um/api-contract';

import { MobileAuthError } from '../../../lib/auth/client';
import { theme } from '../../../lib/design';
import { AppBar } from '../../../lib/trip-ui/AppBar';
import { TripSwitcherSheet } from '../../../lib/trip-ui/TripSwitcherSheet';
import { getTripDetail, listMyTrips } from '../../../lib/trips/client';
import { tripFallbackPathForPathname, tripTodayPath } from '../../../lib/trips/routes';
import { TripShellProvider, type TripShellState } from '../../../lib/trips/trip-shell-context';
import { buildSwitchableTrips, buildTripAppBarMembers } from '../../../lib/trips/trip-tabs';

export default function TripLayout() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [shellState, setShellState] = useState<TripShellState>({ status: 'loading', tripId: tripId ?? '' });
  const [switchableTrips, setSwitchableTrips] = useState<TripListItem[]>([]);

  const loadShell = useCallback(async () => {
    if (!tripId) {
      setShellState({ status: 'notFound', tripId: '' });
      setSwitchableTrips([]);
      return;
    }

    setShellState({ status: 'loading', tripId });
    const [detailResult, tripsResult] = await Promise.allSettled([getTripDetail(tripId), listMyTrips()]);

    if (tripsResult.status === 'fulfilled') {
      setSwitchableTrips(tripsResult.value.trips);
    } else {
      setSwitchableTrips([]);
    }

    if (detailResult.status === 'fulfilled') {
      setShellState({ status: 'success', tripId, detail: detailResult.value });
      return;
    }

    setShellState(shellFailureState(tripId, detailResult.reason));
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void loadShell();
    }, [loadShell]),
  );

  const detail = shellState.status === 'success' ? shellState.detail : null;
  const tripName = detail?.trip.name.trim() || '여행';
  const tripsForSheet = buildSwitchableTrips(switchableTrips, tripId ?? '');

  const handleBack = useCallback(() => {
    if (!tripId) {
      router.replace('/');
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(tripFallbackPathForPathname(pathname, tripId));
  }, [pathname, tripId]);

  return (
    <TripShellProvider value={shellState}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AppBar
          members={buildTripAppBarMembers(detail)}
          onBack={handleBack}
          onPressTitle={() => setSwitcherOpen(true)}
          tripName={tripName}
        />

        <View style={styles.navigator}>
          <Stack screenOptions={{ contentStyle: { backgroundColor: theme.color.bg }, headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="detail" />
            <Stack.Screen name="edit" />
            <Stack.Screen name="participants" />
            <Stack.Screen name="days/[date]" />
            <Stack.Screen name="days/[date]/place-search" />
            <Stack.Screen name="days/[date]/places/new" />
            <Stack.Screen name="days/[date]/expenses/quick" />
          </Stack>
        </View>

        <TripSwitcherSheet
          hrefForTrip={(nextTripId): Href => tripTodayPath(nextTripId)}
          onClose={() => setSwitcherOpen(false)}
          trips={tripsForSheet}
          visible={switcherOpen}
        />
      </View>
    </TripShellProvider>
  );
}

function shellFailureState(tripId: string, error: unknown): TripShellState {
  if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
    return { status: 'auth', tripId };
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { status: 'auth', tripId };
    }
    if (error.status === 400 || error.status === 403 || error.status === 404) {
      return { status: 'notFound', tripId };
    }
  }
  return { status: 'error', tripId };
}

const styles = StyleSheet.create({
  navigator: {
    flex: 1,
  },
  root: {
    backgroundColor: theme.color.bg,
    flex: 1,
  },
});
