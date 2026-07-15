import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildFlightUpdateRequest, flightDetailToEditFormValues, validateFlightUpdateRequest } from './edit-form.ts';

test('initializes shared edit form values from a flight detail', () => {
  const values = flightDetailToEditFormValues({
    id: 'flight-1',
    displayTitle: 'KE 017',
    flightNumber: 'KE017',
    departure: {
      airportText: '인천',
      airportCode: 'ICN',
      localDate: '2026-08-01',
      localTime: '14:30',
      timeZone: 'Asia/Seoul',
      at: '2026-08-01T05:30:00Z',
    },
    arrival: {
      airportText: '로스앤젤레스',
      airportCode: 'LAX',
      localDate: '2026-08-01',
      localTime: '09:50',
      timeZone: 'America/Los_Angeles',
      at: '2026-08-01T16:50:00Z',
    },
    passengers: [],
    myPersonalDetail: null,
    createdByUserId: 'user-1',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });

  assert.equal(values.displayTitle, 'KE 017');
  assert.equal(values.flightNumber, 'KE017');
  assert.equal(values.departureAirportText, '인천');
  assert.equal(values.departureAirportCode, 'ICN');
  assert.equal(values.arrivalTimeZone, 'America/Los_Angeles');
});

test('builds and validates an update request without passenger ids', () => {
  const request = buildFlightUpdateRequest({
    displayTitle: ' KE 018 ',
    flightNumber: ' ',
    departureAirportText: ' 인천 ',
    departureAirportCode: ' icn ',
    departureLocalDate: '2026-08-02',
    departureLocalTime: '14:30',
    departureTimeZone: 'Asia/Seoul',
    arrivalAirportText: ' 로스앤젤레스 ',
    arrivalAirportCode: ' lax ',
    arrivalLocalDate: '2026-08-02',
    arrivalLocalTime: '09:50',
    arrivalTimeZone: 'America/Los_Angeles',
  });

  assert.deepEqual(request, {
    displayTitle: ' KE 018 ',
    flightNumber: null,
    departure: {
      airportText: ' 인천 ',
      airportCode: ' icn ',
      localDate: '2026-08-02',
      localTime: '14:30',
      timeZone: 'Asia/Seoul',
    },
    arrival: {
      airportText: ' 로스앤젤레스 ',
      airportCode: ' lax ',
      localDate: '2026-08-02',
      localTime: '09:50',
      timeZone: 'America/Los_Angeles',
    },
  });
  assert.equal(validateFlightUpdateRequest(request), null);
});

test('validates shared edit fields without requiring passenger selection', () => {
  const valid = buildFlightUpdateRequest({
    displayTitle: 'KE 018',
    flightNumber: '',
    departureAirportText: 'ICN',
    departureAirportCode: '',
    departureLocalDate: '2026-08-02',
    departureLocalTime: '14:30',
    departureTimeZone: 'Asia/Seoul',
    arrivalAirportText: 'LAX',
    arrivalAirportCode: '',
    arrivalLocalDate: '2026-08-02',
    arrivalLocalTime: '09:50',
    arrivalTimeZone: 'America/Los_Angeles',
  });
  assert.equal(validateFlightUpdateRequest(valid), null);

  const invalid = { ...valid, displayTitle: ' ' };
  assert.equal(validateFlightUpdateRequest(invalid), '표시 이름을 입력해주세요.');
});
