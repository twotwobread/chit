import type { Href } from 'expo-router';

import { buildPlaceScheduleDetailRoute } from '../places/place-schedule-detail';

import { tripItineraryDayPath } from './routes';

export type DayItineraryAddPlaceReturnParam = string | string[] | undefined;

export type DayItineraryAddPlaceReturnNavigation =
  | { kind: 'dismissToDay'; href: Href }
  | { kind: 'replaceWithDay'; href: Href };

const dayItineraryAddPlaceReturnParamName = 'returnTo';
const dayItineraryAddPlaceReturnToDayValue = 'itinerary-tab';

export function buildDayItineraryAddPlaceSearchRoute(tripId: string, date: string): Href {
  const detailRoute = buildPlaceScheduleDetailRoute(tripId, date);
  const returnParam = `${dayItineraryAddPlaceReturnParamName}=${dayItineraryAddPlaceReturnToDayValue}`;
  return `${detailRoute}?${returnParam}` as Href;
}

export function buildDayItineraryLodgingPlaceSearchRoute(tripId: string, date: string): Href {
  const returnParam = `${dayItineraryAddPlaceReturnParamName}=${dayItineraryAddPlaceReturnToDayValue}`;
  return `/trips/${tripId}/days/${date}/place-search?${returnParam}&mode=lodging` as Href;
}

export function isDayItineraryAddPlaceReturnToDay(returnTo: DayItineraryAddPlaceReturnParam): boolean {
  const value = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  return value === dayItineraryAddPlaceReturnToDayValue;
}

export function resolveDayItineraryAddPlaceReturnNavigation({
  tripId,
  date,
  returnTo,
}: {
  tripId: string;
  date: string;
  returnTo?: DayItineraryAddPlaceReturnParam;
}): DayItineraryAddPlaceReturnNavigation {
  const href = tripItineraryDayPath(tripId, date);
  if (isDayItineraryAddPlaceReturnToDay(returnTo)) {
    return { kind: 'dismissToDay', href };
  }
  return { kind: 'replaceWithDay', href };
}
