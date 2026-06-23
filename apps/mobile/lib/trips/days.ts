import type { TripDay } from '@i-um/api-contract';

import { buildTripDayLodgingSummary, type TripDayLodgingSummaryViewModel } from './lodging-place';

export type TripDayViewModel = TripDay & {
  dayLabel: string;
  formattedDate: string;
  lodgingSummary: TripDayLodgingSummaryViewModel | null;
};

export function formatTripDayDate(value: string): string {
  return value.replace(/-/g, '.');
}

export function buildTripDayViewModels(days: TripDay[]): TripDayViewModel[] {
  return days.map((day) => ({
    ...day,
    dayLabel: `Day ${day.dayOrder}`,
    formattedDate: formatTripDayDate(day.date),
    lodgingSummary: buildTripDayLodgingSummary(day),
  }));
}
