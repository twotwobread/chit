import assert from 'node:assert/strict';
import test from 'node:test';

import type { DayItineraryItem, GetDayItineraryResponse, TripParticipantListItem } from '@i-um/api-contract';

import {
  buildCreateQuickExpenseRequest,
  buildQuickExpenseRoute,
  buildQuickExpenseViewModel,
  formatMoney,
  inferCurrentQuickExpenseItem,
  parseAmountMinor,
} from './quick-expense.ts';

function item(overrides: Partial<DayItineraryItem>): DayItineraryItem {
  return {
    id: 'item-a',
    itemOrder: 1,
    version: 1,
    isLodging: false,
    arrivedAt: null,
    place: {
      id: 'place-a',
      name: '도톤보리',
      placeType: 'food',
      address: 'Dotonbori',
    },
    ...overrides,
  };
}

function itinerary(items: DayItineraryItem[]): GetDayItineraryResponse {
  return {
    day: { date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
    items,
  };
}

function participant(overrides: Partial<TripParticipantListItem>): TripParticipantListItem {
  return {
    participantId: 'participant-a',
    displayName: '민수',
    role: 'owner',
    joinedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

test('infers the first pending itinerary item by item order', () => {
  const current = inferCurrentQuickExpenseItem([
    item({ id: 'item-third', itemOrder: 3 }),
    item({ id: 'item-arrived', itemOrder: 1, arrivedAt: '2026-07-10T00:30:00Z' }),
    item({ id: 'item-next', itemOrder: 2 }),
  ]);

  assert.equal(current?.id, 'item-next');
});

test('requires explicit chooser when no pending item is inferred', () => {
  const current = inferCurrentQuickExpenseItem([item({ id: 'item-done', arrivedAt: '2026-07-10T00:30:00Z' })]);
  assert.equal(current, null);

  const viewModel = buildQuickExpenseViewModel({
    currency: 'JPY',
    itinerary: itinerary([item({ id: 'item-done', arrivedAt: '2026-07-10T00:30:00Z' })]),
    participants: [participant({ participantId: 'participant-a' })],
    selectedItemId: null,
    shouldChooseItem: true,
  });

  assert.equal(viewModel.showItemSelector, true);
  assert.equal(viewModel.helper, '현재 장소를 확정할 수 없어 오늘 일정에서 장소를 선택해주세요.');
  assert.equal(viewModel.itemOptions.length, 1);
});

test('builds item options only from today itinerary items and marks selected item', () => {
  const viewModel = buildQuickExpenseViewModel({
    currency: 'JPY',
    itinerary: itinerary([
      item({ id: 'item-b', itemOrder: 2, place: { id: 'place-b', name: '오사카성', placeType: 'sights', address: 'Osakajo' } }),
      item({ id: 'item-a', itemOrder: 1 }),
    ]),
    participants: [participant({ participantId: 'participant-a', displayName: ' 민수 ' })],
    selectedItemId: 'item-b',
    shouldChooseItem: false,
  });

  assert.equal(viewModel.showItemSelector, false);
  assert.equal(viewModel.selectedItem?.itemId, 'item-b');
  assert.deepEqual(viewModel.itemOptions.map((option) => option.itemId), ['item-a', 'item-b']);
  assert.equal(viewModel.itemOptions[1].selected, true);
  assert.equal(viewModel.payerOptions[0].displayName, '민수');
});

test('parses integer minor units for KRW and JPY and rejects decimals', () => {
  assert.deepEqual(parseAmountMinor('18,500', 'KRW'), { ok: true, amountMinor: 18500 });
  assert.deepEqual(parseAmountMinor('3200', 'JPY'), { ok: true, amountMinor: 3200 });
  assert.equal(parseAmountMinor('1.5', 'JPY').ok, false);
  assert.equal(parseAmountMinor('0', 'KRW').ok, false);
});

test('parses two-decimal currencies into minor units', () => {
  assert.deepEqual(parseAmountMinor('12.34', 'USD'), { ok: true, amountMinor: 1234 });
  assert.deepEqual(parseAmountMinor('12.3', 'EUR'), { ok: true, amountMinor: 1230 });
  assert.deepEqual(parseAmountMinor('12', 'USD'), { ok: true, amountMinor: 1200 });
  assert.equal(parseAmountMinor('12.345', 'USD').ok, false);
});

test('formats money with Korean-friendly currency labels', () => {
  assert.equal(formatMoney(18500, 'KRW'), '18,500원');
  assert.equal(formatMoney(3200, 'JPY'), '3,200엔');
  assert.equal(formatMoney(1234, 'USD'), '$12.34');
  assert.equal(formatMoney(1234, 'EUR'), '€12.34');
});

test('builds create quick expense request and validation errors', () => {
  assert.deepEqual(buildCreateQuickExpenseRequest({
    amountInput: '18,500',
    currency: 'KRW',
    itineraryItemId: 'item-a',
    payerParticipantId: 'participant-a',
  }), {
    ok: true,
    request: { itineraryItemId: 'item-a', amountMinor: 18500, payerParticipantId: 'participant-a' },
  });

  assert.deepEqual(buildCreateQuickExpenseRequest({
    amountInput: '0',
    currency: 'KRW',
    itineraryItemId: null,
    payerParticipantId: null,
  }), {
    ok: false,
    errors: {
      amount: '금액을 1 이상 입력해주세요.',
      item: '지출을 연결할 장소를 선택해주세요.',
      payer: '결제자를 선택해주세요.',
    },
  });
});

test('builds route with optional inferred item id', () => {
  assert.equal(buildQuickExpenseRoute('trip-a', '2026-07-10'), '/trips/trip-a/days/2026-07-10/expenses/quick');
  assert.equal(buildQuickExpenseRoute('trip-a', '2026-07-10', 'item-a'), '/trips/trip-a/days/2026-07-10/expenses/quick?itemId=item-a');
});
