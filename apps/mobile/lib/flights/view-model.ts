import type { FlightSummary } from '@i-um/api-contract';

export type FlightCardViewModel = {
  id: string;
  title: string;
  flightNumberLabel: string | null;
  routeLabel: string;
  timeLabel: string;
  passengerLabel: string;
  boardingPassActionLabel: '탑승권 열기' | '탑승권 추가' | null;
  isMine: boolean;
};

export type FlightVaultViewModel = {
  myFlights: FlightCardViewModel[];
  companionFlights: FlightCardViewModel[];
};

export function buildFlightVaultViewModel(flights: FlightSummary[]): FlightVaultViewModel {
  const cards = flights.map(buildFlightCardViewModel);
  return {
    myFlights: cards.filter((card) => card.isMine),
    companionFlights: cards.filter((card) => !card.isMine),
  };
}

export function buildFlightCardViewModel(flight: FlightSummary): FlightCardViewModel {
  const passengerNames = flight.passengers.map((passenger) => passenger.displayName.trim()).filter(Boolean);
  const departureCode = flight.departure.airportCode?.trim() || flight.departure.airportText.trim();
  const arrivalCode = flight.arrival.airportCode?.trim() || flight.arrival.airportText.trim();
  const isMine = Boolean(flight.myPersonalDetail);
  const hasBoardingPass = Boolean(flight.myPersonalDetail?.boardingPass.exists);

  return {
    id: flight.id,
    title: flight.displayTitle.trim() || flight.flightNumber?.trim() || '항공편',
    flightNumberLabel: flight.flightNumber?.trim() || null,
    routeLabel: `${departureCode} → ${arrivalCode}`,
    timeLabel: `${formatLocalFlightEndpoint(flight.departure)} 출발 · ${formatLocalFlightEndpoint(flight.arrival)} 도착`,
    passengerLabel: passengerNames.length > 0 ? passengerNames.join(', ') : '탑승자 미지정',
    boardingPassActionLabel: isMine ? (hasBoardingPass ? '탑승권 열기' : '탑승권 추가') : null,
    isMine,
  };
}

export function formatLocalFlightEndpoint(endpoint: FlightSummary['departure']): string {
  const airport = endpoint.airportCode?.trim() || endpoint.airportText.trim();
  return `${endpoint.localDate} ${endpoint.localTime} ${airport}`;
}

export function flightDetailPrivacyNotice(isPassenger: boolean): string {
  return isPassenger
    ? '예약번호, 좌석, 탑승권은 나에게만 보입니다.'
    : '공유 항공편 정보만 볼 수 있어요. 다른 사람의 예약번호나 탑승권은 표시되지 않습니다.';
}
