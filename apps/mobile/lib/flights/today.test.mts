import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as today from './today.ts';

const { buildTodayFlightCard } = today;

test('today flight card appears from 24 hours before departure through arrival grace', () => {
  const flight = flightFixture({
    id: 'f1',
    departureAt: '2026-08-01T05:30:00Z',
    arrivalAt: '2026-08-01T16:50:00Z',
    boardingPassExists: false,
  });

  assert.equal(buildTodayFlightCard([flight], new Date('2026-07-31T05:29:59Z')), null);
  assert.equal(buildTodayFlightCard([flight], new Date('2026-07-31T05:30:00Z'))?.actionLabel, '탑승권 추가');
  assert.equal(buildTodayFlightCard([flight], new Date('2026-08-01T22:50:00Z'))?.flightId, 'f1');
  assert.equal(buildTodayFlightCard([flight], new Date('2026-08-01T22:50:01Z')), null);
});

test('today flight card exposes readable departure and arrival endpoints', () => {
  const card = buildTodayFlightCard(
    [
      flightFixture({
        id: 'mine',
        departureAt: '2026-08-01T05:30:00Z',
        arrivalAt: '2026-08-01T16:50:00Z',
      }),
    ],
    new Date('2026-08-01T00:00:00Z'),
  );

  assert.deepEqual(card?.departure, {
    roleLabel: '출발',
    airportLabel: 'ICN',
    dateLabel: '2026-08-01',
    timeLabel: '14:30',
  });
  assert.deepEqual(card?.arrival, {
    roleLabel: '도착',
    airportLabel: 'LAX',
    dateLabel: '2026-08-01',
    timeLabel: '09:50',
  });
});

test('today flight card ignores companion-only shared flights and opens existing boarding pass', () => {
  const card = buildTodayFlightCard(
    [
      flightFixture({
        id: 'companion',
        departureAt: '2026-08-01T05:30:00Z',
        arrivalAt: '2026-08-01T16:50:00Z',
        mine: false,
      }),
      flightFixture({
        id: 'mine',
        departureAt: '2026-08-01T06:30:00Z',
        arrivalAt: '2026-08-01T17:50:00Z',
        boardingPassExists: true,
      }),
    ],
    new Date('2026-08-01T00:00:00Z'),
  );

  assert.equal(card?.flightId, 'mine');
  assert.equal(card?.actionLabel, '탑승권 열기');
  assert.equal(card?.primaryActionKind, 'openBoardingPass');
});

test('today flight card routes to detail when boarding pass is missing', () => {
  const card = buildTodayFlightCard(
    [
      flightFixture({
        id: 'mine',
        departureAt: '2026-08-01T05:30:00Z',
        arrivalAt: '2026-08-01T16:50:00Z',
        boardingPassExists: false,
      }),
    ],
    new Date('2026-08-01T00:00:00Z'),
  );

  assert.equal(card?.actionLabel, '탑승권 추가');
  assert.equal(card?.primaryActionKind, 'routeToDetail');
});

test('today boarding pass opener opens the returned image URL', async () => {
  const openedUrls: string[] = [];
  const openTodayFlightBoardingPass = (today as any).openTodayFlightBoardingPass;

  assert.equal(typeof openTodayFlightBoardingPass, 'function');
  await openTodayFlightBoardingPass({
    tripId: 'trip-1',
    flightId: 'flight-1',
    openBoardingPass: async (tripId: string, flightId: string) => {
      assert.equal(tripId, 'trip-1');
      assert.equal(flightId, 'flight-1');
      return { url: 'https://example.com/boarding-pass.png' };
    },
    openUrl: async (url: string) => {
      openedUrls.push(url);
    },
  });

  assert.deepEqual(openedUrls, ['https://example.com/boarding-pass.png']);
});

function flightFixture({
  arrivalAt,
  boardingPassExists = false,
  departureAt,
  id,
  mine = true,
}: {
  id: string;
  departureAt: string;
  arrivalAt: string;
  boardingPassExists?: boolean;
  mine?: boolean;
}) {
  return {
    id,
    displayTitle: 'KE 017',
    flightNumber: 'KE017',
    departure: {
      airportText: 'ICN',
      airportCode: 'ICN',
      localDate: '2026-08-01',
      localTime: '14:30',
      timeZone: 'Asia/Seoul',
      at: departureAt,
    },
    arrival: {
      airportText: 'LAX',
      airportCode: 'LAX',
      localDate: '2026-08-01',
      localTime: '09:50',
      timeZone: 'America/Los_Angeles',
      at: arrivalAt,
    },
    passengers: [{ participantId: 'p1', displayName: '민수' }],
    myPersonalDetail: mine
      ? {
          reservationNumber: null,
          seat: null,
          checkInUrl: null,
          boardingPass: {
            exists: boardingPassExists,
            contentType: boardingPassExists ? 'image/png' : null,
            byteSize: boardingPassExists ? 10 : null,
            uploadedAt: boardingPassExists ? '2026-07-31T00:00:00Z' : null,
          },
        }
      : null,
    createdByUserId: 'u1',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  };
}
