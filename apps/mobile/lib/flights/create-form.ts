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
  if (countCodePoints(request.displayTitle.trim()) > 80) {
    return '표시 이름은 80자 이하로 입력해주세요.';
  }
  if (request.flightNumber && countCodePoints(request.flightNumber.trim()) > 20) {
    return '편명은 20자 이하로 입력해주세요.';
  }
  if (!request.departure.airportText.trim() || !request.arrival.airportText.trim()) {
    return '출발/도착 공항을 입력해주세요.';
  }
  if (
    countCodePoints(request.departure.airportText.trim()) > 120 ||
    countCodePoints(request.arrival.airportText.trim()) > 120
  ) {
    return '공항 이름은 120자 이하로 입력해주세요.';
  }
  if (isAirportCodeTooLong(request.departure.airportCode) || isAirportCodeTooLong(request.arrival.airportCode)) {
    return '공항 코드는 8자 이하로 입력해주세요.';
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
  const departureInstant = flightEndpointInstantMs(request.departure);
  const arrivalInstant = flightEndpointInstantMs(request.arrival);
  if (departureInstant === null || arrivalInstant === null) {
    return '날짜, 시간, 시간대를 확인해주세요.';
  }
  if (arrivalInstant <= departureInstant) {
    return '도착 시각은 출발 시각보다 늦어야 해요. 날짜, 시간, 시간대를 확인해주세요.';
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

type FlightEndpointRequest = CreateTripFlightRequest['departure'];

type FlightDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function flightEndpointInstantMs(endpoint: FlightEndpointRequest): number | null {
  const targetParts = parseFlightLocalDateTime(endpoint.localDate, endpoint.localTime);
  if (!targetParts) {
    return null;
  }

  const utcGuess = Date.UTC(
    targetParts.year,
    targetParts.month - 1,
    targetParts.day,
    targetParts.hour,
    targetParts.minute,
  );
  const firstOffset = getTimeZoneOffsetMs(endpoint.timeZone, utcGuess);
  if (firstOffset === null) {
    return null;
  }

  const firstInstant = utcGuess - firstOffset;
  if (matchesFlightDateTimeParts(getTimeZoneDateTimeParts(endpoint.timeZone, firstInstant), targetParts)) {
    return firstInstant;
  }

  const secondOffset = getTimeZoneOffsetMs(endpoint.timeZone, firstInstant);
  if (secondOffset === null) {
    return null;
  }
  const secondInstant = utcGuess - secondOffset;
  if (matchesFlightDateTimeParts(getTimeZoneDateTimeParts(endpoint.timeZone, secondInstant), targetParts)) {
    return secondInstant;
  }

  return null;
}

function parseFlightLocalDateTime(localDate: string, localTime: string): FlightDateTimeParts | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate.trim());
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(localTime.trim());
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const parts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };
  const normalized = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  if (
    normalized.getUTCFullYear() !== parts.year ||
    normalized.getUTCMonth() + 1 !== parts.month ||
    normalized.getUTCDate() !== parts.day ||
    normalized.getUTCHours() !== parts.hour ||
    normalized.getUTCMinutes() !== parts.minute
  ) {
    return null;
  }
  return parts;
}

function getTimeZoneOffsetMs(timeZone: string, epochMs: number): number | null {
  const parts = getTimeZoneDateTimeParts(timeZone, epochMs);
  if (!parts) {
    return null;
  }
  const localAsUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return localAsUTC - epochMs;
}

function getTimeZoneDateTimeParts(timeZone: string, epochMs: number): FlightDateTimeParts | null {
  let formattedParts: Intl.DateTimeFormatPart[];
  try {
    formattedParts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    }).formatToParts(new Date(epochMs));
  } catch {
    return null;
  }

  const valueByType = new Map(formattedParts.map((part) => [part.type, part.value]));
  const year = Number(valueByType.get('year'));
  const month = Number(valueByType.get('month'));
  const day = Number(valueByType.get('day'));
  const hour = Number(valueByType.get('hour'));
  const minute = Number(valueByType.get('minute'));
  if (![year, month, day, hour, minute].every(Number.isInteger)) {
    return null;
  }
  return { year, month, day, hour, minute };
}

function matchesFlightDateTimeParts(left: FlightDateTimeParts | null, right: FlightDateTimeParts): boolean {
  if (!left) {
    return false;
  }
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

function isAirportCodeTooLong(value: string | null | undefined): boolean {
  if (!value || !value.trim()) {
    return false;
  }
  return countCodePoints(value.trim()) > 8;
}

function countCodePoints(value: string): number {
  return [...value].length;
}

export function flightEndpointFieldKey<
  Suffix extends 'AirportText' | 'AirportCode' | 'LocalDate' | 'LocalTime' | 'TimeZone',
>(prefix: FlightEndpointPrefix, suffix: Suffix): `${FlightEndpointPrefix}${Suffix}` {
  return `${prefix}${suffix}`;
}
