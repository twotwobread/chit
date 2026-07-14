import type { Href } from 'expo-router';

import type {
  DayExpenseListItem,
  GetTripSettlementResponse,
  ListTripExpensesResponse,
  SettlementCurrencySummary as ApiSettlementCurrencySummary,
  SupportedCurrency,
  TripDay,
} from '@i-um/api-contract';

import type { DayChip } from '../trip-ui/DayChips';

import { type DayExpenseRowViewModel, buildDayExpensesViewModel } from './day-expenses';
import { formatTripDayDate } from './days';
import { buildQuickExpenseRoute, formatMoney } from './quick-expense';

export type AuthoritativeTripSettlement = GetTripSettlementResponse;

export function buildSettlementExpenseEntryRoute(tripId: string, tripDayId: string): Href {
  return buildQuickExpenseRoute(tripId, tripDayId, null, 'settle');
}

export function buildSettlementExpenseEntryRouteForDays(tripId: string, days: TripDay[], today: string): Href | null {
  const orderedDays = [...days].sort((left, right) => left.dayOrder - right.dayOrder);
  const entryDay = orderedDays.find((day) => day.date === today) ?? orderedDays[0] ?? null;
  return entryDay ? buildSettlementExpenseEntryRoute(tripId, entryDay.id) : null;
}

export type SettlementExpenseHistoryDayInput = {
  day: TripDay;
  expenses: DayExpenseListItem[];
};

export function buildSettlementExpenseHistoryDayInputs(
  days: TripDay[],
  response: ListTripExpensesResponse,
): SettlementExpenseHistoryDayInput[] {
  const expensesByDayId = new Map(response.days.map((day) => [day.tripDayId, day.expenses]));
  return days.map((day) => ({ day, expenses: expensesByDayId.get(day.id) ?? [] }));
}

export type SettlementExpenseHistoryDaySectionViewModel = {
  dayId: string;
  title: string;
  helper: string;
  expenseCount: number;
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
  today,
  tripId,
}: {
  tripId: string;
  days: SettlementExpenseHistoryDayInput[];
  selectedDayId?: string | null;
  today?: string | null;
}): SettlementExpenseHistoryViewModel {
  const sections = days.map((dayInput): SettlementExpenseHistoryDaySectionViewModel => {
    const dayExpenses = buildDayExpensesViewModel({
      date: dayInput.day.id,
      expenses: dayInput.expenses,
      tripId,
    });
    const rows = dayExpenses.status === 'success' ? dayExpenses.rows : [];
    const expenseCount = rows.length;

    return {
      dayId: dayInput.day.id,
      title: `Day ${dayInput.day.dayOrder}`,
      helper: `${formatTripDayDate(dayInput.day.date)} · ${expenseCount > 0 ? `${expenseCount}건` : '지출 없음'}`,
      expenseCount,
      rows,
      emptyTitle: expenseCount === 0 ? '이 Day에 등록된 지출이 없어요.' : null,
      emptyHelper: expenseCount === 0 ? '다른 Day를 선택하거나 지출을 등록해 주세요.' : null,
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
  const selectedSection = resolveSelectedExpenseHistorySection({ days, sections, selectedDayId, today });

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
      dateLabel: formatTripDayDate(days[index].day.date),
      statusLabel: section.expenseCount > 0 ? `${section.expenseCount}건` : '지출 없음',
    })),
    selectedDayId: selectedSection.dayId,
    selectedSection,
  };
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

  const todayIndex = today ? days.findIndex((dayInput) => dayInput.day.date === today) : -1;
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

export type SettlementNoTransferNoticeViewModel = {
  title: string;
  helper: string;
  primaryAction: { label: string; route: string } | null;
};

export type SettlementCurrencyRuleMode = 'single' | 'separate';

export type SettlementCurrencyRuleNoticeViewModel = {
  mode: SettlementCurrencyRuleMode;
  title: string;
  helper: string;
  currencies: SupportedCurrency[];
};

export type SettlementTransferViewModel =
  | {
      status: 'success';
      summaryTitle: string;
      summaryHelper: string;
      totalTransferCount: number;
      currencyRuleNotice: SettlementCurrencyRuleNoticeViewModel;
      balanceSections: SettlementBalanceCurrencySectionViewModel[];
      sections: SettlementTransferCurrencySectionViewModel[];
      noTransferNotice: SettlementNoTransferNoticeViewModel | null;
    }
  | ({
      status: 'empty';
    } & SettlementNoTransferNoticeViewModel);

export type SettlementTransferFailureViewModel =
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error'; title: string; helper: string; actionLabel: string };

export function getAuthoritativeSettlementCurrencySummaries(
  settlement: GetTripSettlementResponse,
): ApiSettlementCurrencySummary[] {
  return settlement.currencySummaries;
}

export function buildSettlementTransferViewModel({
  settlement,
  todayRoute,
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
  const noTransferNotice = totalTransferCount === 0 ? buildNoTransferNotice(todayRoute) : null;
  if (balanceSections.length === 0 && totalTransferCount === 0) {
    return {
      status: 'empty',
      ...buildNoTransferNotice(todayRoute),
    };
  }

  return {
    status: 'success',
    summaryTitle: totalTransferCount > 0 ? `총 ${totalTransferCount}건을 보내면 정산이 맞아요.` : '정산 현황',
    summaryHelper: totalTransferCount > 0 ? '서버가 계산한 최종 송금 안내예요.' : '서버가 계산한 사람별 요약이에요.',
    totalTransferCount,
    currencyRuleNotice: buildCurrencyRuleNotice(visibleCurrencies),
    balanceSections,
    sections,
    noTransferNotice,
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

function buildNoTransferNotice(_todayRoute?: string | null): SettlementNoTransferNoticeViewModel {
  return {
    title: '보낼 정산이 없어요.',
    helper: '모든 지출이 이미 맞춰졌거나 아직 정산할 지출이 없어요.',
    primaryAction: null,
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
): string | null {
  if (viewModel.status !== 'success' || viewModel.sections.length === 0) {
    return null;
  }

  const lines = viewModel.sections.flatMap((section) =>
    section.transfers.map((transfer) => `${transfer.fromName}님 → ${transfer.toName}님 ${transfer.amountLabel}`),
  );
  if (lines.length === 0) {
    return null;
  }

  return [`[i-um] ${tripName} 정산 요청`, ...lines, '확인 후 송금 부탁드려요.'].join('\n');
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
