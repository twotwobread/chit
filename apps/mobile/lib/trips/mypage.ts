import type {
  GetMySettlementSummaryResponse,
  MySettlementDirection,
  SupportedCurrency,
  TripListItem,
  TripParticipantRole,
} from '@i-um/api-contract';

import { formatMoney } from './quick-expense';
import { tripDetailPath, tripSettlePath } from './routes';
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

export type MySettlementCurrencySummaryViewModel = {
  currency: SupportedCurrency;
  direction: MySettlementDirection;
  directionLabel: string;
  amountLabel: string;
  summaryLabel: string;
};

export type MySettlementTripSummaryViewModel = {
  tripId: string;
  tripName: string;
  dateRangeLabel: string;
  route: string;
  currencySummaries: MySettlementCurrencySummaryViewModel[];
};

export type MySettlementSummaryViewModel =
  | {
      status: 'empty';
      title: string;
      helper: string;
    }
  | {
      status: 'ready';
      title: string;
      helper: string;
      trips: MySettlementTripSummaryViewModel[];
    };

export function buildMySettlementSummaryViewModel(
  response: GetMySettlementSummaryResponse,
): MySettlementSummaryViewModel {
  if (response.trips.length === 0) {
    return {
      status: 'empty',
      title: '정산할 여행이 없어요.',
      helper: '보내거나 받을 금액이 있는 여행이 없어요.',
    };
  }

  return {
    status: 'ready',
    title: '정산 요약',
    helper: `보내거나 받을 금액이 있는 여행 ${response.trips.length}개`,
    trips: response.trips.map((trip) => ({
      tripId: trip.tripId,
      tripName: trip.tripName,
      dateRangeLabel: formatTripDateRange(trip.startDate, trip.endDate),
      route: tripSettlePath(trip.tripId),
      currencySummaries: trip.currencySummaries.map((summary) => {
        const directionLabel = mySettlementDirectionLabel(summary.direction);
        const amountLabel = formatMoney(summary.netMinor, summary.currency);
        return {
          currency: summary.currency,
          direction: summary.direction,
          directionLabel,
          amountLabel,
          summaryLabel: `${directionLabel} ${amountLabel}`,
        };
      }),
    })),
  };
}

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

function mySettlementDirectionLabel(direction: MySettlementDirection): string {
  switch (direction) {
    case 'send':
      return '보낼 금액';
    case 'receive':
      return '받을 금액';
    default: {
      const exhaustive: never = direction;
      throw new Error(`Unsupported settlement direction: ${exhaustive}`);
    }
  }
}

export { tripDetailPath };
