import assert from 'node:assert/strict';
import test from 'node:test';

import type { DayExpenseListItem, ListTripExpensesResponse, TripDay } from '@i-um/api-contract';

import {
  buildExpenseCategoryBrowserViewModel,
  buildExpenseDashboardViewModel,
  buildExpenseDayBrowserViewModel,
} from './expense-dashboard.ts';

function tripDay(overrides: Partial<TripDay> = {}): TripDay {
  return {
    id: 'day-1',
    date: '2026-07-10',
    dayOrder: 1,
    lodgingPlace: null,
    ...overrides,
  };
}

function participant(displayName: string, participantId: string | null = 'participant-a') {
  return { participantId, displayName, source: participantId ? 'live' : 'fallback' } as const;
}

function expense(overrides: Partial<DayExpenseListItem> = {}): DayExpenseListItem {
  return {
    id: 'expense-a',
    anchorType: 'schedule_item',
    tripDayId: 'day-1',
    scheduleItemId: 'item-a',
    expenseDate: '2026-07-10',
    displayTitle: '스시 오마카세',
    place: { tripPlaceId: 'place-a', name: '스시 오마카세', address: 'Ginza', placeType: 'food', source: 'live' },
    amountMinor: 84000,
    currency: 'KRW',
    expenseCategory: 'food',
    payer: participant('수연', 'payer-a'),
    splitPolicy: 'equal',
    includeInSettlement: true,
    splits: [
      { splitOrder: 1, participant: participant('수연', 'payer-a'), amountMinor: 21000 },
      { splitOrder: 2, participant: participant('민준', 'participant-b'), amountMinor: 21000 },
      { splitOrder: 3, participant: participant('지훈', 'participant-c'), amountMinor: 21000 },
      { splitOrder: 4, participant: participant('유나', 'participant-d'), amountMinor: 21000 },
    ],
    createdAt: '2026-07-10T12:00:00Z',
    ...overrides,
  };
}

function response(overrides: Partial<ListTripExpensesResponse> = {}): ListTripExpensesResponse {
  return {
    tripExpenses: [],
    days: [],
    ...overrides,
  };
}

test('builds expense dashboard summary with category amounts counts and percentages', () => {
  const viewModel = buildExpenseDashboardViewModel({
    tripId: 'trip-a',
    days: [tripDay()],
    response: response({
      days: [
        {
          tripDayId: 'day-1',
          expenses: [
            expense({ id: 'food-a', amountMinor: 60000, expenseCategory: 'food' }),
            expense({ id: 'food-b', amountMinor: 40000, expenseCategory: 'food' }),
            expense({ id: 'transport-a', amountMinor: 50000, expenseCategory: 'transport' }),
            expense({ id: 'excluded-a', amountMinor: 10000, expenseCategory: 'shopping', includeInSettlement: false }),
          ],
        },
      ],
    }),
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') return;
  assert.deepEqual(
    viewModel.totalSections.map((section) => [section.currency, section.totalAmountLabel]),
    [['KRW', '160,000원']],
  );
  assert.deepEqual(
    viewModel.totalSections.map((section) => [section.includedAmountLabel, section.excludedCountLabel]),
    [['150,000원', '1건 제외']],
  );
  assert.deepEqual(
    viewModel.categorySections[0].rows.map((row) => [
      row.category,
      row.label,
      row.amountLabel,
      row.expenseCountLabel,
      row.percentageLabel,
    ]),
    [
      ['food', '식당', '100,000원', '2건', '62.5%'],
      ['transport', '교통', '50,000원', '1건', '31.3%'],
      ['shopping', '쇼핑', '10,000원', '1건', '6.3%'],
    ],
  );
});

test('keeps multi-currency totals and category summaries separate without conversion', () => {
  const viewModel = buildExpenseDashboardViewModel({
    tripId: 'trip-a',
    days: [tripDay()],
    response: response({
      days: [
        {
          tripDayId: 'day-1',
          expenses: [
            expense({ id: 'krw-food', currency: 'KRW', amountMinor: 10000, expenseCategory: 'food' }),
            expense({ id: 'jpy-food', currency: 'JPY', amountMinor: 1000, expenseCategory: 'food' }),
          ],
        },
      ],
    }),
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') return;
  assert.deepEqual(
    viewModel.totalSections.map((section) => [section.currency, section.totalAmountLabel]),
    [
      ['JPY', '1,000엔'],
      ['KRW', '10,000원'],
    ],
  );
  assert.deepEqual(
    viewModel.categorySections.map((section) => [section.currency, section.totalAmountLabel]),
    [
      ['JPY', '1,000엔'],
      ['KRW', '10,000원'],
    ],
  );
});

test('builds day browser with trip-level bucket before Day tabs', () => {
  const viewModel = buildExpenseDayBrowserViewModel({
    tripId: 'trip-a',
    days: [tripDay({ id: 'day-2', date: '2026-07-11', dayOrder: 2 }), tripDay({ id: 'day-1', dayOrder: 1 })],
    response: response({
      tripExpenses: [
        expense({
          id: 'flight-a',
          anchorType: 'trip',
          tripDayId: null,
          scheduleItemId: null,
          expenseDate: '2026-06-01',
          displayTitle: '항공권',
          amountMinor: 320000,
        }),
      ],
      days: [{ tripDayId: 'day-1', expenses: [expense({ id: 'day-expense-a' })] }],
    }),
    selectedSectionId: '__trip_expenses__',
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') return;
  assert.deepEqual(
    viewModel.sections.map((section) => [section.id, section.title, section.statusLabel]),
    [
      ['__trip_expenses__', '여행 전체', '1건 · 320,000원'],
      ['day-1', '1일차', '1건 · 84,000원'],
      ['day-2', '2일차', '지출 없음'],
    ],
  );
  assert.equal(viewModel.selectedSection.id, '__trip_expenses__');
  assert.deepEqual(
    viewModel.selectedSection.rows.map((row) => [row.id, row.contextLabel, row.editRoute]),
    [['flight-a', '여행 전체', '/trips/trip-a/expenses/flight-a/edit']],
  );
});

test('builds category browser filtering selected category', () => {
  const viewModel = buildExpenseCategoryBrowserViewModel({
    tripId: 'trip-a',
    days: [tripDay()],
    response: response({
      days: [
        {
          tripDayId: 'day-1',
          expenses: [
            expense({ id: 'food-a', amountMinor: 84000, expenseCategory: 'food' }),
            expense({ id: 'transport-a', amountMinor: 24000, expenseCategory: 'transport' }),
          ],
        },
      ],
    }),
    selectedCategory: 'food',
  });

  assert.equal(viewModel.status, 'success');
  if (viewModel.status !== 'success') return;
  assert.deepEqual(
    viewModel.categoryChips.map((chip) => [chip.category, chip.label, chip.selected]),
    [
      ['food', '식당', true],
      ['transport', '교통', false],
    ],
  );
  assert.equal(viewModel.selectedCategorySummary.amountLabel, '84,000원');
  assert.equal(viewModel.selectedCategorySummary.expenseCountLabel, '1건');
  assert.equal(viewModel.selectedCategorySummary.percentageLabel, '77.8%');
  assert.deepEqual(
    viewModel.rows.map((row) => [row.id, row.categoryLabel, row.contextLabel]),
    [['food-a', '식당', '1일차']],
  );
});
