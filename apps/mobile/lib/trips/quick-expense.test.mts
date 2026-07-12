import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ScheduleItem,
  ExpenseSplit,
  GetDayScheduleItemsResponse,
  TripDay,
  TripParticipantListItem,
} from '@i-um/api-contract';

import equalSplitCases from '../../../../packages/api-contract/fixtures/equal-split-cases.json' with { type: 'json' };

import {
  buildCreateQuickExpenseRequest,
  buildDefaultEqualSplitPreview,
  buildQuickExpenseMemoUpdateRequest,
  buildQuickExpenseManualSplitInputsFromRows,
  buildQuickExpenseManualSplitSummary,
  buildDefaultSplitParticipantIds,
  buildQuickExpenseRoute,
  buildQuickExpenseViewModel,
  buildSavedEqualSplitSummary,
  formatMoney,
  inferCurrentQuickExpenseItem,
  parseAmountMinor,
  resolveInitialQuickExpenseItemId,
  resolveInitialQuickExpenseItemIdFromItineraries,
  resolveQuickExpenseItemDayId,
  parseQuickExpenseRoute,
  resolveQuickExpenseReturnPath,
  resolveQuickExpenseSheetInitialSplitMode,
  selectQuickExpenseSheetSplitMode,
  toggleQuickExpenseSplitParticipant,
} from './quick-expense.ts';

function item(overrides: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: 'item-a',
    itemOrder: 1,
    version: 1,
    isLodging: false,
    startTime: null,
    endTime: null,
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

function itinerary(items: ScheduleItem[], dayOverrides: Partial<TripDay> = {}): GetDayScheduleItemsResponse {
  return {
    day: { id: 'day-1', date: '2026-07-10', dayOrder: 1, lodgingPlace: null, ...dayOverrides },
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

test('resolves initial quick expense item from a valid preferred item before inferring current item', () => {
  const resolved = resolveInitialQuickExpenseItemId(
    [item({ id: 'item-current', itemOrder: 1 }), item({ id: 'item-preferred', itemOrder: 2 })],
    'item-preferred',
  );

  assert.equal(resolved, 'item-preferred');
});

test('falls back to the first pending item when no valid preferred item exists', () => {
  const resolved = resolveInitialQuickExpenseItemId([
    item({ id: 'item-done', itemOrder: 1, arrivedAt: '2026-07-10T00:30:00Z' }),
    item({ id: 'item-current', itemOrder: 2 }),
  ]);

  assert.equal(resolved, 'item-current');
});

test('does not default quick expense to a skipped schedule item', () => {
  const resolved = resolveInitialQuickExpenseItemId([
    item({ id: 'item-skipped', itemOrder: 1, skippedAt: '2026-07-10T00:30:00Z' } as Partial<ScheduleItem>),
    item({ id: 'item-current', itemOrder: 2 }),
  ]);

  assert.equal(resolved, 'item-current');
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
  assert.equal(viewModel.helper, '현재 일정을 확정할 수 없어 오늘 일정에서 연결할 일정을 선택해주세요.');
  assert.equal(viewModel.itemOptions.length, 1);
});

test('resolves initial all-day quick expense item by day order before item order', () => {
  const resolved = resolveInitialQuickExpenseItemIdFromItineraries([
    itinerary([item({ id: 'item-day-2-first', itemOrder: 1 })], { id: 'day-2', date: '2026-07-11', dayOrder: 2 }),
    itinerary([item({ id: 'item-day-1-second', itemOrder: 2 })], { id: 'day-1', date: '2026-07-10', dayOrder: 1 }),
  ]);

  assert.equal(resolved, 'item-day-1-second');
});

test('resolves the trip day for a selected quick expense item across multiple days', () => {
  const itineraries = [
    itinerary([item({ id: 'item-a' })], { id: 'day-1', dayOrder: 1 }),
    itinerary([item({ id: 'item-b' })], { id: 'day-2', date: '2026-07-11', dayOrder: 2 }),
  ];

  assert.equal(resolveQuickExpenseItemDayId(itineraries, 'item-b'), 'day-2');
  assert.equal(resolveQuickExpenseItemDayId(itineraries, 'missing'), null);
});

test('builds settlement day tabs and filters schedule options to the selected day', () => {
  const viewModel = buildQuickExpenseViewModel({
    currency: 'JPY',
    itinerary: itinerary([item({ id: 'item-a', itemOrder: 1 })], { id: 'day-1', dayOrder: 1 }),
    itineraries: [
      itinerary([item({ id: 'item-a', itemOrder: 1 })], { id: 'day-1', dayOrder: 1 }),
      itinerary(
        [
          item({
            id: 'item-b',
            itemOrder: 2,
            place: { id: 'place-b', name: '오사카성', placeType: 'sights', address: 'Osakajo' },
          }),
        ],
        { id: 'day-2', date: '2026-07-11', dayOrder: 2 },
      ),
    ],
    participants: [participant({ participantId: 'participant-a' })],
    selectedItemId: 'item-b',
    selectedTripDayId: 'day-2',
    shouldChooseItem: false,
  });

  assert.equal(viewModel.dayLabel, '전체 일정');
  assert.equal(viewModel.selectedTripDayId, 'day-2');
  assert.deepEqual(
    viewModel.dayOptions.map((option) => [option.tripDayId, option.dayLabel, option.itemCount, option.selected]),
    [
      ['day-1', 'Day 1', 1, false],
      ['day-2', 'Day 2', 1, true],
    ],
  );
  assert.deepEqual(
    viewModel.itemOptions.map((option) => [option.itemId, option.tripDayId, option.dayLabel, option.orderLabel]),
    [['item-b', 'day-2', 'Day 2', '2']],
  );
  assert.equal(viewModel.selectedItem?.tripDayId, 'day-2');
});

test('derives the selected settlement day from the selected schedule item', () => {
  const viewModel = buildQuickExpenseViewModel({
    currency: 'JPY',
    itinerary: itinerary([item({ id: 'item-a', itemOrder: 1 })], { id: 'day-1', dayOrder: 1 }),
    itineraries: [
      itinerary([item({ id: 'item-a', itemOrder: 1 })], { id: 'day-1', dayOrder: 1 }),
      itinerary([item({ id: 'item-b', itemOrder: 1 })], { id: 'day-2', date: '2026-07-11', dayOrder: 2 }),
    ],
    participants: [participant({ participantId: 'participant-a' })],
    selectedItemId: 'item-b',
    shouldChooseItem: false,
  });

  assert.equal(viewModel.selectedTripDayId, 'day-2');
  assert.deepEqual(
    viewModel.itemOptions.map((option) => option.itemId),
    ['item-b'],
  );
});

test('builds schedule item options with time labels and marks selected item', () => {
  const viewModel = buildQuickExpenseViewModel({
    currency: 'JPY',
    itinerary: itinerary([
      item({
        id: 'item-b',
        itemOrder: 2,
        place: { id: 'place-b', name: '오사카성', placeType: 'sights', address: 'Osakajo' },
        startTime: '13:00',
        endTime: '14:30',
      }),
      item({ id: 'item-a', itemOrder: 1, startTime: '09:00', endTime: '10:00' }),
    ]),
    participants: [participant({ participantId: 'participant-a', displayName: ' 민수 ' })],
    selectedItemId: 'item-b',
    shouldChooseItem: false,
  });

  assert.equal(viewModel.showItemSelector, true);
  assert.equal(viewModel.selectedItem?.itemId, 'item-b');
  assert.deepEqual(
    viewModel.itemOptions.map((option) => [option.itemId, option.placeName, option.placeTypeLabel, option.timeLabel]),
    [
      ['item-a', '도톤보리', '식당', '09:00–10:00'],
      ['item-b', '오사카성', '관광지', '13:00–14:30'],
    ],
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

test('initializes Today-sheet direct split from a saved participant subset only when direct split is available', () => {
  assert.equal(
    resolveQuickExpenseSheetInitialSplitMode({
      requestedSplitMode: undefined,
      participantCount: 2,
      selectedParticipantCount: 1,
    }),
    'manual',
  );
  assert.equal(
    resolveQuickExpenseSheetInitialSplitMode({
      requestedSplitMode: undefined,
      participantCount: 2,
      selectedParticipantCount: 2,
    }),
    'equal',
  );
  assert.equal(
    resolveQuickExpenseSheetInitialSplitMode({
      requestedSplitMode: 'manual',
      participantCount: 1,
      selectedParticipantCount: 1,
    }),
    'equal',
  );
});

test('selects Today-sheet direct split without requiring participant deselection', () => {
  const result = selectQuickExpenseSheetSplitMode({
    currentSplitMode: 'equal',
    nextSplitMode: 'manual',
    participantIds: ['participant-payer', 'participant-friend'],
    selectedSplitParticipantIds: ['participant-payer', 'participant-friend'],
  });

  assert.deepEqual(result, {
    ok: true,
    splitMode: 'manual',
    splitParticipantIds: ['participant-payer', 'participant-friend'],
    message: null,
  });
});

test('keeps Today-sheet direct split unavailable for a one-person split target and returns a reason', () => {
  const result = selectQuickExpenseSheetSplitMode({
    currentSplitMode: 'equal',
    nextSplitMode: 'manual',
    participantIds: ['participant-payer'],
    selectedSplitParticipantIds: ['participant-payer'],
  });

  assert.deepEqual(result, {
    ok: false,
    splitMode: 'equal',
    splitParticipantIds: ['participant-payer'],
    message: '분할 대상자가 1명이라 직접 분할을 선택할 수 없어요.',
  });
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
    { participant: { participantId: 'participant-a', displayName: ' 민수 ', source: 'live' }, amountMinor: 334 },
    { participant: { participantId: null, displayName: '', source: 'fallback' }, amountMinor: 333 },
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
      scheduleItemId: 'item-a',
      splitPolicy: 'equal',
      participantIds: ['participant-b'],
      manualSplitInputs: [],
      payerParticipantId: 'participant-a',
    }),
    {
      ok: true,
      request: {
        scheduleItemId: 'item-a',
        amountMinor: 18500,
        payerParticipantId: 'participant-a',
        splitPolicy: 'equal',
        participantIds: ['participant-b'],
      },
    },
  );

  assert.deepEqual(
    buildCreateQuickExpenseRequest({
      amountInput: '0',
      currency: 'KRW',
      scheduleItemId: null,
      splitPolicy: 'equal',
      participantIds: [],
      manualSplitInputs: [],
      payerParticipantId: null,
    }),
    {
      ok: false,
      errors: {
        amount: '금액을 1 이상 입력해주세요.',
        item: '지출을 연결할 일정을 선택해주세요.',
        payer: '결제자를 선택해주세요.',
        participants: '분할할 사람을 1명 이상 선택해주세요.',
      },
    },
  );
});

test('builds memo update request after quick expense creation and skips blank memo', () => {
  const createValidation = buildCreateQuickExpenseRequest({
    amountInput: '18,500',
    currency: 'KRW',
    scheduleItemId: 'item-a',
    splitPolicy: 'equal',
    participantIds: ['participant-b'],
    manualSplitInputs: [],
    payerParticipantId: 'participant-a',
  });

  assert.equal(createValidation.ok, true);
  if (!createValidation.ok) {
    return;
  }

  assert.deepEqual(
    buildQuickExpenseMemoUpdateRequest({ createRequest: createValidation.request, memoInput: '  저녁 회식  ' }),
    {
      amountMinor: 18500,
      payerParticipantId: 'participant-a',
      splitPolicy: 'equal',
      participantIds: ['participant-b'],
      memo: '저녁 회식',
      scheduleItemId: 'item-a',
    },
  );
  assert.equal(buildQuickExpenseMemoUpdateRequest({ createRequest: createValidation.request, memoInput: '   ' }), null);
});

test('builds manual quick expense request only when split sum matches total', () => {
  assert.deepEqual(
    buildCreateQuickExpenseRequest({
      amountInput: '1,000',
      currency: 'JPY',
      scheduleItemId: 'item-a',
      splitPolicy: 'manual',
      participantIds: ['participant-a'],
      manualSplitInputs: [
        { participantId: 'participant-a', amountInput: '300' },
        { participantId: 'participant-b', amountInput: '700' },
        { participantId: 'participant-c', amountInput: '0' },
      ],
      payerParticipantId: 'participant-payer',
    }),
    {
      ok: true,
      request: {
        scheduleItemId: 'item-a',
        amountMinor: 1000,
        payerParticipantId: 'participant-payer',
        splitPolicy: 'manual',
        splits: [
          { participantId: 'participant-a', amountMinor: 300 },
          { participantId: 'participant-b', amountMinor: 700 },
        ],
      },
    },
  );

  assert.deepEqual(
    buildCreateQuickExpenseRequest({
      amountInput: '1,200',
      currency: 'JPY',
      scheduleItemId: 'item-a',
      splitPolicy: 'manual',
      participantIds: [],
      manualSplitInputs: [
        { participantId: 'participant-a', amountInput: '300' },
        { participantId: 'participant-b', amountInput: '700' },
      ],
      payerParticipantId: 'participant-payer',
    }),
    {
      ok: false,
      errors: {
        participants: '분할 금액의 합계가 총 지출 금액과 같아야 해요.',
      },
    },
  );
});

test('builds manual split summary without mutating entered amounts when total changes', () => {
  const manualSplitInputs = buildQuickExpenseManualSplitInputsFromRows(
    [
      { participantId: 'participant-a', displayName: '민수', amountMinor: 300, amountLabel: '300엔' },
      { participantId: 'participant-b', displayName: '지영', amountMinor: 700, amountLabel: '700엔' },
    ],
    'JPY',
  );

  assert.deepEqual(manualSplitInputs, [
    { participantId: 'participant-a', amountInput: '300' },
    { participantId: 'participant-b', amountInput: '700' },
  ]);

  const changedTotal = buildQuickExpenseManualSplitSummary({
    amountInput: '1200',
    currency: 'JPY',
    manualSplitInputs,
  });

  assert.equal(changedTotal.totalAmountMinor, 1200);
  assert.equal(changedTotal.splitAmountMinor, 1000);
  assert.equal(changedTotal.differenceMinor, 200);
  assert.equal(changedTotal.canSubmit, false);
  assert.equal(changedTotal.validationMessage, '분할 금액의 합계가 총 지출 금액과 같아야 해요.');
  assert.deepEqual(manualSplitInputs, [
    { participantId: 'participant-a', amountInput: '300' },
    { participantId: 'participant-b', amountInput: '700' },
  ]);
});

test('builds route with optional inferred item id and return intent', () => {
  assert.equal(buildQuickExpenseRoute('trip-a', '2026-07-10'), '/trips/trip-a/days/2026-07-10/expenses/quick');
  assert.equal(
    buildQuickExpenseRoute('trip-a', '2026-07-10', 'item-a'),
    '/trips/trip-a/days/2026-07-10/expenses/quick?itemId=item-a',
  );
  assert.equal(
    buildQuickExpenseRoute('trip-a', '2026-07-10', null, 'settle'),
    '/trips/trip-a/days/2026-07-10/expenses/quick?returnTo=settle',
  );
  assert.equal(
    buildQuickExpenseRoute('trip-a', '2026-07-10', 'item a', 'settle'),
    '/trips/trip-a/days/2026-07-10/expenses/quick?itemId=item%20a&returnTo=settle',
  );
});

test('resolves quick expense completion return destinations', () => {
  assert.equal(
    resolveQuickExpenseReturnPath({ tripId: 'trip-a', date: '2026-07-10', returnTo: 'settle' }),
    '/trips/trip-a/settle',
  );
  assert.equal(
    resolveQuickExpenseReturnPath({ tripId: 'trip-a', date: '2026-07-10', returnTo: ['settle'] }),
    '/trips/trip-a/settle',
  );
  assert.equal(
    resolveQuickExpenseReturnPath({ tripId: 'trip-a', date: '2026-07-10' }),
    '/trips/trip-a/itinerary?dayId=2026-07-10',
  );
  assert.equal(
    resolveQuickExpenseReturnPath({ tripId: 'trip-a', date: '2026-07-10', returnTo: 'today' }),
    '/trips/trip-a/itinerary?dayId=2026-07-10',
  );
});

test('parses quick expense routes for overlay interception', () => {
  assert.deepEqual(parseQuickExpenseRoute('/trips/trip-a/days/2026-07-10/expenses/quick'), {
    tripId: 'trip-a',
    date: '2026-07-10',
    itemId: null,
  });
  assert.deepEqual(parseQuickExpenseRoute('/trips/trip-a/days/2026-07-10/expenses/quick?itemId=item%20a'), {
    tripId: 'trip-a',
    date: '2026-07-10',
    itemId: 'item a',
  });
  assert.deepEqual(parseQuickExpenseRoute('/trips/trip-a/days/2026-07-10/expenses/quick?returnTo=settle'), {
    tripId: 'trip-a',
    date: '2026-07-10',
    itemId: null,
  });
  assert.equal(parseQuickExpenseRoute('/trips/trip-a/days/2026-07-10'), null);
});
