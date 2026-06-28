import type { Href } from 'expo-router';

import type { DayExpenseListItem, DayExpenseSplitListItem } from '@i-um/api-contract';

import { buildQuickExpenseRoute, formatMoney } from './quick-expense';

export type DayExpenseRowViewModel = {
  id: string;
  placeName: string;
  amountLabel: string;
  detailLine: string;
};

export type DayExpensesViewModel =
  | {
      status: 'success';
      title: string;
      rows: DayExpenseRowViewModel[];
    }
  | {
      status: 'empty';
      title: string;
      emptyTitle: string;
      helper: string;
      actionLabel: string;
      actionRoute: Href;
    };

export type DayExpensesFailureViewModel = {
  title: string;
  helper: string;
  actionLabel: string;
};

const sectionTitle = '지출';

export function buildDayExpensesViewModel({
  expenses,
  tripId,
  date,
}: {
  expenses: DayExpenseListItem[];
  tripId: string;
  date: string;
}): DayExpensesViewModel {
  if (expenses.length === 0) {
    return {
      status: 'empty',
      title: sectionTitle,
      emptyTitle: '아직 등록된 지출이 없어요.',
      helper: '지출 등록을 눌러 오늘 쓴 금액을 남겨보세요.',
      actionLabel: '지출 등록',
      actionRoute: buildQuickExpenseRoute(tripId, date),
    };
  }

  return {
    status: 'success',
    title: sectionTitle,
    rows: expenses.map((expense) => ({
      id: expense.id,
      placeName: displayTitle(expense),
      amountLabel: formatMoney(expense.amountMinor, expense.currency),
      detailLine: `결제 ${normalizeDisplayName(expense.payer.displayName)} · ${buildSplitSummary(expense.splits, expense.currency)}`,
    })),
  };
}

export function dayExpensesFailureState(): DayExpensesFailureViewModel {
  return {
    title: '지출을 불러올 수 없어요.',
    helper: '잠시 후 다시 시도해주세요.',
    actionLabel: '다시 시도',
  };
}

export function buildSplitSummary(splits: DayExpenseSplitListItem[], currency: DayExpenseListItem['currency']): string {
  const orderedSplits = [...splits].sort((left, right) => left.splitOrder - right.splitOrder);
  if (orderedSplits.length === 0) {
    return '분담 정보 없음';
  }

  const first = splitLabel(orderedSplits[0], currency);
  if (orderedSplits.length === 1) {
    return `분담 ${first}`;
  }

  if (orderedSplits.length === 2) {
    return `분담 ${first} · ${splitLabel(orderedSplits[1], currency)}`;
  }

  return `분담 ${first} 외 ${orderedSplits.length - 1}명`;
}

function splitLabel(split: DayExpenseSplitListItem, currency: DayExpenseListItem['currency']): string {
  return `${normalizeDisplayName(split.participant.displayName)} ${formatMoney(split.amountMinor, currency)}`;
}

function displayTitle(expense: DayExpenseListItem): string {
  const title = expense.displayTitle.trim();
  if (title.length > 0) {
    return title;
  }
  return expense.place?.name.trim() || '지출';
}

function normalizeDisplayName(value: string): string {
  return value.trim() || '여행자';
}
