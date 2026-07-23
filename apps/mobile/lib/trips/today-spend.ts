import type { Href } from 'expo-router';

import type { DayExpenseListItem, ExpenseKind, SupportedCurrency, TripParticipantListItem } from '@i-um/api-contract';

import { formatMoney } from './quick-expense';

export type TodaySpendCurrencyTotal = {
  amountMinor: number;
  amountLabel: string;
  currency: SupportedCurrency;
};

export type TodaySpendKindBreakdown = {
  regular: TodaySpendCurrencyTotal;
  publicFund: TodaySpendCurrencyTotal;
};

export type TodaySpendMySummary = TodaySpendKindBreakdown & {
  total: TodaySpendCurrencyTotal;
};

export type TodaySettlementSnapshot = {
  amountLabel: string;
  amountMinor: number;
  counterpartyName: string | null;
  direction: 'none' | 'pay' | 'receive';
  helper: string;
  title: string;
};

export type TodayExcludedPublicFundSummary = {
  amountLabel: string;
  amountMinor: number;
  count: number;
  currency: SupportedCurrency;
  label: string;
};

export type TodaySpendPendingExpenseInput = {
  amountMinor: number;
  currency: SupportedCurrency;
  expenseKind?: ExpenseKind;
  includeInSettlement?: boolean;
};

export type TodaySpendSummaryViewModel = {
  primaryTotal: TodaySpendCurrencyTotal;
  additionalTotals: TodaySpendCurrencyTotal[];
  mySpend: TodaySpendMySummary;
  composition: TodaySpendKindBreakdown;
  settlementSnapshot: TodaySettlementSnapshot;
  excludedPublicFundSummary: TodayExcludedPublicFundSummary | null;
  needsReviewCount: number;
  actionLabel: string;
  actionRoute: Href;
};

export function buildTodaySpendSummaryViewModel({
  actionRoute,
  currentUserParticipantId,
  defaultCurrency,
  expenses,
  participants = [],
  pendingExpenses = [],
}: {
  actionRoute: Href;
  currentUserParticipantId?: string | null;
  defaultCurrency: SupportedCurrency;
  expenses: DayExpenseListItem[];
  participants?: TripParticipantListItem[];
  pendingExpenses?: TodaySpendPendingExpenseInput[];
}): TodaySpendSummaryViewModel {
  const totalsByCurrency = new Map<SupportedCurrency, number>();
  const regularCompositionByCurrency = new Map<SupportedCurrency, number>();
  const publicFundCompositionByCurrency = new Map<SupportedCurrency, number>();
  const myRegularByCurrency = new Map<SupportedCurrency, number>();
  const myPublicFundByCurrency = new Map<SupportedCurrency, number>();
  const excludedPublicFundByCurrency = new Map<SupportedCurrency, { amountMinor: number; count: number }>();

  for (const expense of expenses) {
    const kind = normalizeExpenseKind(expense.expenseKind);
    addToCurrencyMap(totalsByCurrency, expense.currency, expense.amountMinor);
    addToCurrencyMap(
      kind === 'public_fund' ? publicFundCompositionByCurrency : regularCompositionByCurrency,
      expense.currency,
      expense.amountMinor,
    );

    if (currentUserParticipantId) {
      const myShare = expense.splits.reduce((sum, split) => {
        if (split.participant.participantId !== currentUserParticipantId) {
          return sum;
        }
        return sum + split.amountMinor;
      }, 0);
      if (myShare > 0) {
        addToCurrencyMap(
          kind === 'public_fund' ? myPublicFundByCurrency : myRegularByCurrency,
          expense.currency,
          myShare,
        );
      }
    }

    if (kind === 'public_fund' && !expense.includeInSettlement) {
      const current = excludedPublicFundByCurrency.get(expense.currency) ?? { amountMinor: 0, count: 0 };
      excludedPublicFundByCurrency.set(expense.currency, {
        amountMinor: current.amountMinor + expense.amountMinor,
        count: current.count + 1,
      });
    }
  }
  for (const pendingExpense of pendingExpenses) {
    const kind = normalizeExpenseKind(pendingExpense.expenseKind);
    addToCurrencyMap(totalsByCurrency, pendingExpense.currency, pendingExpense.amountMinor);
    addToCurrencyMap(
      kind === 'public_fund' ? publicFundCompositionByCurrency : regularCompositionByCurrency,
      pendingExpense.currency,
      pendingExpense.amountMinor,
    );
    if (kind === 'public_fund' && pendingExpense.includeInSettlement === false) {
      const current = excludedPublicFundByCurrency.get(pendingExpense.currency) ?? { amountMinor: 0, count: 0 };
      excludedPublicFundByCurrency.set(pendingExpense.currency, {
        amountMinor: current.amountMinor + pendingExpense.amountMinor,
        count: current.count + 1,
      });
    }
  }

  if (totalsByCurrency.size === 0) {
    totalsByCurrency.set(defaultCurrency, 0);
  }

  const totals = [...totalsByCurrency.entries()]
    .sort(([leftCurrency], [rightCurrency]) => compareSpendCurrency(leftCurrency, rightCurrency, defaultCurrency))
    .map(([currency, amountMinor]) => buildCurrencyTotal(amountMinor, currency));

  const [primaryTotal, ...additionalTotals] = totals;
  const primaryCurrency = primaryTotal.currency;
  const myRegular = myRegularByCurrency.get(primaryCurrency) ?? 0;
  const myPublicFund = myPublicFundByCurrency.get(primaryCurrency) ?? 0;
  const publicFundExcluded = excludedPublicFundByCurrency.get(primaryCurrency) ?? null;

  return {
    primaryTotal,
    additionalTotals,
    mySpend: {
      total: buildCurrencyTotal(myRegular + myPublicFund, primaryCurrency),
      regular: buildCurrencyTotal(myRegular, primaryCurrency),
      publicFund: buildCurrencyTotal(myPublicFund, primaryCurrency),
    },
    composition: {
      regular: buildCurrencyTotal(regularCompositionByCurrency.get(primaryCurrency) ?? 0, primaryCurrency),
      publicFund: buildCurrencyTotal(publicFundCompositionByCurrency.get(primaryCurrency) ?? 0, primaryCurrency),
    },
    settlementSnapshot: buildSettlementSnapshot({
      currentUserParticipantId,
      currency: primaryCurrency,
      expenses,
      participants,
    }),
    excludedPublicFundSummary: publicFundExcluded
      ? {
          amountLabel: formatMoney(publicFundExcluded.amountMinor, primaryCurrency),
          amountMinor: publicFundExcluded.amountMinor,
          count: publicFundExcluded.count,
          currency: primaryCurrency,
          label: `공금 제외 ${publicFundExcluded.count}건 · ${formatMoney(publicFundExcluded.amountMinor, primaryCurrency)}`,
        }
      : null,
    needsReviewCount: 0,
    actionLabel: '지출 등록',
    actionRoute,
  };
}

function buildSettlementSnapshot({
  currentUserParticipantId,
  currency,
  expenses,
  participants,
}: {
  currentUserParticipantId?: string | null;
  currency: SupportedCurrency;
  expenses: DayExpenseListItem[];
  participants: TripParticipantListItem[];
}): TodaySettlementSnapshot {
  const zeroLabel = formatMoney(0, currency);
  if (!currentUserParticipantId) {
    return {
      amountLabel: zeroLabel,
      amountMinor: 0,
      counterpartyName: null,
      direction: 'none',
      helper: settlementSnapshotHelper(currency),
      title: '정산할 금액 없어요',
    };
  }

  const participantIds = new Set<string>(participants.map((participant) => participant.participantId));
  const participantNames = new Map<string, string>(
    participants.map((participant) => [participant.participantId, participant.displayName]),
  );
  participantIds.add(currentUserParticipantId);

  for (const expense of expenses) {
    if (expense.currency !== currency || !expense.includeInSettlement) {
      continue;
    }
    if (expense.payer.participantId) {
      participantIds.add(expense.payer.participantId);
      participantNames.set(expense.payer.participantId, expense.payer.displayName);
    }
    for (const split of expense.splits) {
      if (!split.participant.participantId) {
        continue;
      }
      participantIds.add(split.participant.participantId);
      participantNames.set(split.participant.participantId, split.participant.displayName);
    }
  }

  const balances = new Map<string, number>();
  for (const id of participantIds) {
    balances.set(id, 0);
  }

  for (const expense of expenses) {
    if (expense.currency !== currency || !expense.includeInSettlement) {
      continue;
    }
    if (expense.payer.participantId) {
      balances.set(expense.payer.participantId, (balances.get(expense.payer.participantId) ?? 0) + expense.amountMinor);
    }
    for (const split of expense.splits) {
      if (!split.participant.participantId) {
        continue;
      }
      balances.set(
        split.participant.participantId,
        (balances.get(split.participant.participantId) ?? 0) - split.amountMinor,
      );
    }
  }

  const currentBalance = balances.get(currentUserParticipantId) ?? 0;
  if (currentBalance === 0) {
    return {
      amountLabel: zeroLabel,
      amountMinor: 0,
      counterpartyName: null,
      direction: 'none',
      helper: settlementSnapshotHelper(currency),
      title: '정산할 금액 없어요',
    };
  }

  const participantOrder = [...participantIds];
  const counterpartyId = findCounterparty({
    balances,
    currentUserParticipantId,
    direction: currentBalance < 0 ? 'pay' : 'receive',
    participantOrder,
  });
  const counterpartyName = counterpartyId ? (participantNames.get(counterpartyId) ?? '동행자') : '동행자';
  const amountMinor = Math.abs(currentBalance);
  const amountLabel = formatMoney(amountMinor, currency);
  const direction = currentBalance < 0 ? 'pay' : 'receive';

  return {
    amountLabel,
    amountMinor,
    counterpartyName,
    direction,
    helper: settlementSnapshotHelper(currency),
    title:
      direction === 'pay'
        ? `${counterpartyName}에게 ${amountLabel} 보내면 끝`
        : `${counterpartyName}에게 ${amountLabel} 받으면 끝`,
  };
}

function settlementSnapshotHelper(currency: SupportedCurrency): string {
  return `${currency} 기준 · 정산 포함 지출`;
}

function findCounterparty({
  balances,
  currentUserParticipantId,
  direction,
  participantOrder,
}: {
  balances: Map<string, number>;
  currentUserParticipantId: string;
  direction: 'pay' | 'receive';
  participantOrder: string[];
}) {
  if (direction === 'pay') {
    return participantOrder.find((id) => id !== currentUserParticipantId && (balances.get(id) ?? 0) > 0) ?? null;
  }
  return participantOrder.find((id) => id !== currentUserParticipantId && (balances.get(id) ?? 0) < 0) ?? null;
}

function buildCurrencyTotal(amountMinor: number, currency: SupportedCurrency): TodaySpendCurrencyTotal {
  return {
    amountMinor,
    amountLabel: formatMoney(amountMinor, currency),
    currency,
  };
}

function addToCurrencyMap(map: Map<SupportedCurrency, number>, currency: SupportedCurrency, amountMinor: number) {
  map.set(currency, (map.get(currency) ?? 0) + amountMinor);
}

function normalizeExpenseKind(kind: ExpenseKind | undefined): ExpenseKind {
  if (kind === 'public_fund') {
    return 'public_fund';
  }
  return 'regular';
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
