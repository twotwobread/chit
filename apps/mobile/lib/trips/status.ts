import type { TripListItem } from '@i-um/api-contract';

import { formatLocalDate } from './date';

export type TripStatus = 'ongoing' | 'upcoming' | 'past';

export type TripStatusSection = {
  status: TripStatus;
  title: string;
  trips: TripListItem[];
};

const SECTION_ORDER: Array<{ status: TripStatus; title: string }> = [
  { status: 'ongoing', title: '진행 중인 여행' },
  { status: 'upcoming', title: '예정된 여행' },
  { status: 'past', title: '지난 여행' },
];

export function groupTripsByStatus(trips: TripListItem[], today = localDateString()): TripStatusSection[] {
  const groups: Record<TripStatus, TripListItem[]> = {
    ongoing: [],
    upcoming: [],
    past: [],
  };

  trips.forEach((trip) => {
    groups[tripStatus(trip, today)].push(trip);
  });

  groups.ongoing.sort(compareOngoingTrips);
  groups.upcoming.sort(compareUpcomingTrips);
  groups.past.sort(comparePastTrips);

  return SECTION_ORDER.map((section) => ({ ...section, trips: groups[section.status] })).filter(
    (section) => section.trips.length > 0,
  );
}

export function selectCurrentTrip(trips: TripListItem[], today = localDateString()): TripListItem | null {
  return groupTripsByStatus(trips, today).find((section) => section.status === 'ongoing')?.trips[0] ?? null;
}

export function tripStatus(trip: TripListItem, today: string): TripStatus {
  if (trip.startDate <= today && today <= trip.endDate) {
    return 'ongoing';
  }
  if (today < trip.startDate) {
    return 'upcoming';
  }
  return 'past';
}

export function localDateString(date = new Date()): string {
  return formatLocalDate(date);
}

function compareOngoingTrips(left: TripListItem, right: TripListItem): number {
  return (
    compareAsc(left.endDate, right.endDate) ||
    compareAsc(left.startDate, right.startDate) ||
    compareDesc(left.joinedAt, right.joinedAt) ||
    compareDesc(left.createdAt, right.createdAt) ||
    compareDesc(left.id, right.id)
  );
}

function compareUpcomingTrips(left: TripListItem, right: TripListItem): number {
  return (
    compareAsc(left.startDate, right.startDate) ||
    compareAsc(left.endDate, right.endDate) ||
    compareDesc(left.joinedAt, right.joinedAt) ||
    compareDesc(left.createdAt, right.createdAt) ||
    compareDesc(left.id, right.id)
  );
}

function comparePastTrips(left: TripListItem, right: TripListItem): number {
  return (
    compareDesc(left.endDate, right.endDate) ||
    compareDesc(left.startDate, right.startDate) ||
    compareDesc(left.joinedAt, right.joinedAt) ||
    compareDesc(left.createdAt, right.createdAt) ||
    compareDesc(left.id, right.id)
  );
}

function compareAsc(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function compareDesc(left: string, right: string): number {
  return compareAsc(right, left);
}
