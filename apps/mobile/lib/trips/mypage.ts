import type { TripListItem, TripParticipantRole } from '@i-um/api-contract';

import { tripDetailPath } from './routes';
import { groupTripsByStatus, localDateString, type TripStatusSection } from './status';

export type MyTripCardViewModel = TripListItem & {
  dateRangeLabel: string;
  currencyLabel: string;
  roleLabel: string;
  participantCountLabel: string;
  metaLabels: string[];
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
  const roleLabel = tripRoleLabel(trip.myRole);
  const participantLabel = participantCountLabel(trip.participantCount);

  return {
    ...trip,
    dateRangeLabel: formatTripDateRange(trip.startDate, trip.endDate),
    currencyLabel: `기본 통화 ${trip.defaultCurrency}`,
    roleLabel,
    participantCountLabel: participantLabel,
    metaLabels: [roleLabel, participantLabel],
  };
}

export function formatTripDateRange(startDate: string, endDate: string): string {
  return `${formatTripDate(startDate)} ~ ${formatTripDate(endDate)}`;
}

export function formatTripDate(value: string): string {
  return value.split('-').join('.');
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
