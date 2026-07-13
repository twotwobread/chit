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
