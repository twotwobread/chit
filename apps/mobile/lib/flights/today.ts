import type { FlightSummary } from '@i-um/api-contract';

import { buildFlightCardViewModel } from './view-model';

const DAY_MS = 24 * 60 * 60 * 1000;
const ARRIVAL_GRACE_MS = 6 * 60 * 60 * 1000;

export type TodayFlightCardViewModel = {
  flightId: string;
  title: string;
  routeLabel: string;
  timeLabel: string;
  actionLabel: '탑승권 열기' | '탑승권 추가';
};

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
  return {
    flightId: selected.id,
    title: card.title,
    routeLabel: card.routeLabel,
    timeLabel: card.timeLabel,
    actionLabel: selected.myPersonalDetail?.boardingPass.exists ? '탑승권 열기' : '탑승권 추가',
  };
}
