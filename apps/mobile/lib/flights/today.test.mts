import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildTodayFlightCard } from './today.ts';

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
