import assert from 'node:assert/strict';
import test from 'node:test';

import type { Expense, GetDayScheduleItemsResponse, TripParticipantListItem } from '@i-um/api-contract';

import {
  buildExpenseEditInitialAmountInput,
  buildExpenseEditInitialManualSplitInputs,
  buildExpenseEditParticipantIds,
  buildExpenseEditViewModel,
  buildUpdateExpenseRequest,
  expenseDeleteFailureMessage,
  expenseSaveFailureMessage,
} from './expense-edit.ts';

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-a',
    tripId: 'trip-a',
    anchorType: 'schedule_item',
    tripDayId: 'day-a',
    scheduleItemId: 'item-a',
    expenseDate: '2026-07-10',
    title: null,
    displayTitle: '도톤보리',
    place: { tripPlaceId: 'place-a', name: '도톤보리', address: 'Dotonbori', placeType: 'food', source: 'live' },
    amountMinor: 1200,
    currency: 'JPY',
    payer: { participantId: 'participant-a', displayName: '민수', source: 'live' },
    memo: '라멘',
    splitPolicy: 'equal',
    includeInSettlement: true,
    splits: [
      { participant: { participantId: 'participant-a', displayName: '민수', source: 'live' }, amountMinor: 1200 },
    ],
    createdAt: '2026-07-10T12:00:00Z',
    ...overrides,
  };
}

function itinerary(): GetDayScheduleItemsResponse {
  return {
    day: { id: 'day-a', date: '2026-07-10', dayOrder: 1, lodgingPlace: null },
    scheduleItems: [
      {
        id: 'item-b',
        itemOrder: 2,
        version: 1,
        isLodging: false,
        place: { id: 'place-b', name: '우메다', address: 'Umeda', placeType: 'sights' },
        arrivedAt: null,
        skippedAt: null,
      },
      {
        id: 'item-a',
        itemOrder: 1,
        version: 1,
        isLodging: false,
        place: { id: 'place-a', name: '도톤보리', address: 'Dotonbori', placeType: 'food' },
        arrivedAt: null,
        skippedAt: null,
      },
    ],
  };
}

const participants: TripParticipantListItem[] = [
  { participantId: 'participant-a', displayName: '민수', role: 'owner', joinedAt: '2026-06-01T00:00:00Z' },
  { participantId: 'participant-b', displayName: '지영', role: 'member', joinedAt: '2026-06-02T00:00:00Z' },
];

test('builds edit view model with selected payer, place clear option, and split preview', () => {
  const viewModel = buildExpenseEditViewModel({
    amountInput: '1001',
    expense: expense(),
    itinerary: itinerary(),
    memoInput: '라멘',
    participants,
    selectedItemId: 'item-a',
    selectedPayerParticipantId: 'participant-a',
  });

  assert.equal(viewModel.title, '지출 수정');
  assert.equal(viewModel.formattedDate, '2026.07.10');
  assert.equal(viewModel.amountLabel, '1,200엔');
  assert.equal(viewModel.showTitleField, false);
  assert.equal(viewModel.showPlaceField, true);
  assert.deepEqual(
    viewModel.placeOptions.map((option) => [option.itemId, option.selected]),
    [
      [null, false],
      ['item-a', true],
      ['item-b', false],
    ],
  );
  assert.deepEqual(
    viewModel.payerOptions.map((option) => [option.participantId, option.selected]),
    [
      ['participant-a', true],
      ['participant-b', false],
    ],
  );
  assert.deepEqual(
    viewModel.splitPreviewRows.map((row) => row.amountMinor),
    [501, 500],
  );
});

test('builds trip-level edit view model without day-specific place selection', () => {
  const viewModel = buildExpenseEditViewModel({
    amountInput: '650000',
    expense: expense({
      anchorType: 'trip',
      tripDayId: null,
      scheduleItemId: null,
      expenseDate: '2026-06-12',
      title: '항공권',
      displayTitle: '항공권',
      place: null,
      amountMinor: 650000,
      currency: 'KRW',
    }),
    itinerary: null,
    memoInput: '',
    participants,
    selectedItemId: null,
    selectedPayerParticipantId: 'participant-a',
  });

  assert.equal(viewModel.dayLabel, '여행 전체');
  assert.equal(viewModel.formattedDate, '2026.06.12');
  assert.equal(viewModel.amountLabel, '650,000원');
  assert.equal(viewModel.showTitleField, true);
  assert.equal(viewModel.showPlaceField, false);
  assert.deepEqual(viewModel.placeOptions, []);
});

test('builds edit day tabs and filters schedule options to the selected day', () => {
  const firstDay = itinerary();
  const secondDay: GetDayScheduleItemsResponse = {
    day: { id: 'day-b', date: '2026-07-11', dayOrder: 2, lodgingPlace: null },
    scheduleItems: [
      {
        id: 'item-c',
        itemOrder: 2,
        version: 1,
        isLodging: false,
        place: { id: 'place-c', name: '오사카성', address: 'Osakajo', placeType: 'sights' },
        arrivedAt: null,
        skippedAt: null,
      },
    ],
  };

  const viewModel = buildExpenseEditViewModel({
    amountInput: '1000',
    expense: expense({ tripDayId: 'day-b', scheduleItemId: 'item-c' }),
    itinerary: firstDay,
    itineraries: [firstDay, secondDay],
    memoInput: '',
    participants,
    selectedItemId: 'item-c',
    selectedPayerParticipantId: 'participant-a',
    selectedTripDayId: 'day-b',
  });

  assert.equal(viewModel.dayLabel, '전체 일정');
  assert.equal(viewModel.selectedTripDayId, 'day-b');
  assert.deepEqual(
    viewModel.dayOptions.map((option) => [option.tripDayId, option.dayLabel, option.itemCount, option.selected]),
    [
      ['day-a', '1일차', 2, false],
      ['day-b', '2일차', 1, true],
    ],
  );
  assert.deepEqual(
    viewModel.itemOptions.map((option) => [option.itemId, option.tripDayId, option.dayLabel, option.orderLabel]),
    [['item-c', 'day-b', '2일차', '2']],
  );
  assert.equal(viewModel.selectedItem?.itemId, 'item-c');
});

test('builds initial amount input from the stored currency', () => {
  assert.equal(buildExpenseEditInitialAmountInput(expense({ amountMinor: 1200, currency: 'JPY' })), '1200');
  assert.equal(buildExpenseEditInitialAmountInput(expense({ amountMinor: 1234, currency: 'USD' })), '12.34');
});

test('shows title field for no-place or titled expenses', () => {
  const noPlaceViewModel = buildExpenseEditViewModel({
    amountInput: '1000',
    expense: expense({ title: '항공권', scheduleItemId: null, place: null }),
    itinerary: itinerary(),
    memoInput: '',
    participants,
    selectedItemId: null,
    selectedPayerParticipantId: 'participant-a',
  });
  const titledScheduleViewModel = buildExpenseEditViewModel({
    amountInput: '1000',
    expense: expense({ title: '예약금' }),
    itinerary: itinerary(),
    memoInput: '',
    participants,
    selectedItemId: 'item-a',
    selectedPayerParticipantId: 'participant-a',
  });

  assert.equal(noPlaceViewModel.showTitleField, true);
  assert.equal(noPlaceViewModel.titlePlaceholder, '예: 항공권, 숙소 예약금');
  assert.equal(titledScheduleViewModel.showTitleField, true);
  assert.equal(titledScheduleViewModel.titlePlaceholder, '선택 입력');
});

test('builds update expense request with trimmed memo and nullable place', () => {
  const result = buildUpdateExpenseRequest({
    amountInput: '2,500',
    currency: 'JPY',
    expenseCategory: 'cafe',
    splitPolicy: 'equal',
    participantIds: buildExpenseEditParticipantIds(participants),
    manualSplitInputs: [],
    payerParticipantId: 'participant-a',
    memoInput: '  저녁 식사  ',
    scheduleItemId: null,
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.deepEqual(result.request, {
    amountMinor: 2500,
    currency: 'JPY',
    expenseCategory: 'cafe',
    payerParticipantId: 'participant-a',
    splitPolicy: 'equal',
    participantIds: ['participant-a', 'participant-b'],
    memo: '저녁 식사',
    scheduleItemId: null,
    tripPlaceId: null,
  });
});

test('builds update expense request linked to a trip place without schedule', () => {
  const result = buildUpdateExpenseRequest({
    amountInput: '2,500',
    currency: 'JPY',
    splitPolicy: 'equal',
    participantIds: buildExpenseEditParticipantIds(participants),
    manualSplitInputs: [],
    payerParticipantId: 'participant-a',
    memoInput: '',
    scheduleItemId: null,
    tripPlaceId: 'place-receipt',
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.equal(result.request.scheduleItemId, null);
  assert.equal(result.request.tripPlaceId, 'place-receipt');
});

test('builds edit participant ids from selected split targets', () => {
  assert.deepEqual(buildExpenseEditParticipantIds(participants, ['participant-b']), ['participant-b']);
  assert.deepEqual(buildExpenseEditParticipantIds(participants, ['missing']), []);
});

test('builds update expense request with an explicit settlement exclusion flag', () => {
  const result = buildUpdateExpenseRequest({
    amountInput: '2,500',
    currency: 'JPY',
    splitPolicy: 'equal',
    participantIds: buildExpenseEditParticipantIds(participants),
    manualSplitInputs: [],
    payerParticipantId: 'participant-a',
    memoInput: '현장 정산',
    scheduleItemId: null,
    includeInSettlement: false,
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.equal(result.request.includeInSettlement, false);
});

test('builds update expense request with nullable general expense title', () => {
  const result = buildUpdateExpenseRequest({
    amountInput: '2,500',
    currency: 'JPY',
    splitPolicy: 'equal',
    participantIds: buildExpenseEditParticipantIds(participants),
    manualSplitInputs: [],
    payerParticipantId: 'participant-a',
    memoInput: '',
    scheduleItemId: null,
    titleInput: '  항공권  ',
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.deepEqual(result.request, {
    amountMinor: 2500,
    currency: 'JPY',
    payerParticipantId: 'participant-a',
    splitPolicy: 'equal',
    participantIds: ['participant-a', 'participant-b'],
    memo: null,
    title: '항공권',
    scheduleItemId: null,
    tripPlaceId: null,
  });

  const clearedTitleResult = buildUpdateExpenseRequest({
    amountInput: '2,500',
    currency: 'JPY',
    splitPolicy: 'equal',
    participantIds: buildExpenseEditParticipantIds(participants),
    manualSplitInputs: [],
    payerParticipantId: 'participant-a',
    memoInput: '',
    scheduleItemId: null,
    titleInput: '   ',
  });
  assert.equal(clearedTitleResult.ok, true);
  if (clearedTitleResult.ok) {
    assert.equal(clearedTitleResult.request.title, null);
  }
});

test('validates update expense request', () => {
  const longMemo = '가'.repeat(241);
  const result = buildUpdateExpenseRequest({
    amountInput: '0',
    currency: 'JPY',
    splitPolicy: 'equal',
    participantIds: [],
    manualSplitInputs: [],
    payerParticipantId: null,
    memoInput: longMemo,
    scheduleItemId: 'item-a',
    titleInput: '가'.repeat(121),
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }
  assert.deepEqual(result.errors, {
    title: '지출명은 120자 이내로 입력해주세요.',
    amount: '금액을 0보다 크게 입력해주세요.',
    payer: '결제자를 선택해주세요.',
    participants: '분할할 사람을 1명 이상 선택해주세요.',
    memo: '메모는 240자 이내로 입력해주세요.',
  });
});

test('builds update expense request with manual split rows', () => {
  const result = buildUpdateExpenseRequest({
    amountInput: '1,000',
    currency: 'JPY',
    splitPolicy: 'manual',
    participantIds: ['participant-a'],
    manualSplitInputs: [
      { participantId: 'participant-a', amountInput: '300' },
      { participantId: 'participant-b', amountInput: '700' },
    ],
    payerParticipantId: 'participant-payer',
    memoInput: '',
    scheduleItemId: 'item-a',
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.deepEqual(result.request, {
    amountMinor: 1000,
    currency: 'JPY',
    payerParticipantId: 'participant-payer',
    splitPolicy: 'manual',
    splits: [
      { participantId: 'participant-a', amountMinor: 300 },
      { participantId: 'participant-b', amountMinor: 700 },
    ],
    memo: null,
    scheduleItemId: 'item-a',
    tripPlaceId: null,
  });
});

test('initializes manual edit amounts from server-returned expense splits', () => {
  const manualExpense = expense({
    splitPolicy: 'manual',
    amountMinor: 1000,
    splits: [
      { participant: { participantId: 'participant-b', displayName: '지영', source: 'live' }, amountMinor: 700 },
      { participant: { participantId: 'participant-a', displayName: '민수', source: 'live' }, amountMinor: 300 },
    ],
  });

  assert.deepEqual(buildExpenseEditInitialManualSplitInputs(manualExpense, 'JPY', participants), [
    { participantId: 'participant-a', amountInput: '300' },
    { participantId: 'participant-b', amountInput: '700' },
  ]);
});

test('builds save and delete failure copy', () => {
  assert.equal(expenseSaveFailureMessage(), '지출을 저장할 수 없어요. 잠시 후 다시 시도해주세요.');
  assert.equal(expenseDeleteFailureMessage(), '지출을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.');
});
