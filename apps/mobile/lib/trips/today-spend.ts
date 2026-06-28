import type { Href } from 'expo-router';

import type { DayExpenseListItem, SupportedCurrency } from '@i-um/api-contract';

import { formatMoney } from './quick-expense';

export type TodaySpendCurrencyTotal = {
  amountMinor: number;
  amountLabel: string;
  currency: SupportedCurrency;
};

export type TodaySpendSummaryViewModel = {
  primaryTotal: TodaySpendCurrencyTotal;
  additionalTotals: TodaySpendCurrencyTotal[];
  needsReviewCount: number;
  actionLabel: string;
  actionRoute: Href;
};

export function buildTodaySpendSummaryViewModel({
  actionRoute,
  defaultCurrency,
  expenses,
}: {
  actionRoute: Href;
  defaultCurrency: SupportedCurrency;
  expenses: DayExpenseListItem[];
}): TodaySpendSummaryViewModel {
  const totalsByCurrency = new Map<SupportedCurrency, number>();

  for (const expense of expenses) {
    totalsByCurrency.set(expense.currency, (totalsByCurrency.get(expense.currency) ?? 0) + expense.amountMinor);
  }

  if (totalsByCurrency.size === 0) {
    totalsByCurrency.set(defaultCurrency, 0);
  }

  const totals = [...totalsByCurrency.entries()]
    .sort(([leftCurrency], [rightCurrency]) => compareSpendCurrency(leftCurrency, rightCurrency, defaultCurrency))
    .map(([currency, amountMinor]) => ({
      amountMinor,
      amountLabel: formatMoney(amountMinor, currency),
      currency,
    }));

  const [primaryTotal, ...additionalTotals] = totals;

  return {
    primaryTotal,
    additionalTotals,
    needsReviewCount: 0,
    actionLabel: '지출 등록',
    actionRoute,
  };
}

function compareSpendCurrency(left: SupportedCurrency, right: SupportedCurrency, defaultCurrency: SupportedCurrency) {
  if (left === defaultCurrency && right !== defaultCurrency) {
    return -1;
  }
  if (right === defaultCurrency && left !== defaultCurrency) {
    return 1;
  }
  return left.localeCompare(right);
}
