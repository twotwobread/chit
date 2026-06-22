import type { TripDay } from '@i-um/api-contract';

export type TripDayViewModel = TripDay & {
  dayLabel: string;
  formattedDate: string;
};

export function formatTripDayDate(value: string): string {
  return value.replace(/-/g, '.');
}

export function buildTripDayViewModels(days: TripDay[]): TripDayViewModel[] {
  return days.map((day) => ({
    ...day,
    dayLabel: `Day ${day.dayOrder}`,
    formattedDate: formatTripDayDate(day.date),
  }));
}
