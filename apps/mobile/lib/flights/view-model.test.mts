import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildFlightCardViewModel, buildFlightVaultViewModel, flightDetailPrivacyNotice } from './view-model.ts';

test('flight cards display airport-local ticket times without device-time conversion', () => {
  const card = buildFlightCardViewModel({
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
    passengers: [{ participantId: 'p1', displayName: '민수' }],
    myPersonalDetail: null,
    createdByUserId: 'u1',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  });

  assert.equal(card.timeLabel, '2026-08-01 14:30 ICN 출발 · 2026-08-01 09:50 LAX 도착');
});

test('flight vault separates my flights from companion-only shared context', () => {
  const viewModel = buildFlightVaultViewModel([
    {
      id: 'mine',
      displayTitle: '내 항공편',
      flightNumber: null,
      departure: endpoint('ICN', '2026-08-01', '14:30'),
      arrival: endpoint('LAX', '2026-08-01', '09:50'),
      passengers: [{ participantId: 'p1', displayName: '민수' }],
      myPersonalDetail: {
        reservationNumber: 'PRIVATE',
        seat: '12A',
        checkInUrl: 'https://airline.example',
        boardingPass: { exists: true, contentType: 'image/png', byteSize: 12, uploadedAt: '2026-07-01T00:00:00Z' },
      },
      createdByUserId: 'u1',
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    },
    {
      id: 'companion',
      displayTitle: '동행 도착',
      flightNumber: null,
      departure: endpoint('NRT', '2026-08-01', '10:00'),
      arrival: endpoint('LAX', '2026-08-01', '08:30'),
      passengers: [{ participantId: 'p2', displayName: '지영' }],
      myPersonalDetail: null,
      createdByUserId: 'u2',
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    },
  ]);

  assert.deepEqual(
    viewModel.myFlights.map((flight) => flight.id),
    ['mine'],
  );
  assert.deepEqual(
    viewModel.companionFlights.map((flight) => flight.id),
    ['companion'],
  );
  assert.equal(viewModel.myFlights[0].boardingPassActionLabel, '탑승권 열기');
  assert.equal(viewModel.companionFlights[0].boardingPassActionLabel, null);
  assert.match(flightDetailPrivacyNotice(false), /예약번호나 탑승권은 표시되지 않습니다/);
});

function endpoint(airportCode: string, localDate: string, localTime: string) {
  return {
    airportText: airportCode,
    airportCode,
    localDate,
    localTime,
    timeZone: 'Etc/UTC',
    at: `${localDate}T00:00:00Z`,
  };
}
