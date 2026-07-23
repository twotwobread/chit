import assert from 'node:assert/strict';
import test from 'node:test';

import type { DayExpenseListItem, TripParticipantListItem } from '@i-um/api-contract';

import { buildTodaySpendSummaryViewModel } from './today-spend.ts';

function participant(displayName: string, participantId = 'participant-a') {
  return { participantId, displayName, source: 'live' } as const;
}

function tripParticipant(displayName: string, participantId: string): TripParticipantListItem {
  return { participantId, displayName, role: 'member', joinedAt: '2026-07-10T00:00:00Z' };
}

function split(participantId: string, amountMinor: number, displayName = participantId) {
  return { splitOrder: 1, participant: participant(displayName, participantId), amountMinor };
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
    expenseCategory: 'food',
    expenseKind: 'regular',
    payer: participant('민수', 'payer-a'),
    splitPolicy: 'equal',
    includeInSettlement: true,
    splits: [],
    receipt: { exists: false, contentType: null, byteSize: 0, uploadedAt: null },
    createdAt: '2026-07-10T12:00:00Z',
    ...overrides,
  };
}

const baseInput = {
  actionRoute: '/trips/trip-a/days/2026-07-10/expenses/quick' as const,
  currentUserParticipantId: 'me',
  defaultCurrency: 'JPY' as const,
  participants: [tripParticipant('나', 'me'), tripParticipant('민지', 'friend')],
};

test('builds a zero default-currency spend summary when today has no expenses', () => {
  const viewModel = buildTodaySpendSummaryViewModel({ ...baseInput, expenses: [] });

  assert.equal(viewModel.primaryTotal.amountLabel, '0엔');
  assert.equal(viewModel.mySpend.total.amountLabel, '0엔');
  assert.equal(viewModel.mySpend.regular.amountLabel, '0엔');
  assert.equal(viewModel.mySpend.publicFund.amountLabel, '0엔');
  assert.equal(viewModel.composition.regular.amountLabel, '0엔');
  assert.equal(viewModel.composition.publicFund.amountLabel, '0엔');
  assert.equal(viewModel.settlementSnapshot.title, '정산할 금액 없어요');
});

test('sums today spend by currency without converting between currencies', () => {
  const viewModel = buildTodaySpendSummaryViewModel({
    ...baseInput,
    expenses: [
      expense({ id: 'expense-a', amountMinor: 1200, currency: 'JPY' }),
      expense({ id: 'expense-b', amountMinor: 300, currency: 'JPY' }),
      expense({ id: 'expense-c', amountMinor: 18500, currency: 'KRW' }),
    ],
  });

  assert.equal(viewModel.primaryTotal.amountLabel, '1,500엔');
  assert.deepEqual(viewModel.additionalTotals, [{ amountMinor: 18500, amountLabel: '18,500원', currency: 'KRW' }]);
});

test('builds my spend and composition breakdown by regular and public fund shares', () => {
  const viewModel = buildTodaySpendSummaryViewModel({
    ...baseInput,
    expenses: [
      expense({
        id: 'regular-a',
        amountMinor: 9000,
        expenseKind: 'regular',
        payer: participant('나', 'me'),
        splits: [split('me', 3000, '나'), split('friend', 6000, '민지')],
      }),
      expense({
        id: 'fund-a',
        amountMinor: 4000,
        expenseKind: 'public_fund',
        includeInSettlement: false,
        payer: participant('민지', 'friend'),
        splits: [split('me', 1000, '나'), split('friend', 3000, '민지')],
      }),
    ],
  });

  assert.equal(viewModel.primaryTotal.amountLabel, '13,000엔');
  assert.equal(viewModel.mySpend.total.amountLabel, '4,000엔');
  assert.equal(viewModel.mySpend.regular.amountLabel, '3,000엔');
  assert.equal(viewModel.mySpend.publicFund.amountLabel, '1,000엔');
  assert.equal(viewModel.composition.regular.amountLabel, '9,000엔');
  assert.equal(viewModel.composition.publicFund.amountLabel, '4,000엔');
  assert.equal(viewModel.excludedPublicFundSummary?.label, '공금 제외 1건 · 4,000엔');
});

test('builds settlement snapshot from included expenses only', () => {
  const viewModel = buildTodaySpendSummaryViewModel({
    ...baseInput,
    expenses: [
      expense({
        id: 'included-a',
        amountMinor: 8000,
        expenseKind: 'regular',
        includeInSettlement: true,
        payer: participant('민지', 'friend'),
        splits: [split('me', 4000, '나'), split('friend', 4000, '민지')],
      }),
      expense({
        id: 'fund-excluded',
        amountMinor: 5000,
        expenseKind: 'public_fund',
        includeInSettlement: false,
        payer: participant('나', 'me'),
        splits: [split('me', 2500, '나'), split('friend', 2500, '민지')],
      }),
    ],
  });

  assert.equal(viewModel.settlementSnapshot.title, '민지에게 4,000엔 보내면 끝');
  assert.equal(viewModel.settlementSnapshot.helper, 'JPY 기준 · 정산 포함 지출');
  assert.equal(viewModel.settlementSnapshot.amountMinor, 4000);
  assert.equal(viewModel.excludedPublicFundSummary?.amountMinor, 5000);
});

test('orders multi-currency totals by default currency first, then currency code', () => {
  const viewModel = buildTodaySpendSummaryViewModel({
    ...baseInput,
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
