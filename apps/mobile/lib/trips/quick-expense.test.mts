import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  DayItineraryItem,
  ExpenseSplit,
  GetDayItineraryResponse,
  TripParticipantListItem,
} from '@i-um/api-contract';

import equalSplitCases from '../../../../packages/api-contract/fixtures/equal-split-cases.json' with { type: 'json' };

import {
  buildCreateQuickExpenseRequest,
  buildDefaultEqualSplitPreview,
  buildDefaultSplitParticipantIds,
  buildQuickExpenseRoute,
  buildQuickExpenseViewModel,
  buildSavedEqualSplitSummary,
  formatMoney,
  inferCurrentQuickExpenseItem,
  parseAmountMinor,
  toggleQuickExpenseSplitParticipant,
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

type EqualSplitFixtureCase = {
  name: string;
  amountMinor: number;
  participants: Array<{
    participantId: string;
    displayName: string;
    joinedAt: string;
  }>;
  expectedSplits: Array<{
    participantId: string;
    displayName: string;
    amountMinor: number;
  }>;
};

const goldenEqualSplitCases = equalSplitCases as EqualSplitFixtureCase[];

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
      item({
        id: 'item-b',
        itemOrder: 2,
        place: { id: 'place-b', name: '오사카성', placeType: 'sights', address: 'Osakajo' },
      }),
      item({ id: 'item-a', itemOrder: 1 }),
    ]),
    participants: [participant({ participantId: 'participant-a', displayName: ' 민수 ' })],
    selectedItemId: 'item-b',
    shouldChooseItem: false,
  });

  assert.equal(viewModel.showItemSelector, false);
  assert.equal(viewModel.selectedItem?.itemId, 'item-b');
  assert.deepEqual(
    viewModel.itemOptions.map((option) => option.itemId),
    ['item-a', 'item-b'],
  );
  assert.equal(viewModel.itemOptions[1].selected, true);
  assert.equal(viewModel.payerOptions[0].displayName, '민수');
});

test('keeps repeated same-place occurrences selectable by itinerary item id', () => {
  const viewModel = buildQuickExpenseViewModel({
    currency: 'JPY',
    itinerary: itinerary([
      item({
        id: 'item-lodging-morning',
        itemOrder: 1,
        place: {
          id: 'place-lodging',
          name: '호텔 니코 오사카',
          placeType: 'lodging',
          address: 'Nishi-Shinsaibashi',
        },
      }),
      item({
        id: 'item-lodging-night',
        itemOrder: 4,
        place: {
          id: 'place-lodging',
          name: '호텔 니코 오사카',
          placeType: 'lodging',
          address: 'Nishi-Shinsaibashi',
        },
      }),
    ]),
    participants: [participant({ participantId: 'participant-a' })],
    selectedItemId: 'item-lodging-night',
    shouldChooseItem: true,
  });

  assert.deepEqual(
    viewModel.itemOptions.map((option) => ({ itemId: option.itemId, selected: option.selected })),
    [
      { itemId: 'item-lodging-morning', selected: false },
      { itemId: 'item-lodging-night', selected: true },
    ],
  );
  assert.equal(viewModel.selectedItem?.itemId, 'item-lodging-night');
  assert.equal(viewModel.selectedItem?.placeName, '호텔 니코 오사카');
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

for (const fixtureCase of goldenEqualSplitCases) {
  test(`builds default equal split preview from golden fixture: ${fixtureCase.name}`, () => {
    const rows = buildDefaultEqualSplitPreview({
      amountMinor: fixtureCase.amountMinor,
      currency: 'JPY',
      participants: fixtureCase.participants.map((fixtureParticipant) =>
        participant({
          participantId: fixtureParticipant.participantId,
          displayName: fixtureParticipant.displayName,
          joinedAt: fixtureParticipant.joinedAt,
        }),
      ),
    });

    assert.deepEqual(
      rows.map((row) => ({
        participantId: row.participantId,
        displayName: row.displayName,
        amountMinor: row.amountMinor,
      })),
      fixtureCase.expectedSplits,
    );
    assert.equal(
      rows.reduce((total, row) => total + row.amountMinor, 0),
      fixtureCase.amountMinor,
    );
  });
}

test('builds split preview in the quick expense view model for valid amount and participants', () => {
  const viewModel = buildQuickExpenseViewModel({
    amountInput: '1000',
    currency: 'JPY',
    itinerary: itinerary([item({ id: 'item-a' })]),
    participants: [
      participant({
        participantId: '00000000-0000-0000-0000-000000002003',
        displayName: '현우',
        joinedAt: '2026-07-10T11:00:00Z',
      }),
      participant({
        participantId: '00000000-0000-0000-0000-000000002001',
        displayName: ' 민수 ',
        joinedAt: '2026-07-10T09:00:00Z',
      }),
      participant({
        participantId: '00000000-0000-0000-0000-000000002002',
        displayName: '',
        joinedAt: '2026-07-10T09:00:00Z',
      }),
    ],
    selectedItemId: 'item-a',
    shouldChooseItem: false,
  });

  assert.deepEqual(
    viewModel.splitPreviewRows.map((row) => [row.participantId, row.displayName, row.amountLabel]),
    [
      ['00000000-0000-0000-0000-000000002001', '민수', '334엔'],
      ['00000000-0000-0000-0000-000000002002', '여행자', '333엔'],
      ['00000000-0000-0000-0000-000000002003', '현우', '333엔'],
    ],
  );
  assert.deepEqual(
    viewModel.splitParticipantOptions.map((option) => [option.participantId, option.displayName, option.selected]),
    [
      ['00000000-0000-0000-0000-000000002003', '현우', true],
      ['00000000-0000-0000-0000-000000002001', '민수', true],
      ['00000000-0000-0000-0000-000000002002', '여행자', true],
    ],
  );
  assert.equal(viewModel.splitPreviewMessage, null);
  assert.equal(viewModel.splitParticipantError, null);
});

test('builds split participant selection state and previews only selected participants', () => {
  const participants = [
    participant({ participantId: 'participant-payer', displayName: '민수', joinedAt: '2026-07-10T09:00:00Z' }),
    participant({ participantId: 'participant-friend', displayName: '지영', joinedAt: '2026-07-10T10:00:00Z' }),
  ];

  assert.deepEqual(buildDefaultSplitParticipantIds(participants), ['participant-payer', 'participant-friend']);
  assert.deepEqual(
    toggleQuickExpenseSplitParticipant(['participant-payer', 'participant-friend'], 'participant-payer'),
    ['participant-friend'],
  );
  assert.deepEqual(toggleQuickExpenseSplitParticipant(['participant-friend'], 'participant-payer'), [
    'participant-friend',
    'participant-payer',
  ]);

  const viewModel = buildQuickExpenseViewModel({
    amountInput: '1000',
    currency: 'JPY',
    itinerary: itinerary([item({ id: 'item-a' })]),
    participants,
    selectedItemId: 'item-a',
    selectedSplitParticipantIds: ['participant-friend'],
    shouldChooseItem: false,
  });

  assert.deepEqual(
    viewModel.splitParticipantOptions.map((option) => [option.participantId, option.selected]),
    [
      ['participant-payer', false],
      ['participant-friend', true],
    ],
  );
  assert.deepEqual(
    viewModel.splitPreviewRows.map((row) => [row.participantId, row.amountLabel]),
    [['participant-friend', '1,000엔']],
  );
  assert.equal(viewModel.splitParticipantError, null);
});

test('hides split preview for invalid amount and reports missing participants for valid amount', () => {
  const invalidAmount = buildQuickExpenseViewModel({
    amountInput: '1.5',
    currency: 'JPY',
    itinerary: itinerary([item({ id: 'item-a' })]),
    participants: [participant({ participantId: 'participant-a' })],
    selectedItemId: 'item-a',
    shouldChooseItem: false,
  });
  assert.deepEqual(invalidAmount.splitPreviewRows, []);
  assert.equal(invalidAmount.splitPreviewMessage, null);

  const noParticipants = buildQuickExpenseViewModel({
    amountInput: '1000',
    currency: 'JPY',
    itinerary: itinerary([item({ id: 'item-a' })]),
    participants: [],
    selectedItemId: 'item-a',
    shouldChooseItem: false,
  });
  assert.deepEqual(noParticipants.splitPreviewRows, []);
  assert.equal(noParticipants.splitPreviewMessage, '참여자 정보를 불러오지 못해 분할을 계산할 수 없어요.');

  const zeroSelected = buildQuickExpenseViewModel({
    amountInput: '1000',
    currency: 'JPY',
    itinerary: itinerary([item({ id: 'item-a' })]),
    participants: [participant({ participantId: 'participant-a' })],
    selectedItemId: 'item-a',
    selectedSplitParticipantIds: [],
    shouldChooseItem: false,
  });
  assert.deepEqual(zeroSelected.splitPreviewRows, []);
  assert.equal(zeroSelected.splitParticipantError, '분할할 사람을 1명 이상 선택해주세요.');
});

test('builds saved split summary from server response splits', () => {
  const splits: ExpenseSplit[] = [
    { participantId: 'participant-a', displayName: ' 민수 ', amountMinor: 334 },
    { participantId: null, displayName: '', amountMinor: 333 },
  ];

  assert.deepEqual(buildSavedEqualSplitSummary({ amountMinor: 667, currency: 'JPY', splits }), {
    amountLabel: '667엔',
    splitRows: [
      { participantId: 'participant-a', displayName: '민수', amountMinor: 334, amountLabel: '334엔' },
      { participantId: null, displayName: '여행자', amountMinor: 333, amountLabel: '333엔' },
    ],
  });
});

test('builds create quick expense request and validation errors', () => {
  assert.deepEqual(
    buildCreateQuickExpenseRequest({
      amountInput: '18,500',
      currency: 'KRW',
      itineraryItemId: 'item-a',
      participantIds: ['participant-b'],
      payerParticipantId: 'participant-a',
    }),
    {
      ok: true,
      request: {
        itineraryItemId: 'item-a',
        amountMinor: 18500,
        payerParticipantId: 'participant-a',
        participantIds: ['participant-b'],
      },
    },
  );

  assert.deepEqual(
    buildCreateQuickExpenseRequest({
      amountInput: '0',
      currency: 'KRW',
      itineraryItemId: null,
      participantIds: [],
      payerParticipantId: null,
    }),
    {
      ok: false,
      errors: {
        amount: '금액을 1 이상 입력해주세요.',
        item: '지출을 연결할 장소를 선택해주세요.',
        payer: '결제자를 선택해주세요.',
        participants: '분할할 사람을 1명 이상 선택해주세요.',
      },
    },
  );
});

test('builds route with optional inferred item id', () => {
  assert.equal(buildQuickExpenseRoute('trip-a', '2026-07-10'), '/trips/trip-a/days/2026-07-10/expenses/quick');
  assert.equal(
    buildQuickExpenseRoute('trip-a', '2026-07-10', 'item-a'),
    '/trips/trip-a/days/2026-07-10/expenses/quick?itemId=item-a',
  );
});
