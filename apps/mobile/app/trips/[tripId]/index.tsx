import { Redirect, useLocalSearchParams } from 'expo-router';

import { tripTodayPath } from '../../../lib/trips/routes';

export default function TripIndexRedirect() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;

  if (!tripId) {
    return <Redirect href="/" />;
  }

  return <Redirect href={tripTodayPath(tripId)} />;
}
