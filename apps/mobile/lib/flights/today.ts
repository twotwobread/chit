import type { FlightSummary } from '@i-um/api-contract';

import { buildFlightCardViewModel } from './view-model';

const DAY_MS = 24 * 60 * 60 * 1000;
const ARRIVAL_GRACE_MS = 6 * 60 * 60 * 1000;

export type TodayFlightEndpointViewModel = {
  roleLabel: '출발' | '도착';
  airportLabel: string;
  dateLabel: string;
  timeLabel: string;
};

export type TodayFlightActionKind = 'openBoardingPass' | 'routeToDetail';

export type TodayFlightCardViewModel = {
  flightId: string;
  title: string;
  routeLabel: string;
  timeLabel: string;
  departure: TodayFlightEndpointViewModel;
  arrival: TodayFlightEndpointViewModel;
  actionLabel: '탑승권 열기' | '탑승권 추가';
  primaryActionKind: TodayFlightActionKind;
};

export type OpenTodayFlightBoardingPassDependencies = {
  openBoardingPass: (tripId: string, flightId: string) => Promise<{ url: string }>;
  openUrl: (url: string) => Promise<unknown>;
};

export async function openTodayFlightBoardingPass({
  flightId,
  openBoardingPass,
  openUrl,
  tripId,
}: OpenTodayFlightBoardingPassDependencies & { tripId: string; flightId: string }): Promise<void> {
  const response = await openBoardingPass(tripId, flightId);
  await openUrl(response.url);
}

export function buildTodayFlightCard(flights: FlightSummary[], now: Date): TodayFlightCardViewModel | null {
  const nowMs = now.getTime();
  const candidates = flights
    .filter((flight) => Boolean(flight.myPersonalDetail))
    .filter((flight) => {
      const departureAt = Date.parse(flight.departure.at);
      const arrivalAt = Date.parse(flight.arrival.at);
      if (!Number.isFinite(departureAt) || !Number.isFinite(arrivalAt)) {
        return false;
      }
      return nowMs >= departureAt - DAY_MS && nowMs <= arrivalAt + ARRIVAL_GRACE_MS;
    })
    .sort((a, b) => Date.parse(a.departure.at) - Date.parse(b.departure.at));

  const selected = candidates[0];
  if (!selected) {
    return null;
  }
  const card = buildFlightCardViewModel(selected);
  const hasBoardingPass = Boolean(selected.myPersonalDetail?.boardingPass.exists);
  return {
    flightId: selected.id,
    title: card.title,
    routeLabel: card.routeLabel,
    timeLabel: card.timeLabel,
    departure: buildTodayFlightEndpoint('출발', selected.departure),
    arrival: buildTodayFlightEndpoint('도착', selected.arrival),
    actionLabel: hasBoardingPass ? '탑승권 열기' : '탑승권 추가',
    primaryActionKind: hasBoardingPass ? 'openBoardingPass' : 'routeToDetail',
  };
}

function buildTodayFlightEndpoint(
  roleLabel: TodayFlightEndpointViewModel['roleLabel'],
  endpoint: FlightSummary['departure'],
): TodayFlightEndpointViewModel {
  return {
    roleLabel,
    airportLabel: endpoint.airportCode?.trim() || endpoint.airportText.trim(),
    dateLabel: endpoint.localDate,
    timeLabel: endpoint.localTime,
  };
}
