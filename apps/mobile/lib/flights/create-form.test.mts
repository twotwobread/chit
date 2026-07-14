import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFlightCreateRequest,
  defaultFlightCreateFormValues,
  flightTimeZoneOptions,
  openFlightDateTimePicker,
  validateFlightCreateRequest,
} from './create-form.ts';

test('opening time picker replaces calendar target and initializes an empty time', () => {
  const values = { ...defaultFlightCreateFormValues, departureLocalDate: '2026-08-01', departureLocalTime: '' };

  const result = openFlightDateTimePicker(values, { prefix: 'departure', kind: 'time' });

  assert.deepEqual(result.activePicker, { prefix: 'departure', kind: 'time' });
  assert.equal(result.values.departureLocalTime, '12:00');
});

test('opening date picker replaces an active time target without changing the time', () => {
  const values = { ...defaultFlightCreateFormValues, arrivalLocalTime: '09:50' };

  const result = openFlightDateTimePicker(values, { prefix: 'arrival', kind: 'date' });

  assert.deepEqual(result.activePicker, { prefix: 'arrival', kind: 'date' });
  assert.equal(result.values.arrivalLocalTime, '09:50');
});

test('flight create request keeps departure and arrival endpoint values separate', () => {
  const request = buildFlightCreateRequest(
    {
      ...defaultFlightCreateFormValues,
      displayTitle: 'KE 017',
      flightNumber: 'KE017',
      departureAirportText: '인천국제공항',
      departureAirportCode: 'ICN',
      departureLocalDate: '2026-07-15',
      departureLocalTime: '07:10',
      departureTimeZone: 'Asia/Seoul',
      arrivalAirportText: '김포국제공항',
      arrivalAirportCode: 'GMP',
      arrivalLocalDate: '2026-07-15',
      arrivalLocalTime: '08:30',
      arrivalTimeZone: 'Asia/Seoul',
    },
    ['participant-1'],
  );

  assert.deepEqual(request.departure, {
    airportText: '인천국제공항',
    airportCode: 'ICN',
    localDate: '2026-07-15',
    localTime: '07:10',
    timeZone: 'Asia/Seoul',
  });
  assert.deepEqual(request.arrival, {
    airportText: '김포국제공항',
    airportCode: 'GMP',
    localDate: '2026-07-15',
    localTime: '08:30',
    timeZone: 'Asia/Seoul',
  });
});

test('flight create request uses selected timezone values from the fixed option list', () => {
  assert.ok(flightTimeZoneOptions.some((option) => option.value === 'Asia/Seoul'));
  assert.ok(flightTimeZoneOptions.some((option) => option.value === 'America/Los_Angeles'));

  const request = buildFlightCreateRequest(
    {
      ...defaultFlightCreateFormValues,
      displayTitle: 'KE 017',
      flightNumber: 'KE017',
      departureAirportText: 'ICN',
      departureAirportCode: 'ICN',
      departureLocalDate: '2026-08-01',
      departureLocalTime: '14:30',
      departureTimeZone: 'Asia/Seoul',
      arrivalAirportText: 'LAX',
      arrivalAirportCode: 'LAX',
      arrivalLocalDate: '2026-08-01',
      arrivalLocalTime: '09:50',
      arrivalTimeZone: 'America/Los_Angeles',
    },
    ['participant-1'],
  );

  assert.equal(request.departure.timeZone, 'Asia/Seoul');
  assert.equal(request.arrival.timeZone, 'America/Los_Angeles');
  assert.equal(validateFlightCreateRequest(request), null);
});

test('flight create validation allows later arrival in the same timezone', () => {
  const request = buildFlightCreateRequest(
    {
      ...defaultFlightCreateFormValues,
      displayTitle: '국내선',
      departureAirportText: '김포',
      departureAirportCode: 'GMP',
      departureLocalDate: '2026-07-15',
      departureLocalTime: '07:10',
      departureTimeZone: 'Asia/Seoul',
      arrivalAirportText: '제주',
      arrivalAirportCode: 'CJU',
      arrivalLocalDate: '2026-07-15',
      arrivalLocalTime: '08:30',
      arrivalTimeZone: 'Asia/Seoul',
    },
    ['participant-1'],
  );

  assert.equal(validateFlightCreateRequest(request), null);
});

test('flight create validation rejects overlong fields that the server would reject', () => {
  const base = buildFlightCreateRequest(
    {
      ...defaultFlightCreateFormValues,
      displayTitle: '국내선',
      flightNumber: 'KE017',
      departureAirportText: '김포',
      departureAirportCode: 'GMP',
      departureLocalDate: '2026-07-15',
      departureLocalTime: '07:10',
      departureTimeZone: 'Asia/Seoul',
      arrivalAirportText: '제주',
      arrivalAirportCode: 'CJU',
      arrivalLocalDate: '2026-07-15',
      arrivalLocalTime: '08:30',
      arrivalTimeZone: 'Asia/Seoul',
    },
    ['participant-1'],
  );

  assert.equal(
    validateFlightCreateRequest({ ...base, displayTitle: '가'.repeat(81) }),
    '표시 이름은 80자 이하로 입력해주세요.',
  );
  assert.equal(
    validateFlightCreateRequest({ ...base, flightNumber: 'A'.repeat(21) }),
    '편명은 20자 이하로 입력해주세요.',
  );
  assert.equal(
    validateFlightCreateRequest({ ...base, departure: { ...base.departure, airportText: '가'.repeat(121) } }),
    '공항 이름은 120자 이하로 입력해주세요.',
  );
  assert.equal(
    validateFlightCreateRequest({ ...base, arrival: { ...base.arrival, airportCode: 'ABCDEFGHI' } }),
    '공항 코드는 8자 이하로 입력해주세요.',
  );
});

test('flight create validation rejects arrival instants that are not after departure', () => {
  const request = buildFlightCreateRequest(
    {
      ...defaultFlightCreateFormValues,
      displayTitle: 'KE 017',
      departureAirportText: 'ICN',
      departureLocalDate: '2026-08-01',
      departureLocalTime: '14:30',
      departureTimeZone: 'Asia/Seoul',
      arrivalAirportText: 'LAX',
      arrivalLocalDate: '2026-08-01',
      arrivalLocalTime: '09:50',
      arrivalTimeZone: 'Asia/Seoul',
    },
    ['participant-1'],
  );

  assert.equal(
    validateFlightCreateRequest(request),
    '도착 시각은 출발 시각보다 늦어야 해요. 날짜, 시간, 시간대를 확인해주세요.',
  );
});

test('flight create validation rejects timezone text outside the dropdown options', () => {
  const request = buildFlightCreateRequest(
    {
      ...defaultFlightCreateFormValues,
      displayTitle: 'KE 017',
      departureAirportText: 'ICN',
      departureLocalDate: '2026-08-01',
      departureLocalTime: '14:30',
      departureTimeZone: 'KST',
      arrivalAirportText: 'LAX',
      arrivalLocalDate: '2026-08-01',
      arrivalLocalTime: '09:50',
      arrivalTimeZone: 'America/Los_Angeles',
    },
    ['participant-1'],
  );

  assert.equal(validateFlightCreateRequest(request), '시간대는 목록에서 선택해주세요.');
});
