import type { Href } from 'expo-router';

import type { DayExpenseListItem, DayExpenseSplitListItem, TripPlaceType } from '@i-um/api-contract';

import type { ExpenseCategory } from '../trip-ui/ExpenseRow';

import { buildQuickExpenseRoute, formatMoney } from './quick-expense';

export type DayExpenseRowViewModel = {
  id: string;
  placeName: string;
  amountMinor: number;
  currency: DayExpenseListItem['currency'];
  amountLabel: string;
  payerLabel: string;
  splitLabel: string;
  detailLine: string;
  category: ExpenseCategory;
  accessibilityLabel: string;
  editRoute: Href | null;
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

export function buildExpenseEditRoute(tripId: string, tripDayId: string, expenseId: string): Href {
  return `/trips/${tripId}/days/${tripDayId}/expenses/${expenseId}/edit` as Href;
}

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
    rows: expenses.map((expense) => {
      const placeName = displayTitle(expense);
      const amountLabel = formatMoney(expense.amountMinor, expense.currency);
      const payerLabel = `결제 ${normalizeDisplayName(expense.payer.displayName)}`;
      const splitLabel = buildSplitSummary(expense.splits, expense.currency);
      const detailLine = `${payerLabel} · ${splitLabel}`;

      return {
        id: expense.id,
        placeName,
        amountMinor: expense.amountMinor,
        currency: expense.currency,
        amountLabel,
        payerLabel,
        splitLabel,
        detailLine,
        category: expenseCategory(expense.place?.placeType),
        accessibilityLabel: `${placeName} ${amountLabel}. ${detailLine}`,
        editRoute: buildExpenseEditRoute(tripId, date, expense.id),
      };
    }),
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

function expenseCategory(placeType?: TripPlaceType | null): ExpenseCategory {
  switch (placeType) {
    case 'cafe':
    case 'food':
    case 'shopping':
    case 'sights':
      return placeType;
    case 'transport':
      return 'transit';
    case 'etc':
    case 'lodging':
    case null:
    case undefined:
      return 'etc';
    default: {
      const exhaustive: never = placeType;
      throw new Error(`Unsupported trip place type: ${exhaustive}`);
    }
  }
}

function normalizeDisplayName(value: string): string {
  return value.trim() || '여행자';
}
