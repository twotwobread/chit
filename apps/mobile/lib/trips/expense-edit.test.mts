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
    displayTitle: '도톤보리',
    place: { tripPlaceId: 'place-a', name: '도톤보리', address: 'Dotonbori', placeType: 'food', source: 'live' },
    amountMinor: 1200,
    currency: 'JPY',
    payer: { participantId: 'participant-a', displayName: '민수', source: 'live' },
    memo: '라멘',
    splitPolicy: 'equal',
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

test('builds initial amount input from the stored currency', () => {
  assert.equal(buildExpenseEditInitialAmountInput(expense({ amountMinor: 1200, currency: 'JPY' })), '1200');
  assert.equal(buildExpenseEditInitialAmountInput(expense({ amountMinor: 1234, currency: 'USD' })), '12.34');
});

test('builds update expense request with trimmed memo and nullable place', () => {
  const result = buildUpdateExpenseRequest({
    amountInput: '2,500',
    currency: 'JPY',
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
    payerParticipantId: 'participant-a',
    splitPolicy: 'equal',
    participantIds: ['participant-a', 'participant-b'],
    memo: '저녁 식사',
    scheduleItemId: null,
  });
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
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }
  assert.deepEqual(result.errors, {
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
    payerParticipantId: 'participant-payer',
    splitPolicy: 'manual',
    splits: [
      { participantId: 'participant-a', amountMinor: 300 },
      { participantId: 'participant-b', amountMinor: 700 },
    ],
    memo: null,
    scheduleItemId: 'item-a',
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
