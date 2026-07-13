import type { CreateTripFlightRequest } from '@i-um/api-contract';

export type FlightEndpointPrefix = 'departure' | 'arrival';
export type FlightDateTimePickerKind = 'date' | 'time';
export type FlightDateTimePickerTarget = { prefix: FlightEndpointPrefix; kind: FlightDateTimePickerKind };

export type FlightCreateFormValues = {
  displayTitle: string;
  flightNumber: string;
  departureAirportText: string;
  departureAirportCode: string;
  departureLocalDate: string;
  departureLocalTime: string;
  departureTimeZone: string;
  arrivalAirportText: string;
  arrivalAirportCode: string;
  arrivalLocalDate: string;
  arrivalLocalTime: string;
  arrivalTimeZone: string;
};

export type FlightTimeZoneOption = {
  label: string;
  value: string;
};

export const DEFAULT_FLIGHT_TIME_ZONE = 'Asia/Seoul';
export const DEFAULT_FLIGHT_LOCAL_TIME = '12:00';

export const defaultFlightCreateFormValues: FlightCreateFormValues = {
  displayTitle: '',
  flightNumber: '',
  departureAirportText: '',
  departureAirportCode: '',
  departureLocalDate: '',
  departureLocalTime: '',
  departureTimeZone: DEFAULT_FLIGHT_TIME_ZONE,
  arrivalAirportText: '',
  arrivalAirportCode: '',
  arrivalLocalDate: '',
  arrivalLocalTime: '',
  arrivalTimeZone: DEFAULT_FLIGHT_TIME_ZONE,
};

export const flightTimeZoneOptions: FlightTimeZoneOption[] = [
  { value: 'Asia/Seoul', label: '서울 · Asia/Seoul' },
  { value: 'Asia/Tokyo', label: '도쿄 · Asia/Tokyo' },
  { value: 'Asia/Shanghai', label: '상하이 · Asia/Shanghai' },
  { value: 'Asia/Taipei', label: '타이베이 · Asia/Taipei' },
  { value: 'Asia/Hong_Kong', label: '홍콩 · Asia/Hong_Kong' },
  { value: 'Asia/Singapore', label: '싱가포르 · Asia/Singapore' },
  { value: 'America/Los_Angeles', label: '로스앤젤레스 · America/Los_Angeles' },
  { value: 'America/New_York', label: '뉴욕 · America/New_York' },
  { value: 'Europe/London', label: '런던 · Europe/London' },
  { value: 'Europe/Paris', label: '파리 · Europe/Paris' },
  { value: 'UTC', label: 'UTC' },
];

export function openFlightDateTimePicker(
  values: FlightCreateFormValues,
  target: FlightDateTimePickerTarget,
): { values: FlightCreateFormValues; activePicker: FlightDateTimePickerTarget } {
  if (target.kind !== 'time') {
    return { values, activePicker: target };
  }

  const timeKey = flightEndpointFieldKey(target.prefix, 'LocalTime');
  if (values[timeKey].trim()) {
    return { values, activePicker: target };
  }

  return { values: { ...values, [timeKey]: DEFAULT_FLIGHT_LOCAL_TIME }, activePicker: target };
}

export function buildFlightCreateRequest(
  form: FlightCreateFormValues,
  passengerParticipantIds: string[],
): CreateTripFlightRequest {
  return {
    displayTitle: form.displayTitle,
    flightNumber: form.flightNumber.trim() ? form.flightNumber : null,
    departure: {
      airportText: form.departureAirportText,
      airportCode: form.departureAirportCode.trim() ? form.departureAirportCode : null,
      localDate: form.departureLocalDate,
      localTime: form.departureLocalTime,
      timeZone: form.departureTimeZone,
    },
    arrival: {
      airportText: form.arrivalAirportText,
      airportCode: form.arrivalAirportCode.trim() ? form.arrivalAirportCode : null,
      localDate: form.arrivalLocalDate,
      localTime: form.arrivalLocalTime,
      timeZone: form.arrivalTimeZone,
    },
    passengerParticipantIds,
  };
}

export function validateFlightCreateRequest(request: CreateTripFlightRequest): string | null {
  if (!request.displayTitle.trim()) {
    return '표시 이름을 입력해주세요.';
  }
  if (!request.departure.airportText.trim() || !request.arrival.airportText.trim()) {
    return '출발/도착 공항을 입력해주세요.';
  }
  if (!request.departure.localDate || !request.departure.localTime || !request.departure.timeZone.trim()) {
    return '출발 날짜, 시간, 시간대를 선택해주세요.';
  }
  if (!request.arrival.localDate || !request.arrival.localTime || !request.arrival.timeZone.trim()) {
    return '도착 날짜, 시간, 시간대를 선택해주세요.';
  }
  if (!isSupportedFlightTimeZone(request.departure.timeZone) || !isSupportedFlightTimeZone(request.arrival.timeZone)) {
    return '시간대는 목록에서 선택해주세요.';
  }
  if (request.passengerParticipantIds.length === 0) {
    return '탑승자를 한 명 이상 선택해주세요.';
  }
  return null;
}

export function flightTimeZoneLabel(value: string): string {
  return flightTimeZoneOptions.find((option) => option.value === value)?.label ?? value;
}

export function isSupportedFlightTimeZone(value: string): boolean {
  return flightTimeZoneOptions.some((option) => option.value === value);
}

export function flightEndpointFieldKey<
  Suffix extends 'AirportText' | 'AirportCode' | 'LocalDate' | 'LocalTime' | 'TimeZone',
>(prefix: FlightEndpointPrefix, suffix: Suffix): `${FlightEndpointPrefix}${Suffix}` {
  return `${prefix}${suffix}`;
}
