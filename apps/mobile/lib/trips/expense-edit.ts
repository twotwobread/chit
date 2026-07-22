import type {
  Expense,
  ExpenseCategory,
  GetDayScheduleItemsResponse,
  ScheduleItem,
  SupportedCurrency,
  TripParticipantListItem,
  UpdateExpenseRequest,
} from '@i-um/api-contract';

import {
  formatScheduleItemTimeLabel,
  getPlaceTypeLabel,
  getScheduleItems,
  type PlaceBackedScheduleItem,
} from './day-itinerary';
import { formatTripDayDate, formatTripDayLabel } from './days';
import {
  buildDefaultEqualSplitPreview,
  buildDefaultSplitParticipantIds,
  buildQuickExpenseManualSplitSummary,
  formatAmountInput,
  formatMoney,
  parseAmountMinor,
  type QuickExpenseDayOption,
  type QuickExpenseItemOption,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSplitParticipantOption,
  type QuickExpenseSplitPolicy,
  type QuickExpenseSplitRow,
} from './quick-expense';

export type ExpenseEditFormErrors = {
  title?: string;
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
  expenseCategory: ExpenseCategory;
  showTitleField: boolean;
  showPlaceField: boolean;
  titlePlaceholder: string;
  currencyLabel: string;
  selectedItem: QuickExpenseItemOption | null;
  selectedTripDayId: string | null;
  dayOptions: QuickExpenseDayOption[];
  itemOptions: QuickExpenseItemOption[];
  payerOptions: ExpenseEditPayerOption[];
  placeOptions: ExpenseEditPlaceOption[];
  splitParticipantOptions: QuickExpenseSplitParticipantOption[];
  splitPreviewRows: QuickExpenseSplitRow[];
  splitPreviewMessage: string | null;
  splitParticipantError: string | null;
  saveLabel: string;
  deleteLabel: string;
};

export function buildExpenseEditViewModel({
  amountInput,
  expense,
  currency = expense.currency,
  expenseCategory = expense.expenseCategory,
  itinerary,
  itineraries,
  participants,
  selectedItemId,
  selectedPayerParticipantId,
  selectedSplitParticipantIds,
  selectedTripDayId,
}: {
  amountInput: string;
  currency?: SupportedCurrency;
  expense: Expense;
  expenseCategory?: ExpenseCategory;
  itinerary: GetDayScheduleItemsResponse | null;
  itineraries?: GetDayScheduleItemsResponse[];
  memoInput: string;
  participants: TripParticipantListItem[];
  selectedItemId: string | null;
  selectedPayerParticipantId: string | null;
  selectedSplitParticipantIds?: string[];
  selectedTripDayId?: string | null;
}): ExpenseEditViewModel {
  const itineraryList = orderedItineraries(
    itineraries && itineraries.length > 0 ? itineraries : itinerary ? [itinerary] : [],
  );
  const allItemOptions = itineraryList.flatMap((optionItinerary) =>
    orderedItems(getScheduleItems(optionItinerary)).map((item) =>
      expenseEditItemOption(item, optionItinerary, selectedItemId),
    ),
  );
  const isAllDayMode = itineraryList.length > 1 || (itinerary === null && itineraryList.length > 0);
  const selectedItemFromAllDays = allItemOptions.find((item) => item.selected) ?? null;
  const activeTripDayId = isAllDayMode
    ? (selectedTripDayId ?? selectedItemFromAllDays?.tripDayId ?? null)
    : (itineraryList[0]?.day.id ?? null);
  const itemOptions = activeTripDayId
    ? allItemOptions.filter((option) => option.tripDayId === activeTripDayId)
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
  const selectedParticipantSet = new Set(selectedSplitParticipantIds ?? buildDefaultSplitParticipantIds(participants));
  const selectedParticipants = participants.filter((participant) =>
    selectedParticipantSet.has(participant.participantId),
  );
  const parsedAmount = amountInput.trim() === '' ? null : parseAmountMinor(amountInput, currency);
  const splitPreviewRows = parsedAmount?.ok
    ? buildDefaultEqualSplitPreview({
        amountMinor: parsedAmount.amountMinor,
        currency,
        participants: selectedParticipants,
      })
    : [];

  const isTripLevel = itinerary === null;

  return {
    title: '지출 수정',
    dayLabel: isAllDayMode ? '전체 일정' : isTripLevel ? '여행 전체' : formatTripDayLabel(itinerary.day.dayOrder),
    formattedDate: formatTripDayDate(expense.expenseDate),
    amountLabel: formatMoney(expense.amountMinor, expense.currency),
    currency,
    expenseCategory,
    showTitleField: isTripLevel || selectedItemId === null || expense.title !== null,
    showPlaceField: allItemOptions.length > 0,
    titlePlaceholder: selectedItemId === null ? '예: 항공권, 숙소 예약금' : '선택 입력',
    currencyLabel: currencyLabel(currency),
    selectedItem,
    selectedTripDayId: activeTripDayId,
    dayOptions,
    itemOptions,
    payerOptions: participants.map((participant) => ({
      participantId: participant.participantId,
      displayName: participant.displayName.trim() || '이름 없음',
      selected: participant.participantId === selectedPayerParticipantId,
    })),
    placeOptions:
      allItemOptions.length === 0 ? [] : [noPlaceOption(selectedItemId), ...itemOptions.map(placeOptionFromItem)],
    splitParticipantOptions: participants.map((participant) => ({
      participantId: participant.participantId,
      displayName: participant.displayName.trim() || '이름 없음',
      selected: selectedParticipantSet.has(participant.participantId),
    })),
    splitPreviewRows,
    splitPreviewMessage:
      parsedAmount?.ok && participants.length === 0 ? '참여자 정보를 불러오지 못해 분할을 계산할 수 없어요.' : null,
    splitParticipantError:
      participants.length > 0 && selectedParticipants.length === 0 ? '분할할 사람을 1명 이상 선택해주세요.' : null,
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
  expenseCategory,
  splitPolicy,
  participantIds,
  manualSplitInputs,
  scheduleItemId,
  tripPlaceId = null,
  memoInput,
  payerParticipantId,
  titleInput,
  includeInSettlement,
}: {
  amountInput: string;
  currency: SupportedCurrency;
  expenseCategory?: ExpenseCategory;
  splitPolicy: QuickExpenseSplitPolicy;
  participantIds: string[];
  manualSplitInputs: QuickExpenseManualSplitInput[];
  scheduleItemId: string | null;
  tripPlaceId?: string | null;
  memoInput: string;
  payerParticipantId: string | null;
  titleInput?: string;
  includeInSettlement?: boolean;
}): { ok: true; request: UpdateExpenseRequest } | { ok: false; errors: ExpenseEditFormErrors } {
  const errors: ExpenseEditFormErrors = {};
  const parsedAmount = parseAmountMinor(amountInput, currency);
  if (!parsedAmount.ok) {
    errors.amount = '금액을 0보다 크게 입력해주세요.';
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
  const title = titleInput?.trim();
  if (title !== undefined && [...title].length > 120) {
    errors.title = '지출명은 120자 이내로 입력해주세요.';
  }
  const memo = memoInput.trim();
  if ([...memo].length > 240) {
    errors.memo = '메모는 240자 이내로 입력해주세요.';
  }

  if (Object.keys(errors).length > 0 || !parsedAmount.ok || !payerParticipantId) {
    return { ok: false, errors };
  }

  if (splitPolicy === 'equal') {
    return {
      ok: true,
      request: {
        amountMinor: parsedAmount.amountMinor,
        currency,
        ...(expenseCategory ? { expenseCategory } : {}),
        payerParticipantId,
        splitPolicy,
        participantIds,
        memo: memo === '' ? null : memo,
        ...(titleInput !== undefined ? { title: title === '' ? null : title } : {}),
        scheduleItemId,
        tripPlaceId,
        ...(includeInSettlement !== undefined ? { includeInSettlement } : {}),
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
      amountMinor: parsedAmount.amountMinor,
      currency,
      ...(expenseCategory ? { expenseCategory } : {}),
      payerParticipantId,
      splitPolicy,
      splits: manualSummary.requestSplits,
      memo: memo === '' ? null : memo,
      ...(titleInput !== undefined ? { title: title === '' ? null : title } : {}),
      scheduleItemId,
      tripPlaceId,
      ...(includeInSettlement !== undefined ? { includeInSettlement } : {}),
    },
  };
}

export function buildExpenseEditInitialManualSplitInputs(
  expense: Expense,
  currency: SupportedCurrency,
  participants: TripParticipantListItem[],
): QuickExpenseManualSplitInput[] {
  const amountByParticipantId = new Map<string, number>();
  for (const split of expense.splits) {
    if (split.participant.participantId !== null) {
      amountByParticipantId.set(split.participant.participantId, split.amountMinor);
    }
  }
  return participants.map((participant) => ({
    participantId: participant.participantId,
    amountInput: amountByParticipantId.has(participant.participantId)
      ? formatAmountInput(amountByParticipantId.get(participant.participantId) ?? 0, currency)
      : '',
  }));
}

export function buildExpenseEditParticipantIds(
  participants: TripParticipantListItem[],
  selectedParticipantIds?: string[],
): string[] {
  if (!selectedParticipantIds) {
    return buildDefaultSplitParticipantIds(participants);
  }
  const availableParticipantIds = new Set(participants.map((participant) => participant.participantId));
  return selectedParticipantIds.filter((participantId) => availableParticipantIds.has(participantId));
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

function placeOptionFromItem(item: QuickExpenseItemOption): ExpenseEditPlaceOption {
  return {
    itemId: item.itemId,
    label: item.placeName,
    detail: `${item.dayLabel} · ${item.placeTypeLabel} · ${item.address}`,
    selected: item.selected,
  };
}

function expenseEditItemOption(
  item: PlaceBackedScheduleItem,
  itinerary: GetDayScheduleItemsResponse,
  selectedItemId: string | null,
): QuickExpenseItemOption {
  return {
    itemId: item.id,
    tripDayId: itinerary.day.id,
    dayLabel: formatTripDayLabel(itinerary.day.dayOrder),
    formattedDate: formatTripDayDate(itinerary.day.date),
    orderLabel: String(item.itemOrder),
    placeName: item.place.name,
    placeTypeLabel: getPlaceTypeLabel(item.place.placeType),
    address: item.place.address,
    timeLabel: formatScheduleItemTimeLabel(item.startTime, item.endTime) ?? null,
    selected: item.id === selectedItemId,
  };
}

function orderedItineraries(itineraries: GetDayScheduleItemsResponse[]): GetDayScheduleItemsResponse[] {
  return [...itineraries].sort((left, right) => left.day.dayOrder - right.day.dayOrder);
}

function orderedItems(items: ScheduleItem[]): PlaceBackedScheduleItem[] {
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
