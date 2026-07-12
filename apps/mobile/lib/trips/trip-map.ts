import type { GetDayScheduleItemsResponse, ScheduleItem, TripDay } from '@i-um/api-contract';

import { theme } from '../design/theme';
import type { DayChip } from '../trip-ui/DayChips';
import type { RouteMapPlace, RouteMapPolyline } from '../trip-ui/RouteMap';
import { getScheduleItems, type DayItineraryViewModel } from './day-itinerary';
import { formatTripDayDate } from './days';

export type TripMapSearchLayout = {
  screenMode: 'fullScreen';
  dayChipsPlacement: 'mapOverlay';
  showSheetItineraryList: boolean;
};

export function buildTripMapSearchLayout(): TripMapSearchLayout {
  return {
    dayChipsPlacement: 'mapOverlay',
    screenMode: 'fullScreen',
    showSheetItineraryList: false,
  };
}

export function buildTripMapDayChips(days: TripDay[]): DayChip[] {
  return days
    .slice()
    .sort((left, right) => left.dayOrder - right.dayOrder)
    .map((day) => ({
      id: day.id,
      label: `Day ${day.dayOrder}`,
      dateLabel: formatTripDayDate(day.date),
    }));
}

export type TripMapRouteLayerChipId = 'all' | `day:${string}`;

export type TripMapRouteLayerSelection = { kind: 'none' } | { kind: 'all' } | { kind: 'day'; dayId: string };

export type TripMapRouteNotice = {
  title: string;
  helper: string;
};

export type TripMapDayRoute = {
  color: string;
  dayId: string;
  dayOrder: number;
  label: string;
  places: RouteMapPlace[];
  polylines: RouteMapPolyline[];
};

export type TripMapRouteLayerViewModel = {
  places: RouteMapPlace[];
  polylines: RouteMapPolyline[];
  notice: TripMapRouteNotice | null;
};

export type TripMapScheduleMarkerDetail = {
  id: string;
  title: string;
  subtitle: string;
  categoryLabel: string;
  address: string;
  timeLabel?: string;
  memo?: string;
};

export const emptyTripMapRouteLayerSelection: TripMapRouteLayerSelection = { kind: 'none' };

const tripMapRouteLayerColors = [
  theme.color.green[600],
  theme.color.blue[600],
  theme.color.amber[600],
  theme.color.red[600],
  theme.color.yellow[500],
  theme.color.ink[600],
] as const;

export function buildTripMapRouteLayerChips(days: TripDay[]): DayChip[] {
  const orderedDays = days.slice().sort((left, right) => left.dayOrder - right.dayOrder);
  return [
    { id: 'all', label: '전체' },
    ...orderedDays.map((day, index) => ({
      id: tripMapDayRouteChipId(day.id),
      label: `Day ${day.dayOrder}`,
      dateLabel: formatTripDayDate(day.date),
      legendColor: tripMapRouteLayerColor(index),
    })),
  ];
}

export function tripMapRouteLayerChipId(layer: TripMapRouteLayerSelection): TripMapRouteLayerChipId | null {
  if (layer.kind === 'all') {
    return 'all';
  }
  if (layer.kind === 'day') {
    return tripMapDayRouteChipId(layer.dayId);
  }
  return null;
}

export function toggleTripMapRouteLayer(
  current: TripMapRouteLayerSelection,
  chipId: TripMapRouteLayerChipId,
): TripMapRouteLayerSelection {
  if (tripMapRouteLayerChipId(current) === chipId) {
    return emptyTripMapRouteLayerSelection;
  }
  if (chipId === 'all') {
    return { kind: 'all' };
  }
  return { dayId: chipId.slice('day:'.length), kind: 'day' };
}

export function buildTripMapDayRoutes(itineraries: GetDayScheduleItemsResponse[]): TripMapDayRoute[] {
  return itineraries
    .slice()
    .sort((left, right) => left.day.dayOrder - right.day.dayOrder)
    .map((itinerary, index) => {
      const color = tripMapRouteLayerColor(index);
      const places = decorateTripMapRoutePlaces(buildRouteMapPlaces(getScheduleItems(itinerary)), color);
      return {
        color,
        dayId: itinerary.day.id,
        dayOrder: itinerary.day.dayOrder,
        label: `Day ${itinerary.day.dayOrder}`,
        places,
        polylines: buildTripMapRoutePolylines(itinerary.day.id, places, color),
      };
    });
}

export function buildTripMapRouteLayerViewModel(
  dayRoutes: TripMapDayRoute[],
  layer: TripMapRouteLayerSelection,
): TripMapRouteLayerViewModel {
  const visibleRoutes = selectTripMapRouteLayers(dayRoutes, layer);
  const places = visibleRoutes.flatMap((route) => route.places);
  const polylines = visibleRoutes.flatMap((route) => route.polylines);
  return {
    notice: buildTripMapRouteNotice(layer, places, polylines),
    places,
    polylines,
  };
}

export function buildTripMapScheduleMarkerDetail(
  viewModel: DayItineraryViewModel,
  scheduleItemId: string | null,
): TripMapScheduleMarkerDetail | null {
  if (!scheduleItemId || viewModel.status !== 'success') {
    return null;
  }
  const item = viewModel.items.find((candidate) => candidate.id === scheduleItemId);
  if (!item) {
    return null;
  }
  return {
    id: item.id,
    title: item.placeName,
    subtitle: `${viewModel.dayLabel} · ${item.orderLabel}번째 일정`,
    categoryLabel: item.nonPlaceCategoryLabel ?? item.placeTypeLabel,
    address: item.address,
    ...(item.timeLabel ? { timeLabel: item.timeLabel } : {}),
    ...(item.placeMemo || item.nonPlaceMemo ? { memo: item.placeMemo ?? item.nonPlaceMemo } : {}),
  };
}

export function resolveTripMapSelectedDay({
  days,
  preferredDayId,
  today,
}: {
  days: TripDay[];
  preferredDayId?: string | null;
  today: string;
}): TripDay | null {
  const orderedDays = days.slice().sort((left, right) => left.dayOrder - right.dayOrder);
  if (orderedDays.length === 0) {
    return null;
  }

  if (preferredDayId) {
    const preferred = orderedDays.find((day) => day.id === preferredDayId);
    if (preferred) {
      return preferred;
    }
  }

  return orderedDays.find((day) => day.date === today) ?? orderedDays[0];
}

export type TripMapInitialRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export function buildTripMapInitialRegion(places: RouteMapPlace[]): TripMapInitialRegion | null {
  const validPlaces = places.filter(
    (place): place is RouteMapPlace & { latitude: number; longitude: number } =>
      Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
  );
  if (validPlaces.length === 0) {
    return null;
  }

  const latitudes = validPlaces.map((place) => place.latitude);
  const longitudes = validPlaces.map((place) => place.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: roundCoordinate((minLatitude + maxLatitude) / 2),
    longitude: roundCoordinate((minLongitude + maxLongitude) / 2),
    latitudeDelta: roundDelta(Math.max((maxLatitude - minLatitude) * 1.6, 0.01)),
    longitudeDelta: roundDelta(Math.max((maxLongitude - minLongitude) * 1.6, 0.01)),
  };
}

export type MapRouteSheetState = 'collapsed' | 'expanded';

export function resolveMapRouteSheetState(current: MapRouteSheetState, gestureDy: number): MapRouteSheetState {
  if (gestureDy < -12) {
    return 'expanded';
  }
  if (gestureDy > 12) {
    return 'collapsed';
  }
  return current;
}

export function buildRouteMapPlaces(items: ScheduleItem[]): RouteMapPlace[] {
  return items
    .slice()
    .sort((left, right) => left.itemOrder - right.itemOrder)
    .filter((item) => {
      const coordinates = item.place?.routablePlace;
      return coordinates && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude);
    })
    .map((item) => ({
      id: item.id,
      latitude: item.place?.routablePlace?.latitude,
      longitude: item.place?.routablePlace?.longitude,
      name: item.place?.name ?? '장소 없는 일정',
      order: item.itemOrder,
      status: mapScheduleItemStatus(item),
      type: item.place?.placeType ?? 'etc',
    }));
}

function tripMapDayRouteChipId(dayId: string): TripMapRouteLayerChipId {
  return `day:${dayId}`;
}

function tripMapRouteLayerColor(dayIndex: number): string {
  return tripMapRouteLayerColors[dayIndex % tripMapRouteLayerColors.length] ?? theme.color.primary;
}

function decorateTripMapRoutePlaces(places: RouteMapPlace[], color: string): RouteMapPlace[] {
  const nextPlaceId = places.find((place) => place.status === 'todo')?.id;
  return places.map((place) => ({
    ...place,
    markerColor: color,
    status: place.id === nextPlaceId ? 'next' : place.status,
  }));
}

function buildTripMapRoutePolylines(dayId: string, places: RouteMapPlace[], color: string): RouteMapPolyline[] {
  const coordinates = places
    .filter(
      (place): place is RouteMapPlace & { latitude: number; longitude: number } =>
        Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
    )
    .map((place) => ({ latitude: place.latitude, longitude: place.longitude }));

  if (coordinates.length < 2) {
    return [];
  }

  return [{ color, coordinates, id: `route-${dayId}` }];
}

function selectTripMapRouteLayers(dayRoutes: TripMapDayRoute[], layer: TripMapRouteLayerSelection): TripMapDayRoute[] {
  if (layer.kind === 'all') {
    return dayRoutes;
  }
  if (layer.kind === 'day') {
    return dayRoutes.filter((route) => route.dayId === layer.dayId);
  }
  return [];
}

function buildTripMapRouteNotice(
  layer: TripMapRouteLayerSelection,
  places: RouteMapPlace[],
  polylines: RouteMapPolyline[],
): TripMapRouteNotice | null {
  if (layer.kind === 'none') {
    return null;
  }
  if (places.length === 0) {
    return {
      helper: '일정 장소를 추가하면 지도에서 동선을 확인할 수 있어요.',
      title: '표시할 일정 장소가 없어요',
    };
  }
  if (polylines.length === 0) {
    return {
      helper: '장소가 2개 이상이면 일정 순서대로 동선을 연결해요.',
      title: '연결할 장소가 부족해요',
    };
  }
  return null;
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

function roundDelta(value: number): number {
  return Number(value.toFixed(5));
}

function mapScheduleItemStatus(item: ScheduleItem): RouteMapPlace['status'] {
  if (item.arrivedAt) {
    return 'done';
  }
  if (item.skippedAt) {
    return 'skipped';
  }
  return 'todo';
}
