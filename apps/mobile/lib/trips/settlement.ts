import type { Href } from 'expo-router';
import type { TextTemplateType } from 'react-native-kakao-share-link';

import type {
  DayExpenseListItem,
  GetTripSettlementResponse,
  ListTripExpensesResponse,
  SettlementCurrencySummary as ApiSettlementCurrencySummary,
  SupportedCurrency,
  TripDay,
} from '@i-um/api-contract';

import type { DayChip } from '../trip-ui/DayChips';

import { type ExpenseCategory, getExpenseCategoryMarkerMeta } from '../trip-ui/expense-category-markers';
import { type DayExpenseRowViewModel, buildDayExpensesViewModel, buildTripExpenseEditRoute } from './day-expenses';
import { formatTripDayDate, formatTripDayLabel } from './days';
import { buildQuickExpenseRoute, formatMoney } from './quick-expense';

export type AuthoritativeTripSettlement = GetTripSettlementResponse;

export function buildSettlementExpenseEntryRoute(tripId: string, tripDayId: string, returnDayId?: string | null): Href {
  return buildQuickExpenseRoute(tripId, tripDayId, null, 'settle', returnDayId);
}

export function buildSettlementExpenseEntryRouteForDays(
  tripId: string,
  days: TripDay[],
  today: string,
  selectedDayId?: string | null,
): Href | null {
  const orderedDays = [...days].sort((left, right) => left.dayOrder - right.dayOrder);
  const selectedDay = selectedDayId ? (orderedDays.find((day) => day.id === selectedDayId) ?? null) : null;
  const entryDay = selectedDay ?? orderedDays.find((day) => day.date === today) ?? orderedDays[0] ?? null;
  return entryDay ? buildSettlementExpenseEntryRoute(tripId, entryDay.id, selectedDay?.id ?? null) : null;
}

const tripExpenseSectionId = '__trip_expenses__';

export type SettlementExpenseHistoryDayInput = {
  day: TripDay;
  expenses: DayExpenseListItem[];
};

export function buildSettlementExpenseHistoryDayInputs(
  days: TripDay[],
  response: ListTripExpensesResponse,
): SettlementExpenseHistoryDayInput[] {
  const expensesByDayId = new Map(response.days.map((day) => [day.tripDayId, day.expenses]));
  const tripExpenseSection: SettlementExpenseHistoryDayInput | null =
    response.tripExpenses.length > 0
      ? {
          day: { id: tripExpenseSectionId, date: '', dayOrder: 0, lodgingPlace: null },
          expenses: response.tripExpenses,
        }
      : null;
  const daySections = days.map((day) => ({ day, expenses: expensesByDayId.get(day.id) ?? [] }));
  return tripExpenseSection ? [tripExpenseSection, ...daySections] : daySections;
}

export type SettlementExpenseHistoryDaySectionViewModel = {
  dayId: string;
  title: string;
  helper: string;
  expenseCount: number;
  expenseSummaryLabel: string;
  rows: DayExpenseRowViewModel[];
  emptyTitle: string | null;
  emptyHelper: string | null;
};

export type SettlementExpenseHistoryViewModel =
  | {
      status: 'success';
      title: string;
      helper: string;
      totalExpenseCount: number;
      dayChips: DayChip[];
      selectedDayId: string;
      selectedSection: SettlementExpenseHistoryDaySectionViewModel;
      targetExpenseUnavailableMessage: string | null;
    }
  | {
      status: 'empty';
      title: string;
      emptyTitle: string;
      helper: string;
    };

export type SettlementExpenseHistoryFailureViewModel = {
  title: string;
  helper: string;
  actionLabel: string;
};

export function buildSettlementExpenseHistoryViewModel({
  days,
  selectedDayId,
  targetExpenseId,
  today,
  tripId,
}: {
  tripId: string;
  days: SettlementExpenseHistoryDayInput[];
  selectedDayId?: string | null;
  targetExpenseId?: string | null;
  today?: string | null;
}): SettlementExpenseHistoryViewModel {
  const sections = days.map((dayInput): SettlementExpenseHistoryDaySectionViewModel => {
    const isTripSection = dayInput.day.id === tripExpenseSectionId;
    const dayExpenses = buildDayExpensesViewModel({
      date: dayInput.day.id,
      expenses: dayInput.expenses,
      tripId,
    });
    const baseRows = dayExpenses.status === 'success' ? dayExpenses.rows : [];
    const rows = baseRows.map((row, index) =>
      compactSettlementExpenseRow({
        expense: dayInput.expenses[index],
        isTripSection,
        row,
        sectionDate: isTripSection ? null : dayInput.day.date,
        tripId,
      }),
    );
    const expenseCount = rows.length;
    const expenseSummaryLabel = formatExpenseSummaryLabel(dayInput.expenses.slice(0, expenseCount), expenseCount);

    return {
      dayId: dayInput.day.id,
      title: isTripSection ? '여행 전체' : formatTripDayLabel(dayInput.day.dayOrder),
      helper: isTripSection ? expenseSummaryLabel : `${formatTripDayDate(dayInput.day.date)} · ${expenseSummaryLabel}`,
      expenseCount,
      expenseSummaryLabel,
      rows,
      emptyTitle:
        expenseCount === 0
          ? isTripSection
            ? '여행 전체에 등록된 지출이 없어요.'
            : '이 일차에 등록된 지출이 없어요.'
          : null,
      emptyHelper:
        expenseCount === 0
          ? isTripSection
            ? '항공권이나 예약금처럼 Day와 무관한 지출을 등록해 주세요.'
            : '다른 일차를 선택하거나 지출을 등록해 주세요.'
          : null,
    };
  });

  if (sections.length === 0) {
    return {
      status: 'empty',
      title: '지출 내역',
      emptyTitle: '여행 일정이 없어요.',
      helper: '여행 일정을 만든 뒤 지출을 등록할 수 있어요.',
    };
  }

  const totalExpenseCount = sections.reduce((total, section) => total + section.expenseCount, 0);
  const targetSection = resolveTargetExpenseHistorySection({ sections, targetExpenseId });
  const selectedSection =
    targetSection ?? resolveSelectedExpenseHistorySection({ days, sections, selectedDayId, today });
  const targetExpenseUnavailableMessage =
    targetExpenseId && !targetSection ? '지출을 더 이상 볼 수 없어요. 지출 내역으로 이동했어요.' : null;

  return {
    status: 'success',
    title: '지출 내역',
    helper:
      totalExpenseCount > 0
        ? `총 ${totalExpenseCount}건의 지출을 확인하고 수정할 수 있어요.`
        : '지출을 등록하면 사람별 요약과 정산 정보에 바로 반영돼요.',
    totalExpenseCount,
    dayChips: sections.map((section, index) => ({
      id: section.dayId,
      label: section.title,
      dateLabel: days[index].day.id === tripExpenseSectionId ? undefined : formatTripDayDate(days[index].day.date),
      statusLabel: section.expenseSummaryLabel,
    })),
    selectedDayId: selectedSection.dayId,
    selectedSection,
    targetExpenseUnavailableMessage,
  };
}

function formatExpenseSummaryLabel(expenses: DayExpenseListItem[], expenseCount: number): string {
  if (expenseCount === 0) {
    return '지출 없음';
  }

  const totalLabel = formatExpenseTotalLabel(expenses);
  return totalLabel ? `${expenseCount}건 · ${totalLabel}` : `${expenseCount}건`;
}

function formatExpenseTotalLabel(expenses: DayExpenseListItem[]): string {
  const totalsByCurrency = new Map<SupportedCurrency, number>();
  for (const expense of expenses) {
    totalsByCurrency.set(expense.currency, (totalsByCurrency.get(expense.currency) ?? 0) + expense.amountMinor);
  }

  return [...totalsByCurrency].map(([currency, amountMinor]) => formatMoney(amountMinor, currency)).join(' · ');
}

function compactSettlementExpenseRow({
  expense,
  isTripSection,
  row,
  sectionDate,
  tripId,
}: {
  expense: DayExpenseListItem | undefined;
  isTripSection: boolean;
  row: DayExpenseRowViewModel;
  sectionDate: string | null;
  tripId: string;
}): DayExpenseRowViewModel {
  if (!expense) {
    return row;
  }

  const payerLabel = `${normalizeDisplayName(expense.payer.displayName)} 결제`;
  const splitLabel = compactSplitLabel(expense.splits.length);
  const settlementLabel = expense.includeInSettlement ? null : '현장 정산 완료';
  const dateLabel =
    isTripSection || expense.expenseDate !== sectionDate ? formatTripDayDate(expense.expenseDate) : null;
  const metaParts = [payerLabel, splitLabel, dateLabel, settlementLabel].filter((part): part is string =>
    Boolean(part),
  );
  const detailLine = metaParts.join(' · ');
  const categoryLabel = getExpenseCategoryMarkerMeta(row.category).label;

  return {
    ...row,
    payerLabel,
    splitLabel: dateLabel ? `${splitLabel} · ${dateLabel}` : splitLabel,
    detailLine,
    settlementLabel,
    accessibilityLabel: `${row.placeName} ${row.amountLabel}. ${categoryLabel} 카테고리. ${detailLine}`,
    editRoute: isTripSection ? buildTripExpenseEditRoute(tripId, expense.id) : row.editRoute,
  };
}

function compactSplitLabel(splitCount: number): string {
  if (splitCount < 1) {
    return '분할 정보 없음';
  }
  return `${splitCount}명 분할`;
}

function normalizeDisplayName(value: string): string {
  return value.trim() || '여행자';
}

function resolveTargetExpenseHistorySection({
  sections,
  targetExpenseId,
}: {
  sections: SettlementExpenseHistoryDaySectionViewModel[];
  targetExpenseId?: string | null;
}): SettlementExpenseHistoryDaySectionViewModel | null {
  const normalizedTargetExpenseId = targetExpenseId?.trim() ?? '';
  if (!normalizedTargetExpenseId) {
    return null;
  }
  return sections.find((section) => section.rows.some((row) => row.id === normalizedTargetExpenseId)) ?? null;
}

function resolveSelectedExpenseHistorySection({
  days,
  sections,
  selectedDayId,
  today,
}: {
  days: SettlementExpenseHistoryDayInput[];
  sections: SettlementExpenseHistoryDaySectionViewModel[];
  selectedDayId?: string | null;
  today?: string | null;
}): SettlementExpenseHistoryDaySectionViewModel {
  const selected = selectedDayId ? sections.find((section) => section.dayId === selectedDayId) : null;
  if (selected) {
    return selected;
  }

  const todayIndex = today
    ? days.findIndex((dayInput) => dayInput.day.id !== tripExpenseSectionId && dayInput.day.date === today)
    : -1;
  if (todayIndex >= 0) {
    return sections[todayIndex];
  }

  return sections.find((section) => section.expenseCount > 0) ?? sections[0];
}

export function settlementExpenseHistoryFailureState(): SettlementExpenseHistoryFailureViewModel {
  return {
    title: '지출 내역을 불러올 수 없어요.',
    helper: '정산 정보는 그대로 볼 수 있어요. 잠시 후 다시 시도해주세요.',
    actionLabel: '지출 다시 불러오기',
  };
}

export type SettlementTotalSpendCategoryKey = ExpenseCategory;

export type SettlementTotalSpendCategoryViewModel = {
  key: SettlementTotalSpendCategoryKey;
  label: string;
  color: string;
  amountMinor: number;
  amountLabel: string;
  ratio: number;
  percentageLabel: string;
};

export type SettlementTotalSpendCurrencySectionViewModel = {
  currency: SupportedCurrency;
  title: string;
  helper: string;
  expenseCount: number;
  totalMinor: number;
  totalAmountLabel: string;
  categories: SettlementTotalSpendCategoryViewModel[];
};

export type SettlementTotalSpendViewModel =
  | {
      status: 'success';
      title: string;
      helper: string;
      totalExpenseCount: number;
      sections: SettlementTotalSpendCurrencySectionViewModel[];
    }
  | {
      status: 'empty';
      title: string;
      emptyTitle: string;
      helper: string;
    };

const settlementTotalSpendCategoryOrder: SettlementTotalSpendCategoryKey[] = [
  'food',
  'cafe',
  'lodging',
  'shopping',
  'sights',
  'transport',
  'etc',
];

export function buildSettlementTotalSpendViewModel({
  days,
}: {
  days: SettlementExpenseHistoryDayInput[];
}): SettlementTotalSpendViewModel {
  const currencySummaries = new Map<SupportedCurrency, MutableTotalSpendCurrencySummary>();
  let totalExpenseCount = 0;

  for (const dayInput of days) {
    for (const expense of dayInput.expenses) {
      totalExpenseCount += 1;
      const currencySummary = getOrCreateTotalSpendCurrencySummary(currencySummaries, expense.currency);
      const categoryKey = expense.expenseCategory;
      const categorySummary = getOrCreateTotalSpendCategorySummary(currencySummary.categories, categoryKey);

      currencySummary.expenseCount += 1;
      currencySummary.totalMinor += expense.amountMinor;
      categorySummary.amountMinor += expense.amountMinor;
    }
  }

  if (totalExpenseCount === 0) {
    return {
      status: 'empty',
      title: '총 지출',
      emptyTitle: '아직 등록된 지출이 없어요.',
      helper: '지출을 등록하면 총 지출과 카테고리 비율을 보여드릴게요.',
    };
  }

  const sections = Array.from(currencySummaries.values()).map(
    (summary): SettlementTotalSpendCurrencySectionViewModel => {
      const categories = Array.from(summary.categories.values())
        .sort(compareTotalSpendCategorySummary)
        .map((category): SettlementTotalSpendCategoryViewModel => {
          const meta = getExpenseCategoryMarkerMeta(category.key);
          const ratio = summary.totalMinor > 0 ? category.amountMinor / summary.totalMinor : 0;
          return {
            key: category.key,
            label: meta.label,
            color: meta.color,
            amountMinor: category.amountMinor,
            amountLabel: formatMoney(category.amountMinor, summary.currency),
            ratio,
            percentageLabel: `${Math.round(ratio * 100)}%`,
          };
        });

      return {
        currency: summary.currency,
        title: `${summary.currency} 총 지출`,
        helper: `${summary.expenseCount}건 · ${categories.length}개 카테고리`,
        expenseCount: summary.expenseCount,
        totalMinor: summary.totalMinor,
        totalAmountLabel: formatMoney(summary.totalMinor, summary.currency),
        categories,
      };
    },
  );

  return {
    status: 'success',
    title: '총 지출',
    helper: '통화별 총 지출과 카테고리 비율을 한눈에 볼 수 있어요.',
    totalExpenseCount,
    sections,
  };
}

type MutableTotalSpendCurrencySummary = {
  currency: SupportedCurrency;
  expenseCount: number;
  totalMinor: number;
  categories: Map<SettlementTotalSpendCategoryKey, MutableTotalSpendCategorySummary>;
};

type MutableTotalSpendCategorySummary = {
  key: SettlementTotalSpendCategoryKey;
  amountMinor: number;
};

function getOrCreateTotalSpendCurrencySummary(
  summaries: Map<SupportedCurrency, MutableTotalSpendCurrencySummary>,
  currency: SupportedCurrency,
): MutableTotalSpendCurrencySummary {
  const existing = summaries.get(currency);
  if (existing) {
    return existing;
  }
  const created: MutableTotalSpendCurrencySummary = {
    currency,
    expenseCount: 0,
    totalMinor: 0,
    categories: new Map(),
  };
  summaries.set(currency, created);
  return created;
}

function getOrCreateTotalSpendCategorySummary(
  summaries: Map<SettlementTotalSpendCategoryKey, MutableTotalSpendCategorySummary>,
  key: SettlementTotalSpendCategoryKey,
): MutableTotalSpendCategorySummary {
  const existing = summaries.get(key);
  if (existing) {
    return existing;
  }
  const created = { key, amountMinor: 0 };
  summaries.set(key, created);
  return created;
}

function compareTotalSpendCategorySummary(
  left: MutableTotalSpendCategorySummary,
  right: MutableTotalSpendCategorySummary,
): number {
  const amountDiff = right.amountMinor - left.amountMinor;
  if (amountDiff !== 0) {
    return amountDiff;
  }
  return settlementTotalSpendCategoryOrder.indexOf(left.key) - settlementTotalSpendCategoryOrder.indexOf(right.key);
}

export type SettlementTransferRowViewModel = {
  fromName: string;
  toName: string;
  amountMinor: number;
  amountLabel: string;
};

export type SettlementTransferCurrencySectionViewModel = {
  currency: SupportedCurrency;
  title: string;
  helper: string;
  transferCount: number;
  transfers: SettlementTransferRowViewModel[];
};

export type SettlementBalanceDirection = 'receive' | 'send' | 'settled';

export type SettlementBalanceRowViewModel = {
  displayName: string;
  statusLabel: string | null;
  paidMinor: number;
  paidAmountLabel: string;
  shareMinor: number;
  shareAmountLabel: string;
  netMinor: number;
  netDirection: SettlementBalanceDirection;
  netLabel: string;
  netAmountLabel: string;
};

export type SettlementBalanceCurrencySectionViewModel = {
  currency: SupportedCurrency;
  title: string;
  helper: string;
  participantCount: number;
  rows: SettlementBalanceRowViewModel[];
};

export type SettlementRequestActionViewModel = {
  label: string;
  disabled: boolean;
};

export type SettlementCurrencyRuleMode = 'single' | 'separate';

export type SettlementCurrencyRuleNoticeViewModel = {
  mode: SettlementCurrencyRuleMode;
  title: string;
  helper: string;
  currencies: SupportedCurrency[];
};

export type SettlementTransferViewModel = {
  status: 'success';
  totalTransferCount: number;
  currencyRuleNotice: SettlementCurrencyRuleNoticeViewModel;
  balanceSections: SettlementBalanceCurrencySectionViewModel[];
  sections: SettlementTransferCurrencySectionViewModel[];
  requestAction: SettlementRequestActionViewModel;
};

export type SettlementTransferFailureViewModel =
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error'; title: string; helper: string; actionLabel: string };

export type SettlementDetailExpenseSplitRowViewModel = {
  displayName: string;
  amountMinor: number;
  amountLabel: string;
};

export type SettlementDetailExpenseRowViewModel = {
  id: string;
  title: string;
  contextLabel: string;
  amountMinor: number;
  amountLabel: string;
  payerLabel: string;
  splitRows: SettlementDetailExpenseSplitRowViewModel[];
  categoryLabel: string;
  settlementLabel: string;
  includeInSettlement: boolean;
};

export type SettlementDetailCurrencySectionViewModel = {
  currency: SupportedCurrency;
  title: string;
  totalPaidAmountLabel: string;
  totalShareAmountLabel: string;
  balanceRows: SettlementBalanceRowViewModel[];
  transferRows: SettlementTransferRowViewModel[];
  includedExpenses: SettlementDetailExpenseRowViewModel[];
  excludedExpenses: SettlementDetailExpenseRowViewModel[];
};

export type SettlementDetailViewModel = {
  title: string;
  latestNotice: string;
  formulaCopy: string;
  currencySections: SettlementDetailCurrencySectionViewModel[];
};

export function buildSettlementDetailViewModel({
  expenseDays,
  settlement,
}: {
  tripId: string;
  settlement: GetTripSettlementResponse;
  expenseDays: SettlementExpenseHistoryDayInput[];
}): SettlementDetailViewModel {
  return {
    title: '정산 상세',
    latestNotice: '현재 여행 지출 기준으로 계산된 최신 정산이에요.',
    formulaCopy: '결제 금액 - 부담 금액 = 받을/보낼 금액',
    currencySections: settlement.currencySummaries.map((summary) => {
      const expenseRows = buildSettlementDetailExpenseRows(expenseDays, summary.currency);
      return {
        currency: summary.currency,
        title: `${summary.currency} 정산 상세`,
        totalPaidAmountLabel: formatMoney(summary.totalPaidMinor, summary.currency),
        totalShareAmountLabel: formatMoney(summary.totalShareMinor, summary.currency),
        balanceRows: buildSettlementDetailBalanceRows(summary),
        transferRows: buildSettlementDetailTransferRows(summary),
        includedExpenses: expenseRows.filter((row) => row.includeInSettlement),
        excludedExpenses: expenseRows.filter((row) => !row.includeInSettlement),
      };
    }),
  };
}

function buildSettlementDetailBalanceRows(summary: ApiSettlementCurrencySummary): SettlementBalanceRowViewModel[] {
  return summary.balances.map((balance) => {
    const direction = settlementNetDirection(balance.netMinor);
    return {
      displayName: normalizeDisplayName(balance.participant.displayName),
      statusLabel: balance.participant.participantStatus === 'removed' ? '이전 참여자' : null,
      paidMinor: balance.paidMinor,
      paidAmountLabel: formatMoney(balance.paidMinor, summary.currency),
      shareMinor: balance.shareMinor,
      shareAmountLabel: formatMoney(balance.shareMinor, summary.currency),
      netMinor: balance.netMinor,
      netDirection: direction,
      netLabel: settlementNetLabel(direction),
      netAmountLabel: formatMoney(Math.abs(balance.netMinor), summary.currency),
    };
  });
}

function buildSettlementDetailTransferRows(summary: ApiSettlementCurrencySummary): SettlementTransferRowViewModel[] {
  return summary.suggestedTransfers.map((transfer) => ({
    fromName: normalizeDisplayName(transfer.fromParticipant.displayName),
    toName: normalizeDisplayName(transfer.toParticipant.displayName),
    amountMinor: transfer.amountMinor,
    amountLabel: formatMoney(transfer.amountMinor, summary.currency),
  }));
}

function buildSettlementDetailExpenseRows(
  expenseDays: SettlementExpenseHistoryDayInput[],
  currency: SupportedCurrency,
): SettlementDetailExpenseRowViewModel[] {
  return expenseDays.flatMap((dayInput) => {
    const contextLabel = dayInput.day.id === tripExpenseSectionId ? '여행 전체' : formatTripDayLabel(dayInput.day.dayOrder);
    return dayInput.expenses
      .filter((expense) => expense.currency === currency)
      .map((expense) => settlementDetailExpenseRow(expense, contextLabel));
  });
}

function settlementDetailExpenseRow(
  expense: DayExpenseListItem,
  contextLabel: string,
): SettlementDetailExpenseRowViewModel {
  const categoryMeta = getExpenseCategoryMarkerMeta(expense.expenseCategory);
  return {
    id: expense.id,
    title: expense.displayTitle.trim() || expense.place?.name.trim() || '지출',
    contextLabel,
    amountMinor: expense.amountMinor,
    amountLabel: formatMoney(expense.amountMinor, expense.currency),
    payerLabel: `${normalizeDisplayName(expense.payer.displayName)} 결제`,
    splitRows: [...expense.splits]
      .sort((left, right) => left.splitOrder - right.splitOrder)
      .map((split) => ({
        displayName: normalizeDisplayName(split.participant.displayName),
        amountMinor: split.amountMinor,
        amountLabel: formatMoney(split.amountMinor, expense.currency),
      })),
    categoryLabel: categoryMeta.label,
    settlementLabel: expense.includeInSettlement ? '정산 포함' : '최종 정산 제외',
    includeInSettlement: expense.includeInSettlement,
  };
}

export function getAuthoritativeSettlementCurrencySummaries(
  settlement: GetTripSettlementResponse,
): ApiSettlementCurrencySummary[] {
  return settlement.currencySummaries;
}

export function buildSettlementTransferViewModel({
  settlement,
}: {
  settlement: GetTripSettlementResponse;
  todayRoute?: string | null;
}): SettlementTransferViewModel {
  const visibleCurrencies = settlement.currencySummaries.flatMap((summary): SupportedCurrency[] => {
    if (summary.balances.length === 0 && summary.suggestedTransfers.length === 0) {
      return [];
    }
    return [summary.currency];
  });

  const balanceSections = settlement.currencySummaries.flatMap(
    (summary): SettlementBalanceCurrencySectionViewModel[] => {
      if (summary.balances.length === 0) {
        return [];
      }

      const rows = summary.balances.map((balance) => {
        const netDirection = settlementNetDirection(balance.netMinor);
        return {
          displayName: balance.participant.displayName,
          statusLabel: balance.participant.participantStatus === 'removed' ? '이전 참여자' : null,
          paidMinor: balance.paidMinor,
          paidAmountLabel: formatMoney(balance.paidMinor, summary.currency),
          shareMinor: balance.shareMinor,
          shareAmountLabel: formatMoney(balance.shareMinor, summary.currency),
          netMinor: balance.netMinor,
          netDirection,
          netLabel: settlementNetLabel(netDirection),
          netAmountLabel: formatMoney(Math.abs(balance.netMinor), summary.currency),
        };
      });

      return [
        {
          currency: summary.currency,
          title: `${summary.currency} 사람별 요약`,
          helper: `${rows.length}명`,
          participantCount: rows.length,
          rows,
        },
      ];
    },
  );

  const sections = settlement.currencySummaries.flatMap((summary): SettlementTransferCurrencySectionViewModel[] => {
    if (summary.suggestedTransfers.length === 0) {
      return [];
    }

    const transfers = summary.suggestedTransfers.map((transfer) => ({
      fromName: transfer.fromParticipant.displayName,
      toName: transfer.toParticipant.displayName,
      amountMinor: transfer.amountMinor,
      amountLabel: formatMoney(transfer.amountMinor, summary.currency),
    }));

    return [
      {
        currency: summary.currency,
        title: `${summary.currency} 정산`,
        helper: `${transfers.length}건 송금`,
        transferCount: transfers.length,
        transfers,
      },
    ];
  });

  const totalTransferCount = sections.reduce((total, section) => total + section.transferCount, 0);

  return {
    status: 'success',
    totalTransferCount,
    currencyRuleNotice: buildCurrencyRuleNotice(visibleCurrencies),
    balanceSections,
    sections,
    requestAction: {
      disabled: totalTransferCount === 0,
      label: '정산 요청하기',
    },
  };
}

function buildCurrencyRuleNotice(currencies: SupportedCurrency[]): SettlementCurrencyRuleNoticeViewModel {
  if (currencies.length <= 1) {
    const currency = currencies[0] ?? 'KRW';
    return {
      mode: 'single',
      title: '한 통화로 정산해요.',
      helper: `${currency} 기준으로 결제/부담과 송금 안내를 보여줘요.`,
      currencies: [currency],
    };
  }

  return {
    mode: 'separate',
    title: '통화별로 따로 정산해요.',
    helper: `환율 변환 없이 ${currencies.join(', ')} 금액을 각각 계산해 보여줘요.`,
    currencies,
  };
}

function settlementNetDirection(netMinor: number): SettlementBalanceDirection {
  if (netMinor > 0) {
    return 'receive';
  }
  if (netMinor < 0) {
    return 'send';
  }
  return 'settled';
}

function settlementNetLabel(direction: SettlementBalanceDirection): string {
  if (direction === 'receive') {
    return '받을 금액';
  }
  if (direction === 'send') {
    return '보낼 금액';
  }
  return '차액 없음';
}

export function buildSettlementRequestMessage(
  viewModel: SettlementTransferViewModel,
  tripName = '여행',
  detailLink?: string | null,
): string | null {
  if (viewModel.sections.length === 0) {
    return null;
  }

  const lines = viewModel.sections.flatMap((section) =>
    section.transfers.map((transfer) => `${transfer.fromName}님 → ${transfer.toName}님 ${transfer.amountLabel}`),
  );
  if (lines.length === 0) {
    return null;
  }

  const detailLines = detailLink
    ? [`최신 정산 상세: ${detailLink}`, '현재 여행 지출 기준으로 계산된 최신 정산이에요.']
    : [];

  return [`[i-um] ${tripName} 정산 요청`, ...lines, ...detailLines, '확인 후 송금 부탁드려요.'].join('\n');
}

export function buildKakaoSettlementRequestTemplate(message: string): TextTemplateType {
  return {
    text: message,
    link: {
      mobileWebUrl: 'https://i-um.app',
      webUrl: 'https://i-um.app',
    },
  };
}

export function settlementTransferFailureState(error: unknown): SettlementTransferFailureViewModel {
  const code = errorCode(error);
  const status = errorStatus(error);

  if (code === 'UNAUTHORIZED' || code === 'INVALID_REFRESH_TOKEN' || status === 401) {
    return { status: 'auth' };
  }
  if (status === 400 || status === 403 || status === 404) {
    return { status: 'notFound' };
  }
  if (status === 409 && code === 'SETTLEMENT_DATA_INCONSISTENT') {
    return {
      status: 'error',
      title: '정산을 계산할 수 없어요.',
      helper: '지출 내역을 다시 확인한 뒤 시도해주세요.',
      actionLabel: '다시 시도',
    };
  }
  return {
    status: 'error',
    title: '정산을 불러오지 못했어요.',
    helper: '잠시 후 다시 시도해주세요.',
    actionLabel: '다시 시도',
  };
}

function errorStatus(error: unknown): number | null {
  return typeof error === 'object' && error != null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : null;
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error == null) {
    return null;
  }
  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }
  if ('body' in error && typeof error.body === 'object' && error.body != null) {
    const body = error.body;
    if ('error' in body && typeof body.error === 'object' && body.error != null) {
      const errorBody = body.error;
      if ('code' in errorBody && typeof errorBody.code === 'string') {
        return errorBody.code;
      }
    }
  }
  return null;
}

export type SettlementParticipant = {
  id: string;
  name: string;
};

export type SettlementExpense = {
  amount: number;
  payerParticipantId: string;
  splitParticipantIds?: string[];
  includeInSettlement?: boolean;
};

export type SettlementBalance = {
  participantId: string;
  name: string;
  paidAmount: number;
  shareAmount: number;
  netAmount: number;
};

export type SettlementTransfer = {
  fromParticipantId: string;
  fromName: string;
  toParticipantId: string;
  toName: string;
  amount: number;
};

export function computeSettlementBalances({
  expenses,
  participants,
}: {
  participants: SettlementParticipant[];
  expenses: SettlementExpense[];
}): SettlementBalance[] {
  const balances = participants.map((participant) => ({
    name: participant.name,
    paidAmount: 0,
    participantId: participant.id,
    shareAmount: 0,
  }));
  const indexById = new Map(balances.map((balance, index) => [balance.participantId, index]));

  for (const expense of expenses) {
    if (expense.includeInSettlement === false) {
      continue;
    }

    const payerIndex = indexById.get(expense.payerParticipantId);
    if (payerIndex != null) {
      balances[payerIndex].paidAmount += normalizeAmount(expense.amount);
    }

    const splitIds = normalizeSplitIds(
      expense.splitParticipantIds ?? participants.map((participant) => participant.id),
      indexById,
    );
    if (splitIds.length === 0) {
      continue;
    }

    const shares = splitAmount(normalizeAmount(expense.amount), splitIds.length);
    splitIds.forEach((participantId, splitIndex) => {
      const balanceIndex = indexById.get(participantId);
      if (balanceIndex != null) {
        balances[balanceIndex].shareAmount += shares[splitIndex];
      }
    });
  }

  return balances.map((balance) => ({ ...balance, netAmount: balance.paidAmount - balance.shareAmount }));
}

export function suggestSettlementTransfers(balances: SettlementBalance[]): SettlementTransfer[] {
  const orderByParticipantId = new Map(balances.map((balance, index) => [balance.participantId, index]));
  const creditors = balances
    .filter((balance) => balance.netAmount > 0)
    .map((balance) => ({ balance, remaining: normalizeAmount(balance.netAmount) }))
    .sort((left, right) =>
      compareByAmountThenOrder(right.remaining, left.remaining, left.balance, right.balance, orderByParticipantId),
    );
  const debtors = balances
    .filter((balance) => balance.netAmount < 0)
    .map((balance) => ({ balance, remaining: normalizeAmount(Math.abs(balance.netAmount)) }))
    .sort((left, right) =>
      compareByAmountThenOrder(right.remaining, left.remaining, left.balance, right.balance, orderByParticipantId),
    );

  const transfers: SettlementTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.remaining, creditor.remaining);

    if (amount > 0) {
      transfers.push({
        amount,
        fromName: debtor.balance.name,
        fromParticipantId: debtor.balance.participantId,
        toName: creditor.balance.name,
        toParticipantId: creditor.balance.participantId,
      });
    }

    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining === 0) {
      debtorIndex += 1;
    }
    if (creditor.remaining === 0) {
      creditorIndex += 1;
    }
  }

  return transfers;
}

function normalizeAmount(amount: number): number {
  return Math.round(amount);
}

function normalizeSplitIds(participantIds: string[], indexById: Map<string, number>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const participantId of participantIds) {
    if (indexById.has(participantId) && !seen.has(participantId)) {
      seen.add(participantId);
      out.push(participantId);
    }
  }

  return out;
}

function splitAmount(amount: number, count: number): number[] {
  const base = Math.floor(amount / count);
  const remainder = amount - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function compareByAmountThenOrder(
  rightAmount: number,
  leftAmount: number,
  left: SettlementBalance,
  right: SettlementBalance,
  orderByParticipantId: Map<string, number>,
): number {
  const amountDiff = rightAmount - leftAmount;
  if (amountDiff !== 0) {
    return amountDiff;
  }

  return (orderByParticipantId.get(left.participantId) ?? 0) - (orderByParticipantId.get(right.participantId) ?? 0);
}
