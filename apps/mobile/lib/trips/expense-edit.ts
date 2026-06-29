import type {
  Expense,
  GetDayScheduleItemsResponse,
  ScheduleItem,
  SupportedCurrency,
  TripParticipantListItem,
  UpdateExpenseRequest,
} from '@i-um/api-contract';

import { getPlaceTypeLabel, getScheduleItems } from './day-itinerary';
import { formatTripDayDate } from './days';
import {
  buildDefaultEqualSplitPreview,
  buildDefaultSplitParticipantIds,
  formatMoney,
  parseAmountMinor,
  type QuickExpenseSplitRow,
} from './quick-expense';

export type ExpenseEditFormErrors = {
  amount?: string;
  memo?: string;
  payer?: string;
  participants?: string;
};

export type ExpenseEditPayerOption = {
  participantId: string;
  displayName: string;
  selected: boolean;
};

export type ExpenseEditPlaceOption = {
  itemId: string | null;
  label: string;
  detail: string;
  selected: boolean;
};

export type ExpenseEditViewModel = {
  title: string;
  dayLabel: string;
  formattedDate: string;
  amountLabel: string;
  currency: SupportedCurrency;
  currencyLabel: string;
  payerOptions: ExpenseEditPayerOption[];
  placeOptions: ExpenseEditPlaceOption[];
  splitPreviewRows: QuickExpenseSplitRow[];
  splitPreviewMessage: string | null;
  saveLabel: string;
  deleteLabel: string;
};

export function buildExpenseEditViewModel({
  amountInput,
  expense,
  itinerary,
  participants,
  selectedItemId,
  selectedPayerParticipantId,
}: {
  amountInput: string;
  expense: Expense;
  itinerary: GetDayScheduleItemsResponse;
  memoInput: string;
  participants: TripParticipantListItem[];
  selectedItemId: string | null;
  selectedPayerParticipantId: string | null;
}): ExpenseEditViewModel {
  const parsedAmount = amountInput.trim() === '' ? null : parseAmountMinor(amountInput, expense.currency);
  const splitPreviewRows = parsedAmount?.ok
    ? buildDefaultEqualSplitPreview({ amountMinor: parsedAmount.amountMinor, currency: expense.currency, participants })
    : [];

  return {
    title: '지출 수정',
    dayLabel: `Day ${itinerary.day.dayOrder}`,
    formattedDate: formatTripDayDate(expense.expenseDate),
    amountLabel: formatMoney(expense.amountMinor, expense.currency),
    currency: expense.currency,
    currencyLabel: currencyLabel(expense.currency),
    payerOptions: participants.map((participant) => ({
      participantId: participant.participantId,
      displayName: participant.displayName.trim() || '이름 없음',
      selected: participant.participantId === selectedPayerParticipantId,
    })),
    placeOptions: [
      noPlaceOption(selectedItemId),
      ...orderedItems(getScheduleItems(itinerary)).map((item) => placeOption(item, selectedItemId)),
    ],
    splitPreviewRows,
    splitPreviewMessage:
      parsedAmount?.ok && participants.length === 0 ? '참여자 정보를 불러오지 못해 분할을 계산할 수 없어요.' : null,
    saveLabel: '저장',
    deleteLabel: '삭제',
  };
}

export function buildExpenseEditInitialAmountInput(expense: Expense): string {
  if (expense.currency === 'KRW' || expense.currency === 'JPY') {
    return String(expense.amountMinor);
  }
  return (expense.amountMinor / 100).toFixed(2);
}

export function buildUpdateExpenseRequest({
  amountInput,
  currency,
  participantIds,
  scheduleItemId,
  memoInput,
  payerParticipantId,
}: {
  amountInput: string;
  currency: SupportedCurrency;
  participantIds: string[];
  scheduleItemId: string | null;
  memoInput: string;
  payerParticipantId: string | null;
}): { ok: true; request: UpdateExpenseRequest } | { ok: false; errors: ExpenseEditFormErrors } {
  const errors: ExpenseEditFormErrors = {};
  const parsedAmount = parseAmountMinor(amountInput, currency);
  if (!parsedAmount.ok) {
    errors.amount = '금액을 0보다 크게 입력해주세요.';
  }
  if (!payerParticipantId) {
    errors.payer = '결제자를 선택해주세요.';
  }
  if (participantIds.length === 0) {
    errors.participants = '분할할 사람을 1명 이상 선택해주세요.';
  }
  const memo = memoInput.trim();
  if ([...memo].length > 240) {
    errors.memo = '메모는 240자 이내로 입력해주세요.';
  }

  if (Object.keys(errors).length > 0 || !parsedAmount.ok || !payerParticipantId) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    request: {
      amountMinor: parsedAmount.amountMinor,
      payerParticipantId,
      participantIds,
      memo: memo === '' ? null : memo,
      scheduleItemId,
    },
  };
}

export function buildExpenseEditParticipantIds(participants: TripParticipantListItem[]): string[] {
  return buildDefaultSplitParticipantIds(participants);
}

export function expenseSaveFailureMessage(): string {
  return '지출을 저장할 수 없어요. 잠시 후 다시 시도해주세요.';
}

export function expenseDeleteFailureMessage(): string {
  return '지출을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.';
}

function noPlaceOption(selectedItemId: string | null): ExpenseEditPlaceOption {
  return {
    itemId: null,
    label: '장소 없음',
    detail: '연결된 장소를 해제해요.',
    selected: selectedItemId === null,
  };
}

function placeOption(item: ScheduleItem, selectedItemId: string | null): ExpenseEditPlaceOption {
  return {
    itemId: item.id,
    label: item.place.name,
    detail: `${getPlaceTypeLabel(item.place.placeType)} · ${item.place.address}`,
    selected: item.id === selectedItemId,
  };
}

function orderedItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((left, right) => left.itemOrder - right.itemOrder);
}

function currencyLabel(currency: SupportedCurrency): string {
  if (currency === 'KRW') {
    return '원화';
  }
  if (currency === 'JPY') {
    return '엔화';
  }
  if (currency === 'USD') {
    return '달러';
  }
  return '유로';
}
