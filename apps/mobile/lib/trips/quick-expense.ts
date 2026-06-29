import type { Href } from 'expo-router';

import type {
  CreateQuickExpenseRequest,
  ScheduleItem,
  ExpenseSplit,
  GetDayScheduleItemsResponse,
  SupportedCurrency,
  TripParticipantListItem,
} from '@i-um/api-contract';

import { getPlaceTypeLabel, getScheduleItems } from './day-itinerary';
import { formatTripDayDate } from './days';

export type QuickExpenseFormErrors = {
  amount?: string;
  item?: string;
  payer?: string;
  participants?: string;
};

export type QuickExpenseSplitPolicy = 'equal' | 'manual';

export type QuickExpenseManualSplitInput = {
  participantId: string;
  amountInput: string;
};

export type QuickExpenseManualSplitSummary = {
  totalAmountMinor: number | null;
  splitAmountMinor: number;
  differenceMinor: number | null;
  canSubmit: boolean;
  validationMessage: string | null;
  requestSplits: { participantId: string; amountMinor: number }[];
};

export type QuickExpenseItemOption = {
  itemId: string;
  orderLabel: string;
  placeName: string;
  placeTypeLabel: string;
  address: string;
  selected: boolean;
};

export type QuickExpensePayerOption = {
  participantId: string;
  displayName: string;
  selected: boolean;
};

export type QuickExpenseSplitParticipantOption = {
  participantId: string;
  displayName: string;
  selected: boolean;
};

export type QuickExpenseSplitRow = {
  participantId: string | null;
  displayName: string;
  amountMinor: number;
  amountLabel: string;
};

export type QuickExpenseSavedSplitSummary = {
  amountLabel: string;
  splitRows: QuickExpenseSplitRow[];
};

export type QuickExpenseViewModel = {
  dayLabel: string;
  formattedDate: string;
  currency: SupportedCurrency;
  currencyLabel: string;
  selectedItem: QuickExpenseItemOption | null;
  itemOptions: QuickExpenseItemOption[];
  payerOptions: QuickExpensePayerOption[];
  splitParticipantOptions: QuickExpenseSplitParticipantOption[];
  splitPreviewRows: QuickExpenseSplitRow[];
  splitPreviewMessage: string | null;
  splitParticipantError: string | null;
  showItemSelector: boolean;
  helper: string | null;
  emptyMessage: string | null;
};

const zeroDecimalCurrencies = new Set<SupportedCurrency>(['KRW', 'JPY']);

export type QuickExpenseRouteTarget = {
  tripId: string;
  date: string;
  itemId: string | null;
};

export function buildQuickExpenseRoute(tripId: string, tripDayId: string, itemId?: string | null): Href {
  const base = `/trips/${tripId}/days/${tripDayId}/expenses/quick`;
  return (itemId ? `${base}?itemId=${encodeURIComponent(itemId)}` : base) as Href;
}

export function parseQuickExpenseRoute(route: Href): QuickExpenseRouteTarget | null {
  if (typeof route !== 'string') {
    return null;
  }

  const [path, query = ''] = route.split('?');
  const match = /^\/trips\/([^/]+)\/days\/([^/]+)\/expenses\/quick$/.exec(path);
  if (!match) {
    return null;
  }

  const itemId = new URLSearchParams(query).get('itemId')?.trim() || null;
  return {
    tripId: decodeURIComponent(match[1]),
    date: decodeURIComponent(match[2]),
    itemId,
  };
}

export function inferCurrentQuickExpenseItem(items: ScheduleItem[]): ScheduleItem | null {
  return orderedItems(items).find((item) => item.arrivedAt === null) ?? null;
}

export function hasQuickExpenseEntry(items: ScheduleItem[]): boolean {
  return items.length > 0;
}

export function buildDefaultSplitParticipantIds(participants: TripParticipantListItem[]): string[] {
  return participants.map((participant) => participant.participantId);
}

export function toggleQuickExpenseSplitParticipant(selectedParticipantIds: string[], participantId: string): string[] {
  return selectedParticipantIds.includes(participantId)
    ? selectedParticipantIds.filter((selectedParticipantId) => selectedParticipantId !== participantId)
    : [...selectedParticipantIds, participantId];
}

export function buildQuickExpenseViewModel({
  amountInput,
  currency,
  itinerary,
  participants,
  selectedItemId,
  selectedSplitParticipantIds,
  shouldChooseItem,
}: {
  amountInput?: string;
  currency: SupportedCurrency;
  itinerary: GetDayScheduleItemsResponse;
  participants: TripParticipantListItem[];
  selectedItemId: string | null;
  selectedSplitParticipantIds?: string[];
  shouldChooseItem: boolean;
}): QuickExpenseViewModel {
  const itemOptions = orderedItems(getScheduleItems(itinerary)).map((item) => toItemOption(item, selectedItemId));
  const selectedItem = itemOptions.find((item) => item.selected) ?? null;
  const showItemSelector = shouldChooseItem || selectedItem === null;
  const selectedParticipantSet = new Set(selectedSplitParticipantIds ?? buildDefaultSplitParticipantIds(participants));
  const selectedParticipants = participants.filter((participant) =>
    selectedParticipantSet.has(participant.participantId),
  );
  const parsedAmount =
    amountInput === undefined || amountInput.trim() === '' ? null : parseAmountMinor(amountInput, currency);
  const splitPreviewRows = parsedAmount?.ok
    ? buildDefaultEqualSplitPreview({
        amountMinor: parsedAmount.amountMinor,
        currency,
        participants: selectedParticipants,
      })
    : [];
  return {
    dayLabel: `Day ${itinerary.day.dayOrder}`,
    formattedDate: formatTripDayDate(itinerary.day.date),
    currency,
    currencyLabel: currencyLabel(currency),
    selectedItem,
    itemOptions,
    payerOptions: participants.map((participant) => ({
      participantId: participant.participantId,
      displayName: normalizeParticipantDisplayName(participant.displayName),
      selected: false,
    })),
    splitParticipantOptions: participants.map((participant) => ({
      participantId: participant.participantId,
      displayName: normalizeParticipantDisplayName(participant.displayName),
      selected: selectedParticipantSet.has(participant.participantId),
    })),
    splitPreviewRows,
    splitPreviewMessage:
      parsedAmount?.ok && participants.length === 0 ? '참여자 정보를 불러오지 못해 분할을 계산할 수 없어요.' : null,
    splitParticipantError:
      participants.length > 0 && selectedParticipants.length === 0 ? '분할할 사람을 1명 이상 선택해주세요.' : null,
    showItemSelector,
    helper:
      showItemSelector && itemOptions.length > 0
        ? '현재 장소를 확정할 수 없어 오늘 일정에서 장소를 선택해주세요.'
        : null,
    emptyMessage: itemOptions.length === 0 ? '오늘 일정에 등록된 장소가 없어 지출을 저장할 수 없어요.' : null,
  };
}

export function parseAmountMinor(
  input: string,
  currency: SupportedCurrency,
): { ok: true; amountMinor: number } | { ok: false; message: string } {
  const normalized = input.trim().replaceAll(',', '');
  if (normalized === '') {
    return amountError();
  }

  if (zeroDecimalCurrencies.has(currency)) {
    if (!/^\d+$/.test(normalized)) {
      return amountError();
    }
    const amount = Number(normalized);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      return amountError();
    }
    return { ok: true, amountMinor: amount };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return amountError();
  }
  const [major, fraction = ''] = normalized.split('.');
  const amount = Number(major) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount < 1) {
    return amountError();
  }
  return { ok: true, amountMinor: amount };
}

export function formatMoney(amountMinor: number, currency: SupportedCurrency): string {
  if (currency === 'KRW') {
    return `${formatInteger(amountMinor)}원`;
  }
  if (currency === 'JPY') {
    return `${formatInteger(amountMinor)}엔`;
  }
  const amount = (amountMinor / 100).toFixed(2);
  const [major, fraction] = amount.split('.');
  const prefix = currency === 'USD' ? '$' : '€';
  return `${prefix}${formatInteger(Number(major))}.${fraction}`;
}

export function formatAmountInput(amountMinor: number, currency: SupportedCurrency): string {
  if (currency === 'KRW' || currency === 'JPY') {
    return String(amountMinor);
  }
  return (amountMinor / 100).toFixed(2);
}

export function buildDefaultEqualSplitPreview({
  amountMinor,
  currency,
  participants,
}: {
  amountMinor: number;
  currency: SupportedCurrency;
  participants: TripParticipantListItem[];
}): QuickExpenseSplitRow[] {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || participants.length === 0) {
    return [];
  }

  const orderedParticipants = [...participants].sort(compareParticipantsForSplit);
  const participantCount = orderedParticipants.length;
  const base = Math.floor(amountMinor / participantCount);
  const remainder = amountMinor % participantCount;
  return orderedParticipants.map((participant, index) => {
    const splitAmount = base + (index < remainder ? 1 : 0);
    return {
      participantId: participant.participantId,
      displayName: normalizeParticipantDisplayName(participant.displayName),
      amountMinor: splitAmount,
      amountLabel: formatMoney(splitAmount, currency),
    };
  });
}

export function buildSavedEqualSplitSummary({
  amountMinor,
  currency,
  splits,
}: {
  amountMinor: number;
  currency: SupportedCurrency;
  splits: ExpenseSplit[];
}): QuickExpenseSavedSplitSummary {
  return {
    amountLabel: formatMoney(amountMinor, currency),
    splitRows: splits.map((split) => ({
      participantId: split.participant.participantId,
      displayName: normalizeParticipantDisplayName(split.participant.displayName),
      amountMinor: split.amountMinor,
      amountLabel: formatMoney(split.amountMinor, currency),
    })),
  };
}

export function buildQuickExpenseManualSplitInputsFromRows(
  rows: { participantId: string | null; amountMinor: number }[],
  currency: SupportedCurrency,
): QuickExpenseManualSplitInput[] {
  return rows
    .filter((row): row is { participantId: string; amountMinor: number } => row.participantId !== null)
    .map((row) => ({ participantId: row.participantId, amountInput: formatAmountInput(row.amountMinor, currency) }));
}

export function buildQuickExpenseManualSplitSummary({
  amountInput,
  currency,
  manualSplitInputs,
}: {
  amountInput: string;
  currency: SupportedCurrency;
  manualSplitInputs: QuickExpenseManualSplitInput[];
}): QuickExpenseManualSplitSummary {
  const parsedTotal = parseAmountMinor(amountInput, currency);
  const totalAmountMinor = parsedTotal.ok ? parsedTotal.amountMinor : null;
  const requestSplits: { participantId: string; amountMinor: number }[] = [];
  let splitAmountMinor = 0;
  let invalidManualAmount = false;

  for (const splitInput of manualSplitInputs) {
    const parsedSplit = parseManualSplitAmountInput(splitInput.amountInput, currency);
    if (parsedSplit.status === 'invalid') {
      invalidManualAmount = true;
      continue;
    }
    if (parsedSplit.status === 'empty') {
      continue;
    }
    requestSplits.push({ participantId: splitInput.participantId, amountMinor: parsedSplit.amountMinor });
    splitAmountMinor += parsedSplit.amountMinor;
  }

  if (invalidManualAmount) {
    return {
      totalAmountMinor,
      splitAmountMinor,
      differenceMinor: totalAmountMinor === null ? null : totalAmountMinor - splitAmountMinor,
      canSubmit: false,
      validationMessage: '금액을 1 이상 입력해주세요.',
      requestSplits,
    };
  }
  if (requestSplits.length === 0) {
    return {
      totalAmountMinor,
      splitAmountMinor,
      differenceMinor: totalAmountMinor === null ? null : totalAmountMinor - splitAmountMinor,
      canSubmit: false,
      validationMessage: '분할할 금액을 1명 이상 입력해주세요.',
      requestSplits,
    };
  }
  if (totalAmountMinor === null) {
    return {
      totalAmountMinor,
      splitAmountMinor,
      differenceMinor: null,
      canSubmit: false,
      validationMessage: null,
      requestSplits,
    };
  }
  const differenceMinor = totalAmountMinor - splitAmountMinor;
  if (differenceMinor !== 0) {
    return {
      totalAmountMinor,
      splitAmountMinor,
      differenceMinor,
      canSubmit: false,
      validationMessage: '분할 금액의 합계가 총 지출 금액과 같아야 해요.',
      requestSplits,
    };
  }
  return {
    totalAmountMinor,
    splitAmountMinor,
    differenceMinor: 0,
    canSubmit: true,
    validationMessage: null,
    requestSplits,
  };
}

export function buildCreateQuickExpenseRequest({
  amountInput,
  currency,
  scheduleItemId,
  splitPolicy,
  participantIds,
  manualSplitInputs,
  payerParticipantId,
}: {
  amountInput: string;
  currency: SupportedCurrency;
  scheduleItemId: string | null;
  splitPolicy: QuickExpenseSplitPolicy;
  participantIds: string[];
  manualSplitInputs: QuickExpenseManualSplitInput[];
  payerParticipantId: string | null;
}): { ok: true; request: CreateQuickExpenseRequest } | { ok: false; errors: QuickExpenseFormErrors } {
  const errors: QuickExpenseFormErrors = {};
  const parsedAmount = parseAmountMinor(amountInput, currency);
  if (!parsedAmount.ok) {
    errors.amount = parsedAmount.message;
  }
  if (!scheduleItemId) {
    errors.item = '지출을 연결할 장소를 선택해주세요.';
  }
  if (!payerParticipantId) {
    errors.payer = '결제자를 선택해주세요.';
  }

  if (splitPolicy === 'equal') {
    if (participantIds.length === 0) {
      errors.participants = '분할할 사람을 1명 이상 선택해주세요.';
    }
  } else {
    const manualSummary = buildQuickExpenseManualSplitSummary({ amountInput, currency, manualSplitInputs });
    if (!manualSummary.canSubmit) {
      errors.participants = manualSummary.validationMessage ?? '분할 금액의 합계가 총 지출 금액과 같아야 해요.';
    }
  }

  if (Object.keys(errors).length > 0 || !parsedAmount.ok || !scheduleItemId || !payerParticipantId) {
    return { ok: false, errors };
  }

  if (splitPolicy === 'equal') {
    return {
      ok: true,
      request: {
        scheduleItemId,
        amountMinor: parsedAmount.amountMinor,
        payerParticipantId,
        splitPolicy,
        participantIds,
      },
    };
  }

  const manualSummary = buildQuickExpenseManualSplitSummary({ amountInput, currency, manualSplitInputs });
  if (!manualSummary.canSubmit) {
    return {
      ok: false,
      errors: { participants: manualSummary.validationMessage ?? '분할 금액의 합계가 총 지출 금액과 같아야 해요.' },
    };
  }
  return {
    ok: true,
    request: {
      scheduleItemId,
      amountMinor: parsedAmount.amountMinor,
      payerParticipantId,
      splitPolicy,
      splits: manualSummary.requestSplits,
    },
  };
}

export function quickExpenseFailureMessage(status?: number): string {
  if (status === 400) {
    return '금액, 장소, 참여자를 다시 확인해주세요.';
  }
  if (status === 403 || status === 404) {
    return '여행이나 장소, 참여자를 더 이상 사용할 수 없어요. 다시 불러와주세요.';
  }
  if (status === 409) {
    return '일정이나 참여자가 바뀌었어요. 다시 불러와주세요.';
  }
  return '지출을 저장할 수 없어요. 잠시 후 다시 시도해주세요.';
}

function toItemOption(item: ScheduleItem, selectedItemId: string | null): QuickExpenseItemOption {
  return {
    itemId: item.id,
    orderLabel: String(item.itemOrder),
    placeName: item.place.name,
    placeTypeLabel: getPlaceTypeLabel(item.place.placeType),
    address: item.place.address,
    selected: item.id === selectedItemId,
  };
}

function orderedItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((left, right) => left.itemOrder - right.itemOrder);
}

function parseManualSplitAmountInput(
  input: string,
  currency: SupportedCurrency,
): { status: 'empty' } | { status: 'valid'; amountMinor: number } | { status: 'invalid' } {
  const normalized = input.trim().replaceAll(',', '');
  if (normalized === '') {
    return { status: 'empty' };
  }
  if (zeroDecimalCurrencies.has(currency) ? /^0+$/.test(normalized) : /^0+(\.0{1,2})?$/.test(normalized)) {
    return { status: 'empty' };
  }
  const parsed = parseAmountMinor(input, currency);
  if (!parsed.ok) {
    return { status: 'invalid' };
  }
  return { status: 'valid', amountMinor: parsed.amountMinor };
}

function compareParticipantsForSplit(left: TripParticipantListItem, right: TripParticipantListItem): number {
  const joinedDiff = joinedAtTime(left.joinedAt) - joinedAtTime(right.joinedAt);
  if (joinedDiff !== 0) {
    return joinedDiff;
  }
  if (left.participantId < right.participantId) {
    return -1;
  }
  if (left.participantId > right.participantId) {
    return 1;
  }
  return 0;
}

function joinedAtTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeParticipantDisplayName(value: string): string {
  return value.trim() || '여행자';
}

function currencyLabel(currency: SupportedCurrency): string {
  switch (currency) {
    case 'KRW':
      return '원';
    case 'JPY':
      return '엔';
    case 'USD':
      return '달러';
    case 'EUR':
      return '유로';
  }
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
}

function amountError(): { ok: false; message: string } {
  return { ok: false, message: '금액을 1 이상 입력해주세요.' };
}
