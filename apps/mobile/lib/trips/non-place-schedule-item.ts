import type {
  CreateNonPlaceScheduleItemRequest,
  NonPlaceScheduleItemCategory,
  NonPlaceTransportMode,
  UpdateScheduleItemRequest,
} from '@i-um/api-contract';

import type { DayItineraryRowViewModel } from './day-itinerary';

export type NonPlaceScheduleItemFormValues = {
  category: NonPlaceScheduleItemCategory;
  title: string;
  startTime: string;
  endTime: string;
  memo: string;
  link: string;
  transportMode: NonPlaceTransportMode | '';
  referenceNumber: string;
  bookingReference: string;
  originText: string;
  destinationText: string;
  terminalText: string;
  gateText: string;
};

export type NonPlaceScheduleItemFormErrors = Partial<Record<keyof NonPlaceScheduleItemFormValues | 'form', string>>;

export type NonPlaceScheduleItemValidationResult =
  | { ok: true; request: CreateNonPlaceScheduleItemRequest | UpdateScheduleItemRequest }
  | { ok: false; errors: NonPlaceScheduleItemFormErrors };

export const nonPlaceCategoryOptions: { value: NonPlaceScheduleItemCategory; label: string }[] = [
  { value: 'transport', label: '이동' },
  { value: 'rest', label: '휴식' },
  { value: 'memo', label: '메모' },
  { value: 'reminder', label: '알림' },
];

export const nonPlaceTransportModeOptions: { value: NonPlaceTransportMode; label: string }[] = [
  { value: 'flight', label: '비행기' },
  { value: 'train', label: '기차' },
  { value: 'bus', label: '버스' },
  { value: 'ferry', label: '페리' },
  { value: 'other', label: '기타' },
];

export function emptyNonPlaceScheduleItemForm(): NonPlaceScheduleItemFormValues {
  return {
    category: 'memo',
    title: '',
    startTime: '',
    endTime: '',
    memo: '',
    link: '',
    transportMode: 'other',
    referenceNumber: '',
    bookingReference: '',
    originText: '',
    destinationText: '',
    terminalText: '',
    gateText: '',
  };
}

export function buildNonPlaceScheduleItemEditForm(item: DayItineraryRowViewModel): NonPlaceScheduleItemFormValues {
  return {
    category: item.nonPlaceCategory ?? 'memo',
    title: item.placeName,
    startTime: item.startTime ?? '',
    endTime: item.endTime ?? '',
    memo: item.nonPlaceMemo ?? '',
    link: item.nonPlaceLink ?? '',
    transportMode: item.transportMode ?? 'other',
    referenceNumber: item.referenceNumber ?? '',
    bookingReference: item.bookingReference ?? '',
    originText: item.originText ?? '',
    destinationText: item.destinationText ?? '',
    terminalText: item.terminalText ?? '',
    gateText: item.gateText ?? '',
  };
}

export function hasNonPlaceScheduleItemFormChanges(
  original: NonPlaceScheduleItemFormValues,
  current: NonPlaceScheduleItemFormValues,
): boolean {
  const normalizedOriginal = normalize(original);
  const normalizedCurrent = normalize(current);
  return (Object.keys(normalizedOriginal) as (keyof NonPlaceScheduleItemFormValues)[]).some(
    (key) => normalizedOriginal[key] !== normalizedCurrent[key],
  );
}

export function validateCreateNonPlaceScheduleItemForm(
  values: NonPlaceScheduleItemFormValues,
): NonPlaceScheduleItemValidationResult {
  const normalized = normalize(values);
  const errors = validateNormalized(normalized);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, request: buildCreateRequest(normalized) };
}

export function validateUpdateNonPlaceScheduleItemForm(
  original: NonPlaceScheduleItemFormValues,
  current: NonPlaceScheduleItemFormValues,
): NonPlaceScheduleItemValidationResult {
  const normalized = normalize(current);
  const errors = validateNormalized(normalized);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const originalNormalized = normalize(original);
  const fullRequest = buildCreateRequest(normalized);
  const originalRequest = buildCreateRequest(originalNormalized);
  const request: UpdateScheduleItemRequest = {};

  for (const key of Object.keys(fullRequest) as (keyof CreateNonPlaceScheduleItemRequest)[]) {
    if (fullRequest[key] !== originalRequest[key]) {
      request[key] = fullRequest[key] as never;
    }
  }

  for (const key of Object.keys(originalRequest) as (keyof CreateNonPlaceScheduleItemRequest)[]) {
    if (!(key in fullRequest)) {
      request[key] = '' as never;
    }
  }

  if (Object.keys(request).length === 0) {
    return { ok: false, errors: { form: '변경할 내용을 입력해주세요.' } };
  }

  return { ok: true, request };
}

export function buildNonPlaceScheduleItemSubmitState(
  isSubmitting: boolean,
  mode: 'create' | 'edit',
): { disabled: boolean; label: string } {
  if (isSubmitting) {
    return { disabled: true, label: mode === 'create' ? '추가 중...' : '저장 중...' };
  }
  return { disabled: false, label: mode === 'create' ? '추가' : '저장' };
}

function normalize(values: NonPlaceScheduleItemFormValues): NonPlaceScheduleItemFormValues {
  return {
    category: values.category,
    title: values.title.trim(),
    startTime: values.startTime.trim(),
    endTime: values.endTime.trim(),
    memo: values.memo.trim(),
    link: values.link.trim(),
    transportMode: values.transportMode,
    referenceNumber: values.referenceNumber.trim(),
    bookingReference: values.bookingReference.trim(),
    originText: values.originText.trim(),
    destinationText: values.destinationText.trim(),
    terminalText: values.terminalText.trim(),
    gateText: values.gateText.trim(),
  };
}

function validateNormalized(values: NonPlaceScheduleItemFormValues): NonPlaceScheduleItemFormErrors {
  const errors: NonPlaceScheduleItemFormErrors = {};

  if (values.title.length === 0) {
    errors.title = '일정 제목을 입력해주세요.';
  } else if ([...values.title].length > 120) {
    errors.title = '일정 제목은 120자 이하로 입력해주세요.';
  }

  if (values.startTime.length > 0 && !isScheduleItemTimeText(values.startTime)) {
    errors.startTime = '시작 시간은 HH:mm 형식으로 입력해주세요.';
  }
  if (values.endTime.length > 0 && !isScheduleItemTimeText(values.endTime)) {
    errors.endTime = '종료 시간은 HH:mm 형식으로 입력해주세요.';
  }
  if (!errors.startTime && !errors.endTime && values.endTime.length > 0 && values.startTime.length === 0) {
    errors.endTime = '종료 시간은 시작 시간과 함께 입력해주세요.';
  }
  if (
    !errors.startTime &&
    !errors.endTime &&
    values.startTime.length > 0 &&
    values.endTime.length > 0 &&
    values.endTime <= values.startTime
  ) {
    errors.endTime = '종료 시간은 시작 시간보다 늦어야 해요.';
  }

  if ([...values.memo].length > 1000) {
    errors.memo = '메모는 1000자 이하로 입력해주세요.';
  }
  if ([...values.link].length > 500) {
    errors.link = '링크는 500자 이하로 입력해주세요.';
  } else if (values.link.length > 0 && !isHttpUrl(values.link)) {
    errors.link = 'http 또는 https 링크를 입력해주세요.';
  }

  if (values.category === 'transport') {
    if (!values.transportMode) {
      errors.transportMode = '이동 수단을 선택해주세요.';
    }
    if ([...values.referenceNumber].length > 80) {
      errors.referenceNumber = '편명/열차번호는 80자 이하로 입력해주세요.';
    }
    if ([...values.bookingReference].length > 80) {
      errors.bookingReference = '예약번호는 80자 이하로 입력해주세요.';
    }
    if ([...values.originText].length > 200) {
      errors.originText = '출발지는 200자 이하로 입력해주세요.';
    }
    if ([...values.destinationText].length > 200) {
      errors.destinationText = '도착지는 200자 이하로 입력해주세요.';
    }
    if ([...values.terminalText].length > 120) {
      errors.terminalText = '터미널은 120자 이하로 입력해주세요.';
    }
    if ([...values.gateText].length > 80) {
      errors.gateText = '게이트는 80자 이하로 입력해주세요.';
    }
  }

  return errors;
}

function buildCreateRequest(values: NonPlaceScheduleItemFormValues): CreateNonPlaceScheduleItemRequest {
  const request: CreateNonPlaceScheduleItemRequest = {
    category: values.category,
    title: values.title,
  };
  setOptional(request, 'startTime', values.startTime);
  setOptional(request, 'endTime', values.endTime);
  setOptional(request, 'memo', values.memo);
  setOptional(request, 'link', values.link);

  if (values.category === 'transport') {
    request.transportMode = values.transportMode || 'other';
    setOptional(request, 'referenceNumber', values.referenceNumber);
    setOptional(request, 'bookingReference', values.bookingReference);
    setOptional(request, 'originText', values.originText);
    setOptional(request, 'destinationText', values.destinationText);
    setOptional(request, 'terminalText', values.terminalText);
    setOptional(request, 'gateText', values.gateText);
  }

  return request;
}

function setOptional<T extends Record<string, unknown>, K extends keyof T>(target: T, key: K, value: string): void {
  if (value.length > 0) {
    target[key] = value as T[K];
  }
}

function isScheduleItemTimeText(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
