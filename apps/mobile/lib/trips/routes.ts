import type { Href } from 'expo-router';

export type TripRootTab = 'today' | 'map' | 'itinerary' | 'expenses' | 'settle';

export const TRIP_COMPATIBILITY_ROUTE_POLICY = {
  basePattern: '/trips/*',
  canonicalFor: 'trip_planning',
  retainedBecause:
    '/trips/* is still the compatibility surface for Day, lodging, flight, map, and trip-specific ledger anchors.',
  retirementCondition:
    'Retire only after event route parity exists for trip planning and all stored deep links migrate safely.',
} as const;

const TRIP_ROOT_TABS: readonly TripRootTab[] = ['today', 'map', 'itinerary', 'expenses', 'settle'];

export type TripHiddenRouteKind =
  | 'detail'
  | 'edit'
  | 'participants'
  | 'flights'
  | 'flightNew'
  | 'flightDetail'
  | 'tripExpenseEdit'
  | 'settlementDetail'
  | 'day'
  | 'dayPlaceSearch'
  | 'dayPlaceNew'
  | 'dayQuickExpense';

export type TripRouteFallbackInput =
  | { kind: 'rootTab'; tripId: string }
  | { kind: 'detail'; tripId: string }
  | { kind: 'edit'; tripId: string }
  | { kind: 'participants'; tripId: string }
  | { kind: 'flights' | 'flightNew' | 'flightDetail'; tripId: string }
  | { kind: 'tripExpenseEdit'; tripId: string }
  | { kind: 'settlementDetail'; tripId: string }
  | { kind: 'day'; tripId: string }
  | { kind: 'dayPlaceSearch' | 'dayPlaceNew' | 'dayQuickExpense'; tripId: string; tripDayId: string };

export function eventPath(eventId: string): `/events/${string}` {
  return `/events/${eventId}`;
}

export function eventExpensesPath(eventId: string): `/events/${string}/expenses` {
  return `/events/${eventId}/expenses`;
}

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

export function tripItineraryDayPath(tripId: string, tripDayId: string): `/trips/${string}/itinerary?dayId=${string}` {
  return `/trips/${tripId}/itinerary?dayId=${tripDayId}`;
}

export function tripExpensesPath(tripId: string): `/trips/${string}/expenses` {
  return `/trips/${tripId}/expenses`;
}

export type TripExpensesRouteMode = 'main' | 'days' | 'categories';

export type TripExpensesRouteState = {
  mode: TripExpensesRouteMode;
  selectedCategory?: string | null;
  selectedDayId?: string | null;
};

export function resolveTripExpensesRouteState(input: {
  category?: unknown;
  dayId?: unknown;
  mode?: unknown;
}): Required<TripExpensesRouteState> {
  const mode = resolveTripExpensesRouteMode(input.mode);
  return {
    mode,
    selectedCategory: mode === 'categories' ? routeParamString(input.category) : null,
    selectedDayId: mode === 'days' ? routeParamString(input.dayId) : null,
  };
}

export function tripExpensesStatePath(tripId: string, state: TripExpensesRouteState): Href {
  const params = new URLSearchParams();
  const mode = state.mode;
  if (mode !== 'main') {
    params.set('mode', mode);
  }
  if (mode === 'days' && state.selectedDayId) {
    params.set('dayId', state.selectedDayId);
  }
  if (mode === 'categories' && state.selectedCategory) {
    params.set('category', state.selectedCategory);
  }
  const query = params.toString();
  return `${tripExpensesPath(tripId)}${query ? `?${query}` : ''}` as Href;
}

export function tripSettlePath(tripId: string): `/trips/${string}/settle` {
  return `/trips/${tripId}/settle`;
}

export function tripSettlementDetailPath(tripId: string): `/trips/${string}/settlement-detail` {
  return `/trips/${tripId}/settlement-detail`;
}

export function tripSettlementDetailDeepLink(tripId: string): `ium:///trips/${string}/settlement-detail` {
  return `ium:///trips/${encodeURIComponent(tripId)}/settlement-detail`;
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

export function tripFlightsPath(tripId: string): `/trips/${string}/flights` {
  return `/trips/${tripId}/flights`;
}

export function tripFlightNewPath(tripId: string): `/trips/${string}/flights/new` {
  return `/trips/${tripId}/flights/new`;
}

export function tripFlightDetailPath(tripId: string, flightId: string): `/trips/${string}/flights/${string}` {
  return `/trips/${tripId}/flights/${flightId}`;
}

export function isTripRootTab(value: string): value is TripRootTab {
  return TRIP_ROOT_TABS.includes(value as TripRootTab);
}

export function isTripCompatibilityRoute(pathname: string): boolean {
  return pathname === '/trips' || pathname.startsWith('/trips/');
}

export function tripTabPath(tripId: string, tab: TripRootTab): Href {
  switch (tab) {
    case 'today':
      return tripTodayPath(tripId);
    case 'map':
      return tripMapPath(tripId);
    case 'itinerary':
      return tripItineraryPath(tripId);
    case 'expenses':
      return tripExpensesPath(tripId);
    case 'settle':
      return tripSettlePath(tripId);
    default: {
      const exhaustive: never = tab;
      throw new Error(`Unsupported trip tab: ${exhaustive}`);
    }
  }
}

export function tripMapStatePath(tripId: string, state: { routeDayIds?: readonly string[] }): Href {
  const routeDayIds = uniqueNonEmptyStrings(state.routeDayIds ?? []);
  if (routeDayIds.length === 0) {
    return tripMapPath(tripId);
  }
  const params = new URLSearchParams({ routeDays: routeDayIds.join(',') });
  return `${tripMapPath(tripId)}?${params.toString()}` as Href;
}

export function parseTripMapRouteDayIdsParam(value: unknown): string[] {
  const encoded = routeParamString(value);
  if (!encoded) {
    return [];
  }
  return uniqueNonEmptyStrings(encoded.split(','));
}

export function tripTabPathWithState(tripId: string, tab: TripRootTab, params: Record<string, unknown> = {}): Href {
  switch (tab) {
    case 'expenses':
      return tripExpensesStatePath(tripId, resolveTripExpensesRouteState(params));
    case 'itinerary': {
      const dayId = routeParamString(params.dayId);
      return dayId ? tripItineraryDayPath(tripId, dayId) : tripItineraryPath(tripId);
    }
    case 'map':
      return tripMapStatePath(tripId, { routeDayIds: parseTripMapRouteDayIdsParam(params.routeDays) });
    case 'settle':
    case 'today':
      return tripTabPath(tripId, tab);
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
      return '/' as Href;
    case 'edit':
    case 'participants':
      return tripDetailPath(input.tripId);
    case 'flights':
      return tripTodayPath(input.tripId);
    case 'flightNew':
    case 'flightDetail':
      return tripFlightsPath(input.tripId);
    case 'tripExpenseEdit':
      return tripExpensesPath(input.tripId);
    case 'settlementDetail':
      return tripSettlePath(input.tripId);
    case 'day':
      return tripItineraryPath(input.tripId);
    case 'dayPlaceSearch':
    case 'dayPlaceNew':
    case 'dayQuickExpense':
      return tripItineraryDayPath(input.tripId, input.tripDayId);
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
  if (normalizedPathname === `/trips/${tripId}/flights`) {
    return tripFallbackPath({ kind: 'flights', tripId });
  }
  if (normalizedPathname === `/trips/${tripId}/flights/new`) {
    return tripFallbackPath({ kind: 'flightNew', tripId });
  }
  if (normalizedPathname.startsWith(`/trips/${tripId}/flights/`)) {
    return tripFallbackPath({ kind: 'flightDetail', tripId });
  }

  if (normalizedPathname === tripSettlementDetailPath(tripId)) {
    return tripFallbackPath({ kind: 'settlementDetail', tripId });
  }

  const tripExpenseRoutePrefix = `/trips/${tripId}/expenses/`;
  if (normalizedPathname.startsWith(tripExpenseRoutePrefix)) {
    return tripFallbackPath({ kind: 'tripExpenseEdit', tripId });
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
    return tripItineraryDayPath(tripId, tripDayId);
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
    pathname === tripExpensesPath(tripId) ||
    pathname === tripSettlePath(tripId)
  );
}

function resolveTripExpensesRouteMode(value: unknown): TripExpensesRouteMode {
  const mode = routeParamString(value);
  if (mode === 'days' || mode === 'categories') {
    return mode;
  }
  return 'main';
}

function routeParamString(value: unknown): string | null {
  if (Array.isArray(value)) {
    return routeParamString(value[0]);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueNonEmptyStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
