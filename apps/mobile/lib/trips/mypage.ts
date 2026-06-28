import type { TripListItem, TripParticipantRole } from '@i-um/api-contract';

import { tripDetailPath } from './routes';
import { groupTripsByStatus, localDateString, type TripStatusSection } from './status';

export type MyTripCardViewModel = TripListItem & {
  roleLabel: string;
  participantCountLabel: string;
};

export type MyTripsStatusSectionViewModel = Omit<TripStatusSection, 'trips'> & {
  trips: MyTripCardViewModel[];
};

export type MyTripsSuccessViewModel = {
  currentTrip: MyTripCardViewModel | null;
  sections: MyTripsStatusSectionViewModel[];
};

export function buildMyTripsSuccessViewModel(
  trips: TripListItem[],
  today = localDateString(),
): MyTripsSuccessViewModel {
  const sections = groupTripsByStatus(trips, today).map((section) => ({
    ...section,
    trips: section.trips.map(toTripCardViewModel),
  }));

  return {
    currentTrip: sections.find((section) => section.status === 'ongoing')?.trips[0] ?? null,
    sections,
  };
}

export function toTripCardViewModel(trip: TripListItem): MyTripCardViewModel {
  return {
    ...trip,
    roleLabel: tripRoleLabel(trip.myRole),
    participantCountLabel: participantCountLabel(trip.participantCount),
  };
}

export function tripRoleLabel(role: TripParticipantRole): string {
  switch (role) {
    case 'owner':
      return '주최자';
    case 'member':
      return '동행자';
    default: {
      const exhaustive: never = role;
      throw new Error(`Unsupported trip participant role: ${exhaustive}`);
    }
  }
}

export function participantCountLabel(count: number): string {
  return `참여자 ${count}명`;
}

export { tripDetailPath };
