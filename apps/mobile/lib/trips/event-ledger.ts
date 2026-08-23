import type {
  CreateEventExpenseRequest,
  EventExpense,
  EventParticipant,
  GetEventSettlementResponse,
  ListEventExpensesResponse,
  SupportedCurrency,
} from '@i-um/api-contract';

import { formatMoney, parseAmountMinor } from './quick-expense';

export type BuildCreateEventExpenseRequestInput = {
  title: string;
  expenseDate: string;
  amountText: string;
  currency?: SupportedCurrency;
  expenseCategory?: CreateEventExpenseRequest['expenseCategory'];
  expenseKind?: CreateEventExpenseRequest['expenseKind'];
  payerParticipantId: string;
  participantIds: string[];
  memo?: string | null;
  includeInSettlement?: boolean;
};

export type EventLedgerRowViewModel = {
  id: string;
  title: string;
  amountLabel: string;
  payerLabel: string;
  detailLabel: string;
};

export type EventLedgerViewModel = {
  totalLabel: string;
  rows: EventLedgerRowViewModel[];
  emptyTitle: string;
  emptyBody: string;
};

export function buildCreateEventExpenseRequest(input: BuildCreateEventExpenseRequestInput): CreateEventExpenseRequest {
  const currency = input.currency ?? 'KRW';
  const parsed = parseAmountMinor(input.amountText, currency);
  return {
    title: input.title.trim(),
    expenseDate: input.expenseDate,
    amountMinor: parsed.ok ? parsed.amountMinor : 0,
    currency,
    expenseCategory: input.expenseCategory ?? 'etc',
    expenseKind: input.expenseKind ?? 'regular',
    payerParticipantId: input.payerParticipantId,
    splitPolicy: 'equal',
    participantIds: input.participantIds,
    memo: normalizeOptionalText(input.memo),
    includeInSettlement: input.includeInSettlement ?? true,
  };
}

export function buildEventLedgerViewModel(response: ListEventExpensesResponse): EventLedgerViewModel {
  const rows = response.expenses.map(eventExpenseRowViewModel);
  const totalByCurrency = new Map<SupportedCurrency, number>();
  for (const expense of response.expenses) {
    totalByCurrency.set(expense.currency, (totalByCurrency.get(expense.currency) ?? 0) + expense.amountMinor);
  }
  const totals = Array.from(totalByCurrency.entries()).map(([currency, amountMinor]) =>
    formatMoney(amountMinor, currency),
  );
  return {
    totalLabel: totals.join(' · ') || '0원',
    rows,
    emptyTitle: '아직 기록된 지출이 없어요',
    emptyBody: '약속에서 함께 쓴 돈을 기록하면 정산까지 바로 이어져요.',
  };
}

export function buildEventSettlementSummaryLabels(response: GetEventSettlementResponse): string[] {
  return response.currencySummaries.flatMap((summary) =>
    summary.balances
      .filter((balance) => balance.netMinor !== 0)
      .map((balance) => {
        const direction = balance.netMinor > 0 ? '받을 돈' : '보낼 돈';
        return `${balance.participant.displayName} ${direction} ${formatMoney(Math.abs(balance.netMinor), summary.currency)}`;
      }),
  );
}

export function firstEventParticipantId(participants: readonly EventParticipant[]): string {
  return participants[0]?.id ?? '';
}

export function eventParticipantIds(participants: readonly EventParticipant[]): string[] {
  return participants.map((participant) => participant.id);
}

function eventExpenseRowViewModel(expense: EventExpense): EventLedgerRowViewModel {
  return {
    id: expense.id,
    title: expense.displayTitle || expense.title || '지출',
    amountLabel: formatMoney(expense.amountMinor, expense.currency),
    payerLabel: `${expense.payer.displayName} 결제`,
    detailLabel: `${expense.expenseDate} · ${expense.payer.displayName} 결제`,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
