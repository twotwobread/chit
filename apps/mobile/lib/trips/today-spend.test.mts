import assert from 'node:assert/strict';
import test from 'node:test';

import type { DayExpenseListItem } from '@i-um/api-contract';

import { buildTodaySpendSummaryViewModel } from './today-spend.ts';

function participant(displayName: string, participantId = 'participant-a') {
  return { participantId, displayName, source: 'live' } as const;
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
    includeInSettlement: true,
    splits: [],
    createdAt: '2026-07-10T12:00:00Z',
    ...overrides,
  };
}

test('builds a zero default-currency spend summary when today has no expenses', () => {
  assert.deepEqual(
    buildTodaySpendSummaryViewModel({
      actionRoute: '/trips/trip-a/days/2026-07-10/expenses/quick',
      defaultCurrency: 'JPY',
      expenses: [],
    }),
    {
      primaryTotal: { amountMinor: 0, amountLabel: '0엔', currency: 'JPY' },
      additionalTotals: [],
      needsReviewCount: 0,
      actionLabel: '지출 등록',
      actionRoute: '/trips/trip-a/days/2026-07-10/expenses/quick',
    },
  );
});

test('sums today spend by currency without converting between currencies', () => {
  assert.deepEqual(
    buildTodaySpendSummaryViewModel({
      actionRoute: '/trips/trip-a/days/2026-07-10/expenses/quick',
      defaultCurrency: 'JPY',
      expenses: [
        expense({ id: 'expense-a', amountMinor: 1200, currency: 'JPY' }),
        expense({ id: 'expense-b', amountMinor: 300, currency: 'JPY' }),
        expense({ id: 'expense-c', amountMinor: 18500, currency: 'KRW' }),
      ],
    }),
    {
      primaryTotal: { amountMinor: 1500, amountLabel: '1,500엔', currency: 'JPY' },
      additionalTotals: [{ amountMinor: 18500, amountLabel: '18,500원', currency: 'KRW' }],
      needsReviewCount: 0,
      actionLabel: '지출 등록',
      actionRoute: '/trips/trip-a/days/2026-07-10/expenses/quick',
    },
  );
});

test('includes on-site settled expenses in today spend totals', () => {
  const viewModel = buildTodaySpendSummaryViewModel({
    actionRoute: '/trips/trip-a/days/2026-07-10/expenses/quick',
    defaultCurrency: 'JPY',
    expenses: [
      expense({ id: 'expense-included', amountMinor: 1200, currency: 'JPY', includeInSettlement: true }),
      expense({ id: 'expense-excluded', amountMinor: 800, currency: 'JPY', includeInSettlement: false }),
    ],
  });

  assert.equal(viewModel.primaryTotal.amountMinor, 2000);
  assert.equal(viewModel.primaryTotal.amountLabel, '2,000엔');
});

test('orders multi-currency totals by default currency first, then currency code', () => {
  const viewModel = buildTodaySpendSummaryViewModel({
    actionRoute: '/trips/trip-a/days/2026-07-10/expenses/quick',
    defaultCurrency: 'EUR',
    expenses: [
      expense({ id: 'expense-a', amountMinor: 1234, currency: 'USD' }),
      expense({ id: 'expense-b', amountMinor: 500, currency: 'JPY' }),
      expense({ id: 'expense-c', amountMinor: 990, currency: 'EUR' }),
    ],
  });

  assert.equal(viewModel.primaryTotal.currency, 'EUR');
  assert.deepEqual(
    viewModel.additionalTotals.map((total) => total.currency),
    ['JPY', 'USD'],
  );
});
