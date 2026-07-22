import type { Href } from 'expo-router';

import type {
  CreateQuickExpenseRequest,
  CreateTripExpenseRequest,
  UpdateExpenseRequest,
  ScheduleItem,
  ExpenseSplit,
  GetDayScheduleItemsResponse,
  ExpenseCategory,
  SupportedCurrency,
  TripParticipantListItem,
} from '@i-um/api-contract';

import {
  formatScheduleItemTimeLabel,
  getPlaceTypeLabel,
  getScheduleItems,
  type PlaceBackedScheduleItem,
} from './day-itinerary';
import { formatTripDayDate, formatTripDayLabel } from './days';
import { tripExpensesPath, tripItineraryDayPath, tripSettlePath } from './routes';
import { orderScheduleItemsByDisplayTime } from './schedule-item-ordering';

export type QuickExpenseFormErrors = {
  title?: string;
  expenseDate?: string;
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
  tripDayId: string;
  dayLabel: string;
  formattedDate: string;
  orderLabel: string;
  placeName: string;
  placeTypeLabel: string;
  address: string;
  timeLabel: string | null;
  selected: boolean;
};

export type QuickExpenseDayOption = {
  tripDayId: string;
  dayLabel: string;
  formattedDate: string;
  itemCount: number;
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

export type QuickExpenseEntryChoiceActionViewModel = {
  label: string;
  helper: string;
  disabled: boolean;
};

export type QuickExpenseEntryChoiceViewModel = {
  title: string;
  helper: string;
  primaryAction: QuickExpenseEntryChoiceActionViewModel;
  secondaryAction: QuickExpenseEntryChoiceActionViewModel;
  verificationCopy: string;
};

export function buildQuickExpenseEntryChoiceViewModel({
  hasTripId,
}: {
  hasTripId: boolean;
}): QuickExpenseEntryChoiceViewModel {
  return {
    title: '지출을 어떻게 추가할까요?',
    helper: '영수증을 먼저 촬영하면 입력할 내용을 줄일 수 있어요.',
    primaryAction: {
      label: '영수증 촬영으로 입력',
      helper: '금액, 결제일자, 지출명 초안을 자동으로 채워요. 저장 전 확인이 필요해요.',
      disabled: !hasTripId,
    },
    secondaryAction: {
      label: '직접 입력',
      helper: '영수증이 없거나 바로 기록할 때 금액과 결제자부터 입력해요.',
      disabled: false,
    },
    verificationCopy: 'OCR 초안은 자동 저장되지 않아요. 확인 후 저장해야 정산에 반영됩니다.',
  };
}

export type QuickExpenseViewModel = {
  dayLabel: string;
  formattedDate: string;
  currency: SupportedCurrency;
  currencyLabel: string;
  selectedItem: QuickExpenseItemOption | null;
  selectedTripDayId: string | null;
  dayOptions: QuickExpenseDayOption[];
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

export type QuickExpenseReturnTo = 'settle' | 'expenses';

export type QuickExpenseFormMode = 'today' | 'settlement';

export type QuickExpenseReturnParam = string | string[] | undefined;

export type QuickExpenseReturnDayParam = string | string[] | undefined;

export type QuickExpenseRouteTarget = {
  tripId: string;
  date: string;
  itemId: string | null;
};

export function buildQuickExpenseRoute(
  tripId: string,
  tripDayId: string,
  itemId?: string | null,
  returnTo?: QuickExpenseReturnTo | null,
  returnDayId?: string | null,
): Href {
  const base = `/trips/${tripId}/days/${tripDayId}/expenses/quick`;
  const params = [
    itemId ? `itemId=${encodeURIComponent(itemId)}` : null,
    returnTo ? `returnTo=${encodeURIComponent(returnTo)}` : null,
    returnTo && returnDayId ? `returnDayId=${encodeURIComponent(returnDayId)}` : null,
  ].filter((param): param is string => param !== null);

  return (params.length > 0 ? `${base}?${params.join('&')}` : base) as Href;
}

export function resolveQuickExpenseFormMode(returnTo?: QuickExpenseReturnParam): QuickExpenseFormMode {
  const returnValue = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  return returnValue === 'settle' || returnValue === 'expenses' ? 'settlement' : 'today';
}

export function resolveQuickExpenseReturnPath({
  tripId,
  date,
  returnTo,
  returnDayId,
}: {
  tripId: string;
  date: string;
  returnTo?: QuickExpenseReturnParam;
  returnDayId?: QuickExpenseReturnDayParam;
}): Href {
  const returnValue = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  if (returnValue === 'settle') {
    const dayValue = Array.isArray(returnDayId) ? returnDayId[0] : returnDayId;
    const normalizedDayValue = dayValue?.trim() ?? '';
    if (normalizedDayValue) {
      return `${tripSettlePath(tripId)}?expenseDayId=${encodeURIComponent(normalizedDayValue)}` as Href;
    }
    return tripSettlePath(tripId);
  }
  if (returnValue === 'expenses') {
    return tripExpensesPath(tripId);
  }
  return tripItineraryDayPath(tripId, date);
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
  return orderedItems(items).find((item) => item.arrivedAt === null && !item.skippedAt) ?? null;
}

export function resolveInitialQuickExpenseItemId(
  items: ScheduleItem[],
  preferredItemId?: string | null,
): string | null {
  return resolveInitialQuickExpenseItemIdFromOrderedItems(orderedItems(items), preferredItemId);
}

export function resolveTodayQuickExpenseInitialItemId(
  items: ScheduleItem[],
  preferredItemId?: string | null,
): string | null {
  const ordered = orderedItems(items);
  if (preferredItemId && ordered.some((item) => item.id === preferredItemId)) {
    return preferredItemId;
  }

  const latestArrivedItem = ordered
    .filter((item) => item.arrivedAt !== null)
    .sort((left, right) => {
      const arrivedDiff = timestampValue(right.arrivedAt) - timestampValue(left.arrivedAt);
      return arrivedDiff !== 0 ? arrivedDiff : right.itemOrder - left.itemOrder;
    })[0];

  return latestArrivedItem?.id ?? resolveInitialQuickExpenseItemIdFromOrderedItems(ordered);
}

export function resolveInitialQuickExpenseItemIdFromItineraries(
  itineraries: GetDayScheduleItemsResponse[],
  preferredItemId?: string | null,
): string | null {
  const orderedItemsByDay = orderedItineraries(itineraries).flatMap((itinerary) =>
    orderedItems(getScheduleItems(itinerary)),
  );
  return resolveInitialQuickExpenseItemIdFromOrderedItems(orderedItemsByDay, preferredItemId);
}

export function resolveQuickExpenseItemDayId(
  itineraries: GetDayScheduleItemsResponse[],
  itemId: string | null,
): string | null {
  if (!itemId) {
    return null;
  }
  return (
    itineraries.find((itinerary) => getScheduleItems(itinerary).some((item) => item.id === itemId))?.day.id ?? null
  );
}

export function hasQuickExpenseEntry(items: ScheduleItem[]): boolean {
  return items.length > 0;
}

export function buildDefaultSplitParticipantIds(participants: TripParticipantListItem[]): string[] {
  return participants.map((participant) => participant.participantId);
}

export type ExpensePaymentSplitSummaryParticipant = {
  participantId: string;
  displayName: string;
};

export function buildExpensePaymentSplitSummaryLabel({
  payerParticipantId,
  participants,
  selectedParticipantIds,
  splitPolicy,
}: {
  payerParticipantId: string | null;
  participants: ExpensePaymentSplitSummaryParticipant[];
  selectedParticipantIds: string[];
  splitPolicy: QuickExpenseSplitPolicy;
}): string {
  const payerLabel = payerParticipantId
    ? `${normalizeParticipantDisplayName(
        participants.find((participant) => participant.participantId === payerParticipantId)?.displayName ?? '',
      )} 결제`
    : '결제자 선택 필요';

  if (splitPolicy === 'manual') {
    return `${payerLabel} · 직접 분할`;
  }

  const participantIds = participants.map((participant) => participant.participantId);
  const selectedSet = new Set(selectedParticipantIds);
  const allSelected =
    participantIds.length > 0 && participantIds.every((participantId) => selectedSet.has(participantId));
  if (allSelected) {
    return `${payerLabel} · 전체 1/N`;
  }

  const selectedNames = participants
    .filter((participant) => selectedSet.has(participant.participantId))
    .map((participant) => normalizeParticipantDisplayName(participant.displayName));
  const splitLabel = selectedNames.length > 0 ? `${compactNameList(selectedNames)} 1/N` : '분할 대상 선택 필요';
  return `${payerLabel} · ${splitLabel}`;
}

export function settlementStatusSummaryLabel(includeInSettlement: boolean): string {
  return includeInSettlement ? '최종 정산에 포함' : '현장 정산 완료';
}

export function settlementStatusSummaryDetail(includeInSettlement: boolean): string {
  return includeInSettlement
    ? '나중에 여행 정산에서 함께 계산할 지출이에요.'
    : '이미 돈을 주고받은 지출이에요. 내역과 총 사용 금액에는 남고 최종 정산에서는 제외돼요.';
}

function compactNameList(names: string[]): string {
  if (names.length <= 2) {
    return names.join(', ');
  }
  return `${names[0]} 외 ${names.length - 1}명`;
}

export function toggleQuickExpenseSplitParticipant(selectedParticipantIds: string[], participantId: string): string[] {
  return selectedParticipantIds.includes(participantId)
    ? selectedParticipantIds.filter((selectedParticipantId) => selectedParticipantId !== participantId)
    : [...selectedParticipantIds, participantId];
}

export function quickExpenseDirectSplitUnavailableMessage(participantCount: number): string | null {
  if (participantCount === 0) {
    return '참여자 정보를 불러오지 못해 직접 분할을 선택할 수 없어요.';
  }
  if (participantCount === 1) {
    return '분할 대상자가 1명이라 직접 분할을 선택할 수 없어요.';
  }
  return null;
}

export function resolveQuickExpenseSheetInitialSplitMode({
  requestedSplitMode,
  participantCount,
  selectedParticipantCount,
}: {
  requestedSplitMode?: QuickExpenseSplitPolicy;
  participantCount: number;
  selectedParticipantCount: number;
}): QuickExpenseSplitPolicy {
  if (quickExpenseDirectSplitUnavailableMessage(participantCount)) {
    return 'equal';
  }
  if (requestedSplitMode === 'manual' || selectedParticipantCount !== participantCount) {
    return 'manual';
  }
  return 'equal';
}

export function selectQuickExpenseSheetSplitMode({
  currentSplitMode,
  nextSplitMode,
  participantIds,
  selectedSplitParticipantIds,
}: {
  currentSplitMode: QuickExpenseSplitPolicy;
  nextSplitMode: QuickExpenseSplitPolicy;
  participantIds: string[];
  selectedSplitParticipantIds: string[];
}):
  | { ok: true; splitMode: QuickExpenseSplitPolicy; splitParticipantIds: string[]; message: null }
  | { ok: false; splitMode: QuickExpenseSplitPolicy; splitParticipantIds: string[]; message: string } {
  if (nextSplitMode === 'equal') {
    return { ok: true, splitMode: 'equal', splitParticipantIds: participantIds, message: null };
  }

  const unavailableMessage = quickExpenseDirectSplitUnavailableMessage(participantIds.length);
  if (unavailableMessage) {
    return {
      ok: false,
      splitMode: currentSplitMode,
      splitParticipantIds: selectedSplitParticipantIds,
      message: unavailableMessage,
    };
  }

  return { ok: true, splitMode: 'manual', splitParticipantIds: selectedSplitParticipantIds, message: null };
}

export function buildQuickExpenseViewModel({
  amountInput,
  currency,
  itinerary,
  itineraries,
  participants,
  selectedItemId,
  selectedSplitParticipantIds,
  selectedTripDayId,
  selectedTripPlaceId,
  shouldChooseItem,
}: {
  amountInput?: string;
  currency: SupportedCurrency;
  itinerary: GetDayScheduleItemsResponse;
  itineraries?: GetDayScheduleItemsResponse[];
  participants: TripParticipantListItem[];
  selectedItemId: string | null;
  selectedSplitParticipantIds?: string[];
  selectedTripDayId?: string | null;
  selectedTripPlaceId?: string | null;
  shouldChooseItem: boolean;
}): QuickExpenseViewModel {
  const itineraryList = itineraries && itineraries.length > 0 ? orderedItineraries(itineraries) : [itinerary];
  const allItemOptions = itineraryList.flatMap((optionItinerary) =>
    orderedItems(getScheduleItems(optionItinerary)).map((item, index) =>
      toItemOption(item, optionItinerary, selectedItemId, index + 1),
    ),
  );
  const isAllDayMode = itineraryList.length > 1;
  const selectedItemFromAllDays = allItemOptions.find((item) => item.selected) ?? null;
  const activeTripDayId = isAllDayMode
    ? (selectedTripDayId ?? selectedItemFromAllDays?.tripDayId ?? null)
    : itinerary.day.id;
  const itemOptions = isAllDayMode
    ? activeTripDayId
      ? allItemOptions.filter((option) => option.tripDayId === activeTripDayId)
      : allItemOptions
    : allItemOptions;
  const selectedItem = itemOptions.find((item) => item.selected) ?? null;
  const dayOptions = isAllDayMode
    ? itineraryList.map((optionItinerary) => ({
        tripDayId: optionItinerary.day.id,
        dayLabel: formatTripDayLabel(optionItinerary.day.dayOrder),
        formattedDate: formatTripDayDate(optionItinerary.day.date),
        itemCount: getScheduleItems(optionItinerary).length,
        selected: activeTripDayId !== null && optionItinerary.day.id === activeTripDayId,
      }))
    : [];
  const showItemSelector = itemOptions.length > 0;
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
    dayLabel: isAllDayMode ? '전체 일정' : formatTripDayLabel(itinerary.day.dayOrder),
    formattedDate: isAllDayMode ? itineraryDateRangeLabel(itineraryList) : formatTripDayDate(itinerary.day.date),
    currency,
    currencyLabel: currencyLabel(currency),
    selectedItem,
    selectedTripDayId: activeTripDayId,
    dayOptions,
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
      shouldChooseItem && itemOptions.length > 0
        ? isAllDayMode
          ? '정산에 연결할 일정을 선택해주세요.'
          : '현재 일정을 확정할 수 없어 오늘 일정에서 연결할 일정을 선택해주세요.'
        : null,
    emptyMessage:
      itemOptions.length === 0 && !selectedTripPlaceId
        ? isAllDayMode
          ? null
          : '오늘 일정에 등록된 일정이 없어 지출을 저장할 수 없어요.'
        : null,
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

export function buildQuickExpenseMemoUpdateRequest({
  createRequest,
  memoInput,
}: {
  createRequest: CreateQuickExpenseRequest;
  memoInput: string;
}): UpdateExpenseRequest | null {
  const memo = memoInput.trim();
  if (memo === '') {
    return null;
  }

  return {
    amountMinor: createRequest.amountMinor,
    payerParticipantId: createRequest.payerParticipantId,
    splitPolicy: createRequest.splitPolicy,
    ...(createRequest.currency ? { currency: createRequest.currency } : {}),
    ...(createRequest.expenseCategory ? { expenseCategory: createRequest.expenseCategory } : {}),
    ...(createRequest.participantIds ? { participantIds: createRequest.participantIds } : {}),
    ...(createRequest.splits ? { splits: createRequest.splits } : {}),
    memo,
    scheduleItemId: createRequest.scheduleItemId,
    tripPlaceId: createRequest.tripPlaceId,
    ...(createRequest.includeInSettlement !== undefined
      ? { includeInSettlement: createRequest.includeInSettlement }
      : {}),
  };
}

export function buildCreateQuickExpenseRequest({
  amountInput,
  currency,
  scheduleItemId,
  tripPlaceId,
  expenseCategory,
  splitPolicy,
  participantIds,
  manualSplitInputs,
  payerParticipantId,
  includeInSettlement,
  receiptDraftId,
}: {
  amountInput: string;
  currency: SupportedCurrency;
  scheduleItemId: string | null;
  tripPlaceId?: string | null;
  expenseCategory?: ExpenseCategory;
  splitPolicy: QuickExpenseSplitPolicy;
  participantIds: string[];
  manualSplitInputs: QuickExpenseManualSplitInput[];
  payerParticipantId: string | null;
  includeInSettlement?: boolean;
  receiptDraftId?: string | null;
}): { ok: true; request: CreateQuickExpenseRequest } | { ok: false; errors: QuickExpenseFormErrors } {
  const validation = validateExpenseAmountPayerAndSplits({
    amountInput,
    currency,
    splitPolicy,
    participantIds,
    manualSplitInputs,
    payerParticipantId,
  });
  const normalizedTripPlaceId = tripPlaceId?.trim() || null;
  if (!scheduleItemId && !normalizedTripPlaceId) {
    validation.errors.item = '지출을 연결할 일정이나 영수증 장소를 선택해주세요.';
  }

  if (
    Object.keys(validation.errors).length > 0 ||
    !validation.parsedAmount.ok ||
    !payerParticipantId ||
    (!scheduleItemId && !normalizedTripPlaceId)
  ) {
    return { ok: false, errors: validation.errors };
  }

  if (splitPolicy === 'equal') {
    return {
      ok: true,
      request: {
        scheduleItemId,
        tripPlaceId: normalizedTripPlaceId,
        amountMinor: validation.parsedAmount.amountMinor,
        currency,
        ...(expenseCategory ? { expenseCategory } : {}),
        payerParticipantId,
        splitPolicy,
        participantIds,
        ...(includeInSettlement !== undefined ? { includeInSettlement } : {}),
        ...(receiptDraftId ? { receiptDraftId } : {}),
      },
    };
  }

  return {
    ok: true,
    request: {
      scheduleItemId,
      tripPlaceId: normalizedTripPlaceId,
      amountMinor: validation.parsedAmount.amountMinor,
      currency,
      ...(expenseCategory ? { expenseCategory } : {}),
      payerParticipantId,
      splitPolicy,
      splits: validation.manualSummary.requestSplits,
      ...(includeInSettlement !== undefined ? { includeInSettlement } : {}),
      ...(receiptDraftId ? { receiptDraftId } : {}),
    },
  };
}

export function buildCreateTripExpenseRequest({
  titleInput,
  expenseDate,
  amountInput,
  currency,
  selectedTripDayId,
  scheduleItemId,
  tripPlaceId,
  expenseCategory,
  splitPolicy,
  participantIds,
  manualSplitInputs,
  payerParticipantId,
  memoInput,
  includeInSettlement,
  receiptDraftId,
}: {
  titleInput: string;
  expenseDate: string;
  amountInput: string;
  currency: SupportedCurrency;
  selectedTripDayId: string | null;
  scheduleItemId: string | null;
  tripPlaceId?: string | null;
  expenseCategory?: ExpenseCategory;
  splitPolicy: QuickExpenseSplitPolicy;
  participantIds: string[];
  manualSplitInputs: QuickExpenseManualSplitInput[];
  payerParticipantId: string | null;
  memoInput: string;
  includeInSettlement?: boolean;
  receiptDraftId?: string | null;
}): { ok: true; request: CreateTripExpenseRequest } | { ok: false; errors: QuickExpenseFormErrors } {
  const validation = validateExpenseAmountPayerAndSplits({
    amountInput,
    currency,
    splitPolicy,
    participantIds,
    manualSplitInputs,
    payerParticipantId,
  });
  const title = titleInput.trim();
  const normalizedTripPlaceId = tripPlaceId?.trim() || null;
  if (title === '' && !scheduleItemId && !normalizedTripPlaceId) {
    validation.errors.title = '지출명을 입력해주세요.';
  }
  if (!isDateOnlyString(expenseDate)) {
    validation.errors.expenseDate = '결제일자를 선택해주세요.';
  }

  if (Object.keys(validation.errors).length > 0 || !validation.parsedAmount.ok || !payerParticipantId) {
    return { ok: false, errors: validation.errors };
  }

  const memo = memoInput.trim();
  const baseRequest = {
    title: title === '' ? null : title,
    expenseDate,
    tripDayId: selectedTripDayId,
    scheduleItemId,
    tripPlaceId: normalizedTripPlaceId,
    amountMinor: validation.parsedAmount.amountMinor,
    currency,
    ...(expenseCategory ? { expenseCategory } : {}),
    payerParticipantId,
    splitPolicy,
    memo: memo === '' ? null : memo,
    ...(includeInSettlement !== undefined ? { includeInSettlement } : {}),
    ...(receiptDraftId ? { receiptDraftId } : {}),
  };

  if (splitPolicy === 'equal') {
    return {
      ok: true,
      request: {
        ...baseRequest,
        participantIds,
      },
    };
  }

  return {
    ok: true,
    request: {
      ...baseRequest,
      splits: validation.manualSummary.requestSplits,
    },
  };
}

export function quickExpenseFailureMessage(status?: number): string {
  if (status === 400) {
    return '금액, 일정, 참여자를 다시 확인해주세요.';
  }
  if (status === 403 || status === 404) {
    return '여행이나 일정, 참여자를 더 이상 사용할 수 없어요. 다시 불러와주세요.';
  }
  if (status === 409) {
    return '일정이나 참여자가 바뀌었어요. 다시 불러와주세요.';
  }
  return '지출을 저장할 수 없어요. 잠시 후 다시 시도해주세요.';
}

function toItemOption(
  item: PlaceBackedScheduleItem,
  itinerary: GetDayScheduleItemsResponse,
  selectedItemId: string | null,
  displayOrder = item.itemOrder,
): QuickExpenseItemOption {
  const dayFields = {
    tripDayId: itinerary.day.id,
    dayLabel: formatTripDayLabel(itinerary.day.dayOrder),
    formattedDate: formatTripDayDate(itinerary.day.date),
  };
  return {
    itemId: item.id,
    ...dayFields,
    orderLabel: String(displayOrder),
    placeName: item.place.name,
    placeTypeLabel: getPlaceTypeLabel(item.place.placeType),
    address: item.place.address,
    timeLabel: formatScheduleItemTimeLabel(item.startTime, item.endTime) ?? null,
    selected: item.id === selectedItemId,
  };
}

function resolveInitialQuickExpenseItemIdFromOrderedItems(
  orderedItemsByContext: ScheduleItem[],
  preferredItemId?: string | null,
): string | null {
  if (preferredItemId && orderedItemsByContext.some((item) => item.id === preferredItemId)) {
    return preferredItemId;
  }
  return orderedItemsByContext.find((item) => item.arrivedAt === null && !item.skippedAt)?.id ?? null;
}

function orderedItineraries(itineraries: GetDayScheduleItemsResponse[]): GetDayScheduleItemsResponse[] {
  return [...itineraries].sort((left, right) => left.day.dayOrder - right.day.dayOrder);
}

function itineraryDateRangeLabel(itineraries: GetDayScheduleItemsResponse[]): string {
  const ordered = orderedItineraries(itineraries);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last || first.day.date === last.day.date) {
    return first ? formatTripDayDate(first.day.date) : '';
  }
  return `${formatTripDayDate(first.day.date)}–${formatTripDayDate(last.day.date)}`;
}

function orderedItems<T extends ScheduleItem>(items: T[]): T[] {
  return orderScheduleItemsByDisplayTime(items);
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

function timestampValue(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isDateOnlyString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateExpenseAmountPayerAndSplits({
  amountInput,
  currency,
  splitPolicy,
  participantIds,
  manualSplitInputs,
  payerParticipantId,
}: {
  amountInput: string;
  currency: SupportedCurrency;
  splitPolicy: QuickExpenseSplitPolicy;
  participantIds: string[];
  manualSplitInputs: QuickExpenseManualSplitInput[];
  payerParticipantId: string | null;
}): {
  errors: QuickExpenseFormErrors;
  parsedAmount: ReturnType<typeof parseAmountMinor>;
  manualSummary: QuickExpenseManualSplitSummary;
} {
  const errors: QuickExpenseFormErrors = {};
  const parsedAmount = parseAmountMinor(amountInput, currency);
  if (!parsedAmount.ok) {
    errors.amount = parsedAmount.message;
  }
  if (!payerParticipantId) {
    errors.payer = '결제자를 선택해주세요.';
  }

  const manualSummary = buildQuickExpenseManualSplitSummary({ amountInput, currency, manualSplitInputs });
  if (splitPolicy === 'equal') {
    if (participantIds.length === 0) {
      errors.participants = '분할할 사람을 1명 이상 선택해주세요.';
    }
  } else if (!manualSummary.canSubmit) {
    errors.participants = manualSummary.validationMessage ?? '분할 금액의 합계가 총 지출 금액과 같아야 해요.';
  }

  return { errors, parsedAmount, manualSummary };
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
