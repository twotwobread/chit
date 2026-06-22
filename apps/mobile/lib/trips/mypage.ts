import type { TripListItem } from '@i-um/api-contract';

import { groupTripsByStatus, localDateString, type TripStatusSection } from './status';

export type MyTripsSuccessViewModel = {
  currentTrip: TripListItem | null;
  sections: TripStatusSection[];
};

export function buildMyTripsSuccessViewModel(
  trips: TripListItem[],
  today = localDateString(),
): MyTripsSuccessViewModel {
  const sections = groupTripsByStatus(trips, today);

  return {
    currentTrip: sections.find((section) => section.status === 'ongoing')?.trips[0] ?? null,
    sections,
  };
}

export function tripDetailPath(tripId: string): `/trips/${string}` {
  return `/trips/${tripId}`;
}
