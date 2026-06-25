import type {
  CreateQuickExpenseRequest,
  DayItineraryItem,
  GetDayItineraryResponse,
  SupportedCurrency,
  TripParticipantListItem,
} from '@i-um/api-contract';

import { getPlaceTypeLabel } from './day-itinerary';
import { formatTripDayDate } from './days';

export type QuickExpenseFormErrors = {
  amount?: string;
  item?: string;
  payer?: string;
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

export type QuickExpenseViewModel = {
  dayLabel: string;
  formattedDate: string;
  currency: SupportedCurrency;
  currencyLabel: string;
  selectedItem: QuickExpenseItemOption | null;
  itemOptions: QuickExpenseItemOption[];
  payerOptions: QuickExpensePayerOption[];
  showItemSelector: boolean;
  helper: string | null;
  emptyMessage: string | null;
};

const zeroDecimalCurrencies = new Set<SupportedCurrency>(['KRW', 'JPY']);

export function buildQuickExpenseRoute(tripId: string, date: string, itemId?: string | null): string {
  const base = `/trips/${tripId}/days/${date}/expenses/quick`;
  return itemId ? `${base}?itemId=${encodeURIComponent(itemId)}` : base;
}

export function inferCurrentQuickExpenseItem(items: DayItineraryItem[]): DayItineraryItem | null {
  return orderedItems(items).find((item) => item.arrivedAt === null) ?? null;
}

export function hasQuickExpenseEntry(items: DayItineraryItem[]): boolean {
  return items.length > 0;
}

export function buildQuickExpenseViewModel({
  currency,
  itinerary,
  participants,
  selectedItemId,
  shouldChooseItem,
}: {
  currency: SupportedCurrency;
  itinerary: GetDayItineraryResponse;
  participants: TripParticipantListItem[];
  selectedItemId: string | null;
  shouldChooseItem: boolean;
}): QuickExpenseViewModel {
  const itemOptions = orderedItems(itinerary.items).map((item) => toItemOption(item, selectedItemId));
  const selectedItem = itemOptions.find((item) => item.selected) ?? null;
  const showItemSelector = shouldChooseItem || selectedItem === null;
  return {
    dayLabel: `Day ${itinerary.day.dayOrder}`,
    formattedDate: formatTripDayDate(itinerary.day.date),
    currency,
    currencyLabel: currencyLabel(currency),
    selectedItem,
    itemOptions,
    payerOptions: participants.map((participant) => ({
      participantId: participant.participantId,
      displayName: participant.displayName.trim() || '여행자',
      selected: false,
    })),
    showItemSelector,
    helper: showItemSelector && itemOptions.length > 0 ? '현재 장소를 확정할 수 없어 오늘 일정에서 장소를 선택해주세요.' : null,
    emptyMessage: itemOptions.length === 0 ? '오늘 일정에 등록된 장소가 없어 지출을 저장할 수 없어요.' : null,
  };
}

export function parseAmountMinor(input: string, currency: SupportedCurrency): { ok: true; amountMinor: number } | { ok: false; message: string } {
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

export function buildCreateQuickExpenseRequest({
  amountInput,
  currency,
  itineraryItemId,
  payerParticipantId,
}: {
  amountInput: string;
  currency: SupportedCurrency;
  itineraryItemId: string | null;
  payerParticipantId: string | null;
}): { ok: true; request: CreateQuickExpenseRequest } | { ok: false; errors: QuickExpenseFormErrors } {
  const errors: QuickExpenseFormErrors = {};
  const parsedAmount = parseAmountMinor(amountInput, currency);
  if (!parsedAmount.ok) {
    errors.amount = parsedAmount.message;
  }
  if (!itineraryItemId) {
    errors.item = '지출을 연결할 장소를 선택해주세요.';
  }
  if (!payerParticipantId) {
    errors.payer = '결제자를 선택해주세요.';
  }

  if (Object.keys(errors).length > 0 || !parsedAmount.ok || !itineraryItemId || !payerParticipantId) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    request: {
      itineraryItemId,
      amountMinor: parsedAmount.amountMinor,
      payerParticipantId,
    },
  };
}

export function quickExpenseFailureMessage(status?: number): string {
  if (status === 400) {
    return '금액, 장소, 결제자를 다시 확인해주세요.';
  }
  if (status === 403 || status === 404) {
    return '여행이나 장소, 참여자를 더 이상 사용할 수 없어요. 다시 불러와주세요.';
  }
  if (status === 409) {
    return '일정이나 참여자가 바뀌었어요. 다시 불러와주세요.';
  }
  return '지출을 저장할 수 없어요. 잠시 후 다시 시도해주세요.';
}

function toItemOption(item: DayItineraryItem, selectedItemId: string | null): QuickExpenseItemOption {
  return {
    itemId: item.id,
    orderLabel: String(item.itemOrder),
    placeName: item.place.name,
    placeTypeLabel: getPlaceTypeLabel(item.place.placeType),
    address: item.place.address,
    selected: item.id === selectedItemId,
  };
}

function orderedItems(items: DayItineraryItem[]): DayItineraryItem[] {
  return [...items].sort((left, right) => left.itemOrder - right.itemOrder);
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
