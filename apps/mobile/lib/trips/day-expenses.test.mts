import assert from 'node:assert/strict';
import test from 'node:test';

import type { DayExpenseListItem } from '@i-um/api-contract';

import { buildDayExpensesViewModel, buildSplitSummary, dayExpensesFailureState } from './day-expenses.ts';

function participant(displayName: string, participantId: string | null = 'participant-a') {
  return { participantId, displayName, source: participantId ? 'live' : 'fallback' } as const;
}

function expense(overrides: Partial<DayExpenseListItem> = {}): DayExpenseListItem {
  return {
    id: 'expense-a',
    anchorType: 'schedule_item',
    tripDayId: 'day-a',
    scheduleItemId: 'item-a',
    expenseDate: '2026-07-10',
    displayTitle: '도톤보리',
    place: { tripPlaceId: 'place-a', name: '도톤보리', address: 'Dotonbori', placeType: 'food', source: 'live' },
    amountMinor: 1200,
    currency: 'JPY',
    payer: participant('민수', 'payer-a'),
    splitPolicy: 'equal',
    splits: [
      { splitOrder: 1, participant: participant('민수', 'payer-a'), amountMinor: 600 },
      { splitOrder: 2, participant: participant('지영', 'participant-b'), amountMinor: 600 },
    ],
    createdAt: '2026-07-10T12:00:00Z',
    ...overrides,
  };
}

test('builds compact read-only day expense rows from canonical API display data', () => {
  const viewModel = buildDayExpensesViewModel({
    tripId: 'trip-a',
    date: '2026-07-10',
    expenses: [expense()],
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') {
    return;
  }
  assert.equal(viewModel.title, '지출');
  assert.deepEqual(viewModel.rows, [
    {
      id: 'expense-a',
      placeName: '도톤보리',
      amountLabel: '1,200엔',
      detailLine: '결제 민수 · 분담 민수 600엔 · 지영 600엔',
    },
  ]);
});

test('preserves API newest-first expense order in the view model', () => {
  const viewModel = buildDayExpensesViewModel({
    tripId: 'trip-a',
    date: '2026-07-10',
    expenses: [expense({ id: 'newer', amountMinor: 2000 }), expense({ id: 'older', amountMinor: 1000 })],
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') {
    return;
  }
  assert.deepEqual(
    viewModel.rows.map((row) => row.id),
    ['newer', 'older'],
  );
});

test('builds empty day expense state with quick expense route', () => {
  const viewModel = buildDayExpensesViewModel({ tripId: 'trip-a', date: '2026-07-10', expenses: [] });

  assert.deepEqual(viewModel, {
    status: 'empty',
    title: '지출',
    emptyTitle: '아직 등록된 지출이 없어요.',
    helper: '지출 등록을 눌러 오늘 쓴 금액을 남겨보세요.',
    actionLabel: '지출 등록',
    actionRoute: '/trips/trip-a/days/2026-07-10/expenses/quick',
  });
});

test('formats split summaries for one, two, and three or more participants', () => {
  assert.equal(
    buildSplitSummary([{ splitOrder: 1, participant: participant('민수'), amountMinor: 1200 }], 'JPY'),
    '분담 민수 1,200엔',
  );
  assert.equal(
    buildSplitSummary(
      [
        { splitOrder: 2, participant: participant('지영', 'participant-b'), amountMinor: 500 },
        { splitOrder: 1, participant: participant('민수', 'participant-a'), amountMinor: 501 },
      ],
      'JPY',
    ),
    '분담 민수 501엔 · 지영 500엔',
  );
  assert.equal(
    buildSplitSummary(
      [
        { splitOrder: 1, participant: participant('민수', 'participant-a'), amountMinor: 400 },
        { splitOrder: 2, participant: participant('지영', 'participant-b'), amountMinor: 400 },
        { splitOrder: 3, participant: participant('유나', 'participant-c'), amountMinor: 400 },
      ],
      'JPY',
    ),
    '분담 민수 400엔 외 2명',
  );
});

test('formats supported currencies in expense rows', () => {
  const viewModel = buildDayExpensesViewModel({
    tripId: 'trip-a',
    date: '2026-07-10',
    expenses: [
      expense({
        currency: 'KRW',
        amountMinor: 18500,
        splits: [{ splitOrder: 1, participant: participant('민수'), amountMinor: 18500 }],
      }),
    ],
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') {
    return;
  }
  assert.equal(viewModel.rows[0].amountLabel, '18,500원');
  assert.equal(viewModel.rows[0].detailLine, '결제 민수 · 분담 민수 18,500원');
  assert.equal(
    buildSplitSummary([{ splitOrder: 1, participant: participant('Alex'), amountMinor: 1234 }], 'USD'),
    '분담 Alex $12.34',
  );
  assert.equal(
    buildSplitSummary([{ splitOrder: 1, participant: participant('Alex'), amountMinor: 1234 }], 'EUR'),
    '분담 Alex €12.34',
  );
});

test('builds retryable day expense failure state', () => {
  assert.deepEqual(dayExpensesFailureState(), {
    title: '지출을 불러올 수 없어요.',
    helper: '잠시 후 다시 시도해주세요.',
    actionLabel: '다시 시도',
  });
});
