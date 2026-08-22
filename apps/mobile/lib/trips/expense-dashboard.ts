import type { Href } from 'expo-router';

import type { DayExpenseListItem, ListTripExpensesResponse, SupportedCurrency, TripDay } from '@i-um/api-contract';

import { type ExpenseCategory, getExpenseCategoryMarkerMeta } from '../trip-ui/expense-category-markers';

import { buildExpenseEditRoute, buildTripExpenseEditRoute } from './day-expenses';
import { formatTripDayDate, formatTripDayLabel } from './days';
import { formatMoney } from './quick-expense';

export const tripExpenseBucketId = '__trip_expenses__';

export type ExpenseDashboardTotalSectionViewModel = {
  currency: SupportedCurrency;
  totalMinor: number;
  totalAmountLabel: string;
  includedMinor: number;
  includedAmountLabel: string;
  excludedExpenseCount: number;
  excludedCountLabel: string;
  expenseCount: number;
};

export type ExpenseDashboardCategoryRowViewModel = {
  category: ExpenseCategory;
  label: string;
  color: string;
  amountMinor: number;
  amountLabel: string;
  expenseCount: number;
  expenseCountLabel: string;
  percentage: number;
  percentageLabel: string;
  accessibilityLabel: string;
};

export type ExpenseDashboardCategorySectionViewModel = {
  currency: SupportedCurrency;
  totalMinor: number;
  totalAmountLabel: string;
  rows: ExpenseDashboardCategoryRowViewModel[];
};

export type ExpenseBrowserRowViewModel = {
  id: string;
  title: string;
  amountMinor: number;
  amountLabel: string;
  currency: SupportedCurrency;
  contextLabel: string;
  payerLabel: string;
  splitLabel: string;
  category: ExpenseCategory;
  categoryLabel: string;
  settlementLabel: string | null;
  editRoute: Href;
  accessibilityLabel: string;
};

export type ExpenseDayBrowserSectionViewModel = {
  id: string;
  title: string;
  dateLabel: string | null;
  statusLabel: string;
  totalAmountLabel: string | null;
  expenseCount: number;
  rows: ExpenseBrowserRowViewModel[];
};

export type ExpenseDashboardViewModel =
  | {
      status: 'success';
      title: string;
      helper: string;
      totalSections: ExpenseDashboardTotalSectionViewModel[];
      categorySections: ExpenseDashboardCategorySectionViewModel[];
      recentRows: ExpenseBrowserRowViewModel[];
    }
  | {
      status: 'empty';
      title: string;
      emptyTitle: string;
      helper: string;
    };

export type ExpenseDayBrowserViewModel =
  | {
      status: 'success';
      title: string;
      sections: ExpenseDayBrowserSectionViewModel[];
      selectedSection: ExpenseDayBrowserSectionViewModel;
    }
  | {
      status: 'empty';
      title: string;
      emptyTitle: string;
      helper: string;
    };

export type ExpenseCategoryChipViewModel = {
  category: ExpenseCategory;
  label: string;
  selected: boolean;
};

export type ExpenseCategoryBrowserViewModel =
  | {
      status: 'success';
      title: string;
      categoryChips: ExpenseCategoryChipViewModel[];
      selectedCategorySummary: ExpenseDashboardCategoryRowViewModel;
      rows: ExpenseBrowserRowViewModel[];
    }
  | {
      status: 'empty';
      title: string;
      emptyTitle: string;
      helper: string;
    };

type FlattenedExpense = {
  expense: DayExpenseListItem;
  contextId: string;
  contextLabel: string;
  dateLabel: string | null;
  tripDayId: string | null;
};

export function buildExpenseDashboardViewModel({
  days,
  response,
  tripId,
}: {
  tripId: string;
  days: TripDay[];
  response: ListTripExpensesResponse;
}): ExpenseDashboardViewModel {
  const entries = flattenExpenses({ days, response });
  if (entries.length === 0) {
    return {
      status: 'empty',
      title: '장부',
      emptyTitle: '아직 장부 기록이 없어요.',
      helper: '영수증 촬영이나 직접 입력으로 첫 지출을 장부에 남겨보세요.',
    };
  }

  return {
    status: 'success',
    title: '장부',
    helper: `총 ${entries.length}건의 장부 기록을 관리할 수 있어요.`,
    totalSections: buildTotalSections(entries),
    categorySections: buildCategorySections(entries),
    recentRows: buildRows(entries, tripId).slice(0, 5),
  };
}

export function buildExpenseDayBrowserViewModel({
  days,
  response,
  selectedSectionId,
  tripId,
}: {
  tripId: string;
  days: TripDay[];
  response: ListTripExpensesResponse;
  selectedSectionId?: string | null;
}): ExpenseDayBrowserViewModel {
  const orderedDays = orderDays(days);
  const entries = flattenExpenses({ days: orderedDays, response });
  const sections = buildDaySections({ days: orderedDays, entries, tripId });
  if (sections.length === 0) {
    return {
      status: 'empty',
      title: '일자별 장부',
      emptyTitle: '여행 일정이 없어요.',
      helper: '여행 일정을 만든 뒤 일자별 장부를 확인할 수 있어요.',
    };
  }

  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? sections[0];

  return {
    status: 'success',
    title: '일자별 장부',
    sections,
    selectedSection,
  };
}

export function buildExpenseCategoryBrowserViewModel({
  days,
  response,
  selectedCategory,
  tripId,
}: {
  tripId: string;
  days: TripDay[];
  response: ListTripExpensesResponse;
  selectedCategory?: ExpenseCategory | null;
}): ExpenseCategoryBrowserViewModel {
  const entries = flattenExpenses({ days, response });
  if (entries.length === 0) {
    return {
      status: 'empty',
      title: '카테고리별 장부',
      emptyTitle: '분류할 장부 기록이 없어요.',
      helper: '지출을 등록하면 카테고리별 장부로 모아볼 수 있어요.',
    };
  }

  const allCategoryRows = buildCombinedCategoryRows(entries);
  const activeCategory =
    selectedCategory && allCategoryRows.some((row) => row.category === selectedCategory)
      ? selectedCategory
      : (allCategoryRows[0]?.category ?? 'etc');
  const selectedCategorySummary = allCategoryRows.find((row) => row.category === activeCategory) ?? allCategoryRows[0];
  const categoryEntries = entries.filter((entry) => entry.expense.expenseCategory === activeCategory);

  return {
    status: 'success',
    title: '카테고리별 장부',
    categoryChips: allCategoryRows.map((row) => ({
      category: row.category,
      label: row.label,
      selected: row.category === activeCategory,
    })),
    selectedCategorySummary,
    rows: buildRows(categoryEntries, tripId),
  };
}

function flattenExpenses({
  days,
  response,
}: {
  days: TripDay[];
  response: ListTripExpensesResponse;
}): FlattenedExpense[] {
  const dayById = new Map(days.map((day) => [day.id, day]));
  const entries: FlattenedExpense[] = response.tripExpenses.map((expense) => ({
    expense,
    contextId: tripExpenseBucketId,
    contextLabel: '여행 전체',
    dateLabel: null,
    tripDayId: null,
  }));

  for (const dayExpenses of response.days) {
    const day = dayById.get(dayExpenses.tripDayId) ?? null;
    const contextLabel = day ? formatTripDayLabel(day.dayOrder) : '일자 정보 없음';
    const dateLabel = day ? formatTripDayDate(day.date) : null;
    for (const expense of dayExpenses.expenses) {
      entries.push({
        expense,
        contextId: dayExpenses.tripDayId,
        contextLabel,
        dateLabel,
        tripDayId: dayExpenses.tripDayId,
      });
    }
  }

  return entries.sort(compareEntriesByDateDesc);
}

function buildTotalSections(entries: FlattenedExpense[]): ExpenseDashboardTotalSectionViewModel[] {
  const summaries = new Map<
    SupportedCurrency,
    { total: number; included: number; excludedCount: number; count: number }
  >();
  for (const { expense } of entries) {
    const summary = summaries.get(expense.currency) ?? { total: 0, included: 0, excludedCount: 0, count: 0 };
    summary.total += expense.amountMinor;
    summary.count += 1;
    if (expense.includeInSettlement) {
      summary.included += expense.amountMinor;
    } else {
      summary.excludedCount += 1;
    }
    summaries.set(expense.currency, summary);
  }

  return [...summaries].sort(compareCurrencyEntries).map(([currency, summary]) => ({
    currency,
    totalMinor: summary.total,
    totalAmountLabel: formatMoney(summary.total, currency),
    includedMinor: summary.included,
    includedAmountLabel: formatMoney(summary.included, currency),
    excludedExpenseCount: summary.excludedCount,
    excludedCountLabel: summary.excludedCount > 0 ? `${summary.excludedCount}건 제외` : '제외 없음',
    expenseCount: summary.count,
  }));
}

function buildCategorySections(entries: FlattenedExpense[]): ExpenseDashboardCategorySectionViewModel[] {
  const entriesByCurrency = groupByCurrency(entries);
  return [...entriesByCurrency].sort(compareCurrencyEntries).map(([currency, currencyEntries]) => {
    const totalMinor = sumEntries(currencyEntries);
    return {
      currency,
      totalMinor,
      totalAmountLabel: formatMoney(totalMinor, currency),
      rows: buildCategoryRows(currencyEntries, totalMinor, currency),
    };
  });
}

function buildCombinedCategoryRows(entries: FlattenedExpense[]): ExpenseDashboardCategoryRowViewModel[] {
  const totalMinor = sumEntries(entries);
  const primaryCurrency = entries[0]?.expense.currency ?? 'KRW';
  return buildCategoryRows(entries, totalMinor, primaryCurrency);
}

function buildCategoryRows(
  entries: FlattenedExpense[],
  totalMinor: number,
  labelCurrency: SupportedCurrency,
): ExpenseDashboardCategoryRowViewModel[] {
  const summaries = new Map<ExpenseCategory, { amount: number; count: number }>();
  for (const { expense } of entries) {
    const summary = summaries.get(expense.expenseCategory) ?? { amount: 0, count: 0 };
    summary.amount += expense.amountMinor;
    summary.count += 1;
    summaries.set(expense.expenseCategory, summary);
  }

  return [...summaries]
    .map(([category, summary]) => categoryRow({ category, summary, totalMinor, currency: labelCurrency }))
    .sort((left, right) => right.amountMinor - left.amountMinor || left.label.localeCompare(right.label, 'ko'));
}

function categoryRow({
  category,
  currency,
  summary,
  totalMinor,
}: {
  category: ExpenseCategory;
  currency: SupportedCurrency;
  summary: { amount: number; count: number };
  totalMinor: number;
}): ExpenseDashboardCategoryRowViewModel {
  const meta = getExpenseCategoryMarkerMeta(category);
  const percentage = totalMinor > 0 ? (summary.amount / totalMinor) * 100 : 0;
  const percentageLabel = formatPercentage(percentage);
  const amountLabel = formatMoney(summary.amount, currency);
  const expenseCountLabel = `${summary.count}건`;
  return {
    category,
    label: meta.label,
    color: meta.color,
    amountMinor: summary.amount,
    amountLabel,
    expenseCount: summary.count,
    expenseCountLabel,
    percentage,
    percentageLabel,
    accessibilityLabel: `${meta.label} ${amountLabel}, ${expenseCountLabel}, ${percentageLabel}`,
  };
}

function buildDaySections({
  days,
  entries,
  tripId,
}: {
  days: TripDay[];
  entries: FlattenedExpense[];
  tripId: string;
}): ExpenseDayBrowserSectionViewModel[] {
  const sections: ExpenseDayBrowserSectionViewModel[] = [];
  const tripEntries = entries.filter((entry) => entry.contextId === tripExpenseBucketId);
  sections.push(
    daySection({ id: tripExpenseBucketId, title: '여행 전체', dateLabel: null, entries: tripEntries, tripId }),
  );

  for (const day of days) {
    const dayEntries = entries.filter((entry) => entry.contextId === day.id);
    sections.push(
      daySection({
        id: day.id,
        title: formatTripDayLabel(day.dayOrder),
        dateLabel: formatTripDayDate(day.date),
        entries: dayEntries,
        tripId,
      }),
    );
  }

  return sections;
}

function daySection({
  dateLabel,
  entries,
  id,
  title,
  tripId,
}: {
  id: string;
  title: string;
  dateLabel: string | null;
  entries: FlattenedExpense[];
  tripId: string;
}): ExpenseDayBrowserSectionViewModel {
  const totalAmountLabel = formatEntriesTotalLabel(entries);
  return {
    id,
    title,
    dateLabel,
    statusLabel: entries.length === 0 ? '지출 없음' : `${entries.length}건 · ${totalAmountLabel}`,
    totalAmountLabel,
    expenseCount: entries.length,
    rows: buildRows(entries, tripId),
  };
}

function buildRows(entries: FlattenedExpense[], tripId: string): ExpenseBrowserRowViewModel[] {
  return [...entries].sort(compareEntriesByDateDesc).map((entry) => {
    const { expense } = entry;
    const categoryMeta = getExpenseCategoryMarkerMeta(expense.expenseCategory);
    const title = displayTitle(expense);
    const amountLabel = formatMoney(expense.amountMinor, expense.currency);
    const payerLabel = `${normalizeDisplayName(expense.payer.displayName)} 결제`;
    const splitLabel = `${expense.splits.length}명 분할`;
    const settlementLabel = expense.includeInSettlement ? null : '현장 정산 완료';
    const editRoute =
      entry.contextId === tripExpenseBucketId || !entry.tripDayId
        ? buildTripExpenseEditRoute(tripId, expense.id)
        : buildExpenseEditRoute(tripId, entry.tripDayId, expense.id);
    const detailParts = [entry.contextLabel, categoryMeta.label, payerLabel, splitLabel, settlementLabel].filter(
      (part): part is string => Boolean(part),
    );
    return {
      id: expense.id,
      title,
      amountMinor: expense.amountMinor,
      amountLabel,
      currency: expense.currency,
      contextLabel: entry.contextLabel,
      payerLabel,
      splitLabel,
      category: expense.expenseCategory,
      categoryLabel: categoryMeta.label,
      settlementLabel,
      editRoute,
      accessibilityLabel: `${title} ${amountLabel}. ${detailParts.join(' · ')}`,
    };
  });
}

function formatEntriesTotalLabel(entries: FlattenedExpense[]): string | null {
  if (entries.length === 0) {
    return null;
  }
  return [...groupByCurrency(entries)]
    .sort(compareCurrencyEntries)
    .map(([currency, currencyEntries]) => formatMoney(sumEntries(currencyEntries), currency))
    .join(' · ');
}

function groupByCurrency(entries: FlattenedExpense[]): Map<SupportedCurrency, FlattenedExpense[]> {
  const groups = new Map<SupportedCurrency, FlattenedExpense[]>();
  for (const entry of entries) {
    const group = groups.get(entry.expense.currency) ?? [];
    group.push(entry);
    groups.set(entry.expense.currency, group);
  }
  return groups;
}

function sumEntries(entries: FlattenedExpense[]): number {
  return entries.reduce((total, entry) => total + entry.expense.amountMinor, 0);
}

function compareCurrencyEntries(
  [leftCurrency]: [SupportedCurrency, unknown],
  [rightCurrency]: [SupportedCurrency, unknown],
): number {
  return leftCurrency.localeCompare(rightCurrency);
}

function compareEntriesByDateDesc(left: FlattenedExpense, right: FlattenedExpense): number {
  const dateDiff = right.expense.expenseDate.localeCompare(left.expense.expenseDate);
  if (dateDiff !== 0) {
    return dateDiff;
  }
  const createdDiff = right.expense.createdAt.localeCompare(left.expense.createdAt);
  if (createdDiff !== 0) {
    return createdDiff;
  }
  return left.expense.id.localeCompare(right.expense.id);
}

function orderDays(days: TripDay[]): TripDay[] {
  return [...days].sort((left, right) => left.dayOrder - right.dayOrder);
}

function displayTitle(expense: DayExpenseListItem): string {
  const title = expense.displayTitle.trim();
  return title || expense.place?.name.trim() || '지출';
}

function normalizeDisplayName(value: string): string {
  return value.trim() || '여행자';
}

function formatPercentage(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}
