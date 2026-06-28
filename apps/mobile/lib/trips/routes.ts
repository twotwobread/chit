import type { Href } from 'expo-router';

export type TripRootTab = 'today' | 'map' | 'itinerary' | 'settle';

export type TripHiddenRouteKind =
  | 'detail'
  | 'edit'
  | 'participants'
  | 'day'
  | 'dayPlaceSearch'
  | 'dayPlaceNew'
  | 'dayQuickExpense';

export type TripRouteFallbackInput =
  | { kind: 'rootTab'; tripId: string }
  | { kind: 'detail'; tripId: string }
  | { kind: 'edit'; tripId: string }
  | { kind: 'participants'; tripId: string }
  | { kind: 'day'; tripId: string }
  | { kind: 'dayPlaceSearch' | 'dayPlaceNew' | 'dayQuickExpense'; tripId: string; tripDayId: string };

export function tripRootPath(tripId: string): `/trips/${string}` {
  return `/trips/${tripId}`;
}

export function tripTodayPath(tripId: string): `/trips/${string}/today` {
  return `/trips/${tripId}/today`;
}

export function tripMapPath(tripId: string): `/trips/${string}/map` {
  return `/trips/${tripId}/map`;
}

export function tripItineraryPath(tripId: string): `/trips/${string}/itinerary` {
  return `/trips/${tripId}/itinerary`;
}

export function tripSettlePath(tripId: string): `/trips/${string}/settle` {
  return `/trips/${tripId}/settle`;
}

export function tripDetailPath(tripId: string): `/trips/${string}/detail` {
  return `/trips/${tripId}/detail`;
}

export function tripEditPath(tripId: string): `/trips/${string}/edit` {
  return `/trips/${tripId}/edit`;
}

export function tripParticipantsPath(tripId: string): `/trips/${string}/participants` {
  return `/trips/${tripId}/participants`;
}

export function tripTabPath(tripId: string, tab: TripRootTab): Href {
  switch (tab) {
    case 'today':
      return tripTodayPath(tripId);
    case 'map':
      return tripMapPath(tripId);
    case 'itinerary':
      return tripItineraryPath(tripId);
    case 'settle':
      return tripSettlePath(tripId);
    default: {
      const exhaustive: never = tab;
      throw new Error(`Unsupported trip tab: ${exhaustive}`);
    }
  }
}

export function tripFallbackPath(input: TripRouteFallbackInput): Href {
  switch (input.kind) {
    case 'rootTab':
      return '/' as Href;
    case 'detail':
      return tripTodayPath(input.tripId);
    case 'edit':
    case 'participants':
      return tripDetailPath(input.tripId);
    case 'day':
      return tripItineraryPath(input.tripId);
    case 'dayPlaceSearch':
    case 'dayPlaceNew':
    case 'dayQuickExpense':
      return `/trips/${input.tripId}/days/${input.tripDayId}` as Href;
    default: {
      const exhaustive: never = input;
      throw new Error(`Unsupported trip route fallback input: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function tripFallbackPathForPathname(pathname: string, tripId: string): Href {
  const normalizedPathname = pathname.split('?')[0] ?? pathname;

  if (normalizedPathname === `/trips/${tripId}/detail`) {
    return tripFallbackPath({ kind: 'detail', tripId });
  }
  if (normalizedPathname === `/trips/${tripId}/edit`) {
    return tripFallbackPath({ kind: 'edit', tripId });
  }
  if (normalizedPathname === `/trips/${tripId}/participants`) {
    return tripFallbackPath({ kind: 'participants', tripId });
  }

  const dayRoutePrefix = `/trips/${tripId}/days/`;
  if (normalizedPathname.startsWith(dayRoutePrefix)) {
    const afterPrefix = normalizedPathname.slice(dayRoutePrefix.length);
    const [tripDayId, ...rest] = afterPrefix.split('/');
    const suffix = rest.join('/');
    if (!tripDayId) {
      return tripItineraryPath(tripId);
    }
    if (suffix === 'place-search') {
      return tripFallbackPath({ kind: 'dayPlaceSearch', tripId, tripDayId });
    }
    if (suffix === 'places/new') {
      return tripFallbackPath({ kind: 'dayPlaceNew', tripId, tripDayId });
    }
    if (suffix === 'expenses/quick') {
      return tripFallbackPath({ kind: 'dayQuickExpense', tripId, tripDayId });
    }
    return tripFallbackPath({ kind: 'day', tripId });
  }

  if (isTripRootTabPath(normalizedPathname, tripId)) {
    return tripFallbackPath({ kind: 'rootTab', tripId });
  }

  return tripTodayPath(tripId);
}

export function isTripRootTabPath(pathname: string, tripId: string): boolean {
  return (
    pathname === tripTodayPath(tripId) ||
    pathname === tripMapPath(tripId) ||
    pathname === tripItineraryPath(tripId) ||
    pathname === tripSettlePath(tripId)
  );
}
