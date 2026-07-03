import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { theme } from '../../../../lib/design';
import { tripItineraryDayPath, tripItineraryPath } from '../../../../lib/trips/routes';

export default function TripDayItineraryRedirectScreen() {
  const { tripId: tripIdParam, date: dateParam } = useLocalSearchParams<{
    tripId?: string | string[];
    date?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;

  useEffect(() => {
    if (tripId && date) {
      router.replace(tripItineraryDayPath(tripId, date));
      return;
    }
    if (tripId) {
      router.replace(tripItineraryPath(tripId));
      return;
    }
    router.replace('/');
  }, [date, tripId]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={theme.color.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: theme.color.bg,
    flex: 1,
    justifyContent: 'center',
  },
});
