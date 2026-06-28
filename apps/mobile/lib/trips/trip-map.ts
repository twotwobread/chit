import type { ScheduleItem, TripDay } from '@i-um/api-contract';

import type { DayChip } from '../trip-ui/DayChips';
import type { RouteMapPlace } from '../trip-ui/RouteMap';
import { formatTripDayDate } from './days';

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

export function buildRouteMapPlaces(items: ScheduleItem[]): RouteMapPlace[] {
  return items
    .slice()
    .sort((left, right) => left.itemOrder - right.itemOrder)
    .filter((item) => {
      const coordinates = item.place.routablePlace;
      return coordinates && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude);
    })
    .map((item) => ({
      id: item.id,
      latitude: item.place.routablePlace?.latitude,
      longitude: item.place.routablePlace?.longitude,
      name: item.place.name,
      order: item.itemOrder,
      status: mapScheduleItemStatus(item),
      type: item.place.placeType,
    }));
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
