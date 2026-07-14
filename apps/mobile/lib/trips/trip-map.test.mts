import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  GetDayScheduleItemsResponse,
  ListTripScheduleItemsResponse,
  ScheduleItem,
  TripDay,
  TripPlaceType,
} from '@i-um/api-contract';

import { theme } from '../design/theme';
import { buildGooglePlaceSearchRegionFromDestination, type GooglePlaceTripDestination } from '../places/google-search';
import { buildRouteWaypointMarkerChrome, buildRouteWaypointMarkerStyle } from './route-map-marker';
import {
  buildRouteMapPlaces,
  buildTripItinerariesFromTripScheduleItems,
  buildTripMapDayChips,
  buildTripMapScheduleMarkerDetail,
  buildTripMapDayRoutes,
  buildTripMapInitialRegion,
  buildTripMapRouteLayerChips,
  buildTripMapRouteLayerViewModel,
  buildTripMapSearchLayout,
  emptyTripMapRouteLayerSelection,
  resolveMapRouteSheetState,
  resolveTripMapSelectedDay,
  toggleTripMapRouteLayer,
  tripMapRouteLayerChipId,
} from './trip-map';

function day(overrides: Partial<TripDay>): TripDay {
  return {
    date: '2026-07-10',
    dayOrder: 1,
    id: 'day-1',
    lodgingPlace: null,
    ...overrides,
  };
}

function item(overrides: Partial<ScheduleItem>): ScheduleItem {
  return {
    arrivedAt: null,
    id: 'item-1',
    isLodging: false,
    itemOrder: 1,
    place: {
      address: 'Umeda',
      id: 'place-1',
      name: '우메다',
      placeType: 'sights',
      routablePlace: null,
    },
    skippedAt: null,
    version: 1,
    ...overrides,
  };
}

function routeItem({
  id,
  itemOrder,
  latitude,
  longitude,
  name,
  placeType = 'sights',
}: {
  id: string;
  itemOrder: number;
  latitude: number;
  longitude: number;
  name: string;
  placeType?: TripPlaceType;
}): ScheduleItem {
  return item({
    id,
    itemOrder,
    place: {
      address: `${name} address`,
      id: `place-${id}`,
      name,
      placeType,
      routablePlace: { provider: 'google', googlePlaceId: `google-${id}`, latitude, longitude },
    },
  });
}

function itinerary(items: ScheduleItem[], dayOverrides: Partial<TripDay> = {}): GetDayScheduleItemsResponse {
  return {
    day: day({ ...dayOverrides }),
    items,
  };
}

test('builds a bottom-sheet detail for a selected Day route marker', () => {
  assert.deepEqual(
    buildTripMapScheduleMarkerDetail(
      {
        status: 'success',
        dayLabel: 'Day 2',
        formattedDate: '7월 11일',
        lodgingPlace: null,
        items: [
          {
            id: 'item-1',
            version: 1,
            orderLabel: '1',
            placeName: '간사이공항 도착',
            placeType: 'transport',
            placeTypeLabel: '교통',
            address: 'Kansai International Airport',
            timeLabel: '09:30–11:00',
            startTime: '09:30',
            endTime: '11:00',
            placeMemo: '입국 후 라피트 탑승',
          },
        ],
      },
      'item-1',
    ),
    {
      id: 'item-1',
      title: '간사이공항 도착',
      subtitle: 'Day 2 · 1번째 일정',
      categoryLabel: '교통',
      address: 'Kansai International Airport',
      timeLabel: '09:30–11:00',
      memo: '입국 후 라피트 탑승',
    },
  );
});

test('builds trip itineraries from a single trip-level schedule response', () => {
  const days = [day({ id: 'day-a', dayOrder: 2 }), day({ id: 'day-b', dayOrder: 1, date: '2026-07-09' })];
  const response: ListTripScheduleItemsResponse = {
    days: [{ tripDayId: 'day-a', scheduleItems: [item({ id: 'item-a' })] }],
  };

  assert.deepEqual(buildTripItinerariesFromTripScheduleItems(days, response), [
    { day: days[0], scheduleItems: response.days[0].scheduleItems },
    { day: days[1], scheduleItems: [] },
  ]);
});

test('builds ordered day chips from trip days', () => {
  assert.deepEqual(
    buildTripMapDayChips([
      day({ id: 'day-2', dayOrder: 2, date: '2026-07-11' }),
      day({ id: 'day-1', dayOrder: 1, date: '2026-07-10' }),
    ]),
    [
      { id: 'day-1', label: 'Day 1', dateLabel: '2026.07.10' },
      { id: 'day-2', label: 'Day 2', dateLabel: '2026.07.11' },
    ],
  );
});

test('builds route layer chips with an all toggle and day color dots', () => {
  const chips = buildTripMapRouteLayerChips([
    day({ id: 'day-2', dayOrder: 2, date: '2026-07-11' }),
    day({ id: 'day-1', dayOrder: 1, date: '2026-07-10' }),
  ]);

  assert.equal(chips[0]?.id, 'all');
  assert.equal(chips[0]?.label, '전체');
  assert.equal(chips[0]?.legendColor, undefined);
  assert.equal(chips[1]?.id, 'day:day-1');
  assert.equal(chips[1]?.label, 'Day 1');
  assert.equal(chips[1]?.dateLabel, '2026.07.10');
  assert.equal(chips[1]?.legendColor, theme.color.green[600]);
  assert.equal(chips[2]?.id, 'day:day-2');
  assert.equal(chips[2]?.label, 'Day 2');
  assert.equal(chips[2]?.dateLabel, '2026.07.11');
  assert.equal(chips[2]?.legendColor, theme.color.blue[600]);
});

test('toggles route layer chips as none all or one selected day', () => {
  assert.deepEqual(emptyTripMapRouteLayerSelection, { kind: 'none' });

  const dayLayer = toggleTripMapRouteLayer(emptyTripMapRouteLayerSelection, 'day:day-1');
  assert.deepEqual(dayLayer, { dayId: 'day-1', kind: 'day' });
  assert.equal(tripMapRouteLayerChipId(dayLayer), 'day:day-1');
  assert.deepEqual(toggleTripMapRouteLayer(dayLayer, 'day:day-1'), { kind: 'none' });

  const allLayer = toggleTripMapRouteLayer(dayLayer, 'all');
  assert.deepEqual(allLayer, { kind: 'all' });
  assert.equal(tripMapRouteLayerChipId(allLayer), 'all');
  assert.deepEqual(toggleTripMapRouteLayer(allLayer, 'all'), { kind: 'none' });
});

test('builds visible route data for a selected day with one itinerary-order connector', () => {
  const routes = buildTripMapDayRoutes([
    itinerary(
      [
        routeItem({ id: 'day-1-second', itemOrder: 2, latitude: 34.7, longitude: 135.49, name: '우메다' }),
        routeItem({ id: 'day-1-first', itemOrder: 1, latitude: 34.6687, longitude: 135.5013, name: '도톤보리' }),
      ],
      { id: 'day-1', dayOrder: 1, date: '2026-07-10' },
    ),
    itinerary([routeItem({ id: 'day-2-first', itemOrder: 1, latitude: 35.0, longitude: 135.75, name: '교토' })], {
      id: 'day-2',
      dayOrder: 2,
      date: '2026-07-11',
    }),
  ]);

  const viewModel = buildTripMapRouteLayerViewModel(routes, { dayId: 'day-1', kind: 'day' });

  assert.deepEqual(
    viewModel.places.map((place) => [place.id, place.order, place.name]),
    [
      ['day-1-first', 1, '도톤보리'],
      ['day-1-second', 2, '우메다'],
    ],
  );
  assert.deepEqual(viewModel.polylines, [
    {
      color: theme.color.green[600],
      coordinates: [
        { latitude: 34.6687, longitude: 135.5013 },
        { latitude: 34.7, longitude: 135.49 },
      ],
      id: 'route-day-1',
    },
  ]);
  assert.equal(viewModel.notice, null);
});

test('decorates day route places with day color and highlights the first active item', () => {
  const routes = buildTripMapDayRoutes([
    itinerary(
      [
        routeItem({ id: 'arrived', itemOrder: 1, latitude: 34.6687, longitude: 135.5013, name: '도착 완료' }),
        {
          ...routeItem({ id: 'skipped', itemOrder: 2, latitude: 34.69, longitude: 135.5, name: '스킵' }),
          skippedAt: '2026-07-10T01:30:00Z',
        },
        routeItem({ id: 'next', itemOrder: 3, latitude: 34.7, longitude: 135.49, name: '다음 장소' }),
        routeItem({ id: 'todo', itemOrder: 4, latitude: 34.71, longitude: 135.48, name: '예정 장소' }),
      ].map((candidate) =>
        candidate.id === 'arrived' ? { ...candidate, arrivedAt: '2026-07-10T00:30:00Z' } : candidate,
      ),
      { id: 'day-1', dayOrder: 1, date: '2026-07-10' },
    ),
  ]);

  assert.deepEqual(
    routes[0]?.places.map((place) => [place.id, place.status, place.markerColor]),
    [
      ['arrived', 'done', theme.color.green[600]],
      ['skipped', 'skipped', theme.color.green[600]],
      ['next', 'next', theme.color.green[600]],
      ['todo', 'todo', theme.color.green[600]],
    ],
  );
});

test('builds all route layer with independent per-day connectors and no cross-day line', () => {
  const routes = buildTripMapDayRoutes([
    itinerary(
      [
        routeItem({ id: 'day-1-first', itemOrder: 1, latitude: 34.6687, longitude: 135.5013, name: '도톤보리' }),
        routeItem({ id: 'day-1-second', itemOrder: 2, latitude: 34.7, longitude: 135.49, name: '우메다' }),
      ],
      { id: 'day-1', dayOrder: 1, date: '2026-07-10' },
    ),
    itinerary(
      [
        routeItem({ id: 'day-2-first', itemOrder: 1, latitude: 35.0, longitude: 135.75, name: '교토역' }),
        routeItem({ id: 'day-2-second', itemOrder: 2, latitude: 35.0116, longitude: 135.7681, name: '니시키시장' }),
      ],
      { id: 'day-2', dayOrder: 2, date: '2026-07-11' },
    ),
  ]);

  const viewModel = buildTripMapRouteLayerViewModel(routes, { kind: 'all' });

  assert.deepEqual(
    viewModel.places.map((place) => place.id),
    ['day-1-first', 'day-1-second', 'day-2-first', 'day-2-second'],
  );
  assert.deepEqual(
    viewModel.polylines.map((polyline) => [polyline.id, polyline.color, polyline.coordinates]),
    [
      [
        'route-day-1',
        theme.color.green[600],
        [
          { latitude: 34.6687, longitude: 135.5013 },
          { latitude: 34.7, longitude: 135.49 },
        ],
      ],
      [
        'route-day-2',
        theme.color.blue[600],
        [
          { latitude: 35.0, longitude: 135.75 },
          { latitude: 35.0116, longitude: 135.7681 },
        ],
      ],
    ],
  );
  assert.equal(viewModel.notice, null);
});

test('builds an insufficient route notice when the selected layer has fewer than two places', () => {
  const routes = buildTripMapDayRoutes([
    itinerary(
      [routeItem({ id: 'day-1-only', itemOrder: 1, latitude: 34.6687, longitude: 135.5013, name: '도톤보리' })],
      {
        id: 'day-1',
        dayOrder: 1,
        date: '2026-07-10',
      },
    ),
  ]);

  const viewModel = buildTripMapRouteLayerViewModel(routes, { dayId: 'day-1', kind: 'day' });

  assert.deepEqual(
    viewModel.places.map((place) => place.id),
    ['day-1-only'],
  );
  assert.deepEqual(viewModel.polylines, []);
  assert.deepEqual(viewModel.notice, {
    helper: '장소가 2개 이상이면 일정 순서대로 동선을 연결해요.',
    title: '연결할 장소가 부족해요',
  });
});

test('builds highlighted waypoint marker chrome without an oversized outer halo border', () => {
  assert.deepEqual(buildRouteWaypointMarkerChrome('next'), {
    badgeBorderWidth: 3,
    badgeHeight: 38,
    badgeMinWidth: 42,
    badgeOpacity: 1,
    badgeTranslateY: -6,
    faded: false,
    haloBorderColor: 'transparent',
    haloBorderWidth: 0,
    highlighted: true,
  });

  assert.deepEqual(buildRouteWaypointMarkerChrome('done'), {
    badgeBorderWidth: 2,
    badgeHeight: 30,
    badgeMinWidth: 34,
    badgeOpacity: 0.42,
    badgeTranslateY: 0,
    faded: true,
    haloBorderColor: 'transparent',
    haloBorderWidth: 0,
    highlighted: false,
  });
  assert.equal(buildRouteWaypointMarkerChrome('skipped').badgeOpacity, 0.42);
});

test('inverts highlighted waypoint marker colors while keeping done markers day-colored and faded', () => {
  assert.deepEqual(buildRouteWaypointMarkerStyle(theme.color.green[600], 'next'), {
    badgeBackgroundColor: theme.color.surface,
    badgeBorderColor: theme.color.green[600],
    textColor: theme.color.green[600],
  });

  assert.deepEqual(buildRouteWaypointMarkerStyle(theme.color.green[600], 'done'), {
    badgeBackgroundColor: theme.color.green[600],
    badgeBorderColor: theme.color.surface,
    textColor: theme.color.onPrimary,
  });

  assert.deepEqual(buildRouteWaypointMarkerStyle(theme.color.green[600], 'todo'), {
    badgeBackgroundColor: theme.color.green[600],
    badgeBorderColor: theme.color.surface,
    textColor: theme.color.onPrimary,
  });
});

test('resolves selected map day from preferred id, current calendar day, then first day', () => {
  const days = [
    day({ id: 'day-1', dayOrder: 1, date: '2026-07-10' }),
    day({ id: 'day-2', dayOrder: 2, date: '2026-07-11' }),
  ];

  assert.equal(resolveTripMapSelectedDay({ days, preferredDayId: 'day-2', today: '2026-07-10' })?.id, 'day-2');
  assert.equal(resolveTripMapSelectedDay({ days, preferredDayId: 'missing', today: '2026-07-11' })?.id, 'day-2');
  assert.equal(resolveTripMapSelectedDay({ days, preferredDayId: null, today: '2026-07-12' })?.id, 'day-1');
  assert.equal(resolveTripMapSelectedDay({ days: [], preferredDayId: null, today: '2026-07-12' }), null);
});

test('resolves map route sheet state from vertical gestures', () => {
  assert.equal(resolveMapRouteSheetState('collapsed', -20), 'expanded');
  assert.equal(resolveMapRouteSheetState('expanded', 20), 'collapsed');
  assert.equal(resolveMapRouteSheetState('collapsed', -6), 'collapsed');
  assert.equal(resolveMapRouteSheetState('expanded', 6), 'expanded');
});

test('uses full-screen map search layout with overlay Day chips and no sheet itinerary list', () => {
  assert.deepEqual(buildTripMapSearchLayout(), {
    dayChipsPlacement: 'mapOverlay',
    screenMode: 'fullScreen',
    showSheetItineraryList: false,
  });
});

test('builds an initial region from visible route map places', () => {
  assert.deepEqual(
    buildTripMapInitialRegion([
      { id: 'place-1', latitude: 34.6687, longitude: 135.5013, name: '도톤보리', order: 1, type: 'sights' },
      { id: 'place-2', latitude: 34.7, longitude: 135.49, name: '우메다', order: 2, type: 'cafe' },
      { id: 'missing', latitude: null, longitude: null, name: '좌표 없음', order: 3, type: 'etc' },
    ]),
    { latitude: 34.68435, longitude: 135.49565, latitudeDelta: 0.05008, longitudeDelta: 0.01808 },
  );

  assert.equal(buildTripMapInitialRegion([{ id: 'missing', name: '좌표 없음', order: 1, type: 'etc' }]), null);
});

test('falls back to the trip destination region when the map has no visible route places', () => {
  const osaka: GooglePlaceTripDestination = {
    displayName: '오사카, 일본',
    id: 'destination-osaka',
    latitude: 34.6937,
    longitude: 135.5023,
    radiusMeters: 5000,
  };

  assert.deepEqual(
    buildTripMapInitialRegion([{ id: 'missing', name: '좌표 없음', order: 1, type: 'etc' }], [osaka]),
    buildGooglePlaceSearchRegionFromDestination(osaka),
  );
});

test('builds route map places from valid routable items while preserving duplicates and statuses', () => {
  assert.deepEqual(
    buildRouteMapPlaces([
      item({
        arrivedAt: '2026-07-10T00:30:00Z',
        id: 'arrived',
        itemOrder: 1,
        place: {
          address: 'Umeda',
          id: 'place-1',
          name: '우메다',
          placeType: 'sights',
          routablePlace: { provider: 'google', googlePlaceId: 'g-1', latitude: 34.1, longitude: 135.1 },
        },
      }),
      item({
        id: 'missing',
        itemOrder: 2,
        place: { address: 'N/A', id: 'place-2', name: '좌표 없음', placeType: 'etc', routablePlace: null },
      }),
      item({
        id: 'invalid',
        itemOrder: 3,
        place: {
          address: 'Bad',
          id: 'place-3',
          name: '잘못된 좌표',
          placeType: 'etc',
          routablePlace: { provider: 'google', googlePlaceId: 'g-2', latitude: Number.NaN, longitude: 135.2 },
        },
      }),
      item({
        id: 'duplicate',
        itemOrder: 4,
        skippedAt: '2026-07-10T01:30:00Z',
        place: {
          address: 'Umeda again',
          id: 'place-4',
          name: '우메다 재방문',
          placeType: 'food',
          routablePlace: { provider: 'google', googlePlaceId: 'g-3', latitude: 34.1, longitude: 135.1 },
        },
      }),
    ]),
    [
      { id: 'arrived', latitude: 34.1, longitude: 135.1, name: '우메다', order: 1, status: 'done', type: 'sights' },
      {
        id: 'duplicate',
        latitude: 34.1,
        longitude: 135.1,
        name: '우메다 재방문',
        order: 4,
        status: 'skipped',
        type: 'food',
      },
    ],
  );
});
