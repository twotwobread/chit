import type { Href } from 'expo-router';

import type {
  CreateGooglePlaceScheduleItemRequest,
  CreateNonPlaceScheduleItemRequest,
  NonPlaceScheduleItemCategory,
  NonPlaceTransportMode,
} from '@i-um/api-contract';

import { buildGooglePlaceSearchRoute, type GooglePlaceSearchRowViewModel } from './google-search';
import {
  emptyNonPlaceScheduleItemForm,
  nonPlaceCategoryOptions,
  nonPlaceTransportModeOptions,
  validateCreateNonPlaceScheduleItemForm,
  type NonPlaceScheduleItemFormErrors,
  type NonPlaceScheduleItemFormValues,
} from '../trips/non-place-schedule-item';

export type PlaceScheduleSelectedPlace = {
  googlePlaceId: string;
  placeName: string;
  address: string;
  typeHint: string;
};

export type PlaceScheduleDetailFormValues = {
  title: string;
  startTime: string;
  endTime: string;
  memo: string;
  titleTouched: boolean;
  selectedPlace: PlaceScheduleSelectedPlace | null;
  nonPlaceCategory: NonPlaceScheduleItemCategory;
  nonPlaceLink: string;
  nonPlaceTransportMode: NonPlaceTransportMode | '';
  nonPlaceReferenceNumber: string;
  nonPlaceBookingReference: string;
  nonPlaceOriginText: string;
  nonPlaceDestinationText: string;
  nonPlaceTerminalText: string;
  nonPlaceGateText: string;
};

export type PlaceScheduleDetailFormErrorField =
  | 'title'
  | 'place'
  | 'startTime'
  | 'endTime'
  | 'memo'
  | 'form'
  | 'nonPlaceCategory'
  | 'nonPlaceLink'
  | 'nonPlaceTransportMode'
  | 'nonPlaceReferenceNumber'
  | 'nonPlaceBookingReference'
  | 'nonPlaceOriginText'
  | 'nonPlaceDestinationText'
  | 'nonPlaceTerminalText'
  | 'nonPlaceGateText';

export type PlaceScheduleDetailFormErrors = Partial<Record<PlaceScheduleDetailFormErrorField, string>>;

export type PlaceScheduleDetailValidationResult =
  | { ok: true; request: CreateGooglePlaceScheduleItemRequest }
  | { ok: false; errors: PlaceScheduleDetailFormErrors };

export type UnifiedScheduleDetailValidationResult =
  | { ok: true; kind: 'place'; request: CreateGooglePlaceScheduleItemRequest }
  | { ok: true; kind: 'nonPlace'; request: CreateNonPlaceScheduleItemRequest }
  | { ok: false; errors: PlaceScheduleDetailFormErrors };

export type PlaceScheduleDetailParams = {
  title?: string | string[];
  titleTouched?: string | string[];
  startTime?: string | string[];
  endTime?: string | string[];
  memo?: string | string[];
  googlePlaceId?: string | string[];
  placeName?: string | string[];
  address?: string | string[];
  typeHint?: string | string[];
  nonPlaceCategory?: string | string[];
  nonPlaceLink?: string | string[];
  nonPlaceTransportMode?: string | string[];
  nonPlaceReferenceNumber?: string | string[];
  nonPlaceBookingReference?: string | string[];
  nonPlaceOriginText?: string | string[];
  nonPlaceDestinationText?: string | string[];
  nonPlaceTerminalText?: string | string[];
  nonPlaceGateText?: string | string[];
};

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export type PlaceScheduleTimePeriod = 'AM' | 'PM';

export type PlaceScheduleTimePickerValue = {
  period: PlaceScheduleTimePeriod;
  hour: string;
  minute: string;
};

export const scheduleTimePeriodOptions: PlaceScheduleTimePeriod[] = ['AM', 'PM'];
export const scheduleTimeHourOptions = Array.from({ length: 12 }, (_, index) => pad2(index + 1));
export const scheduleTimeMinuteOptions = Array.from({ length: 60 }, (_, index) => pad2(index));

export function emptyPlaceScheduleDetailForm(): PlaceScheduleDetailFormValues {
  const nonPlace = emptyNonPlaceScheduleItemForm();
  return {
    title: '',
    startTime: '',
    endTime: '',
    memo: '',
    titleTouched: false,
    selectedPlace: null,
    nonPlaceCategory: nonPlace.category,
    nonPlaceLink: nonPlace.link,
    nonPlaceTransportMode: nonPlace.transportMode,
    nonPlaceReferenceNumber: nonPlace.referenceNumber,
    nonPlaceBookingReference: nonPlace.bookingReference,
    nonPlaceOriginText: nonPlace.originText,
    nonPlaceDestinationText: nonPlace.destinationText,
    nonPlaceTerminalText: nonPlace.terminalText,
    nonPlaceGateText: nonPlace.gateText,
  };
}

export function selectedPlaceFromGoogleSearchResult(result: GooglePlaceSearchRowViewModel): PlaceScheduleSelectedPlace {
  return {
    googlePlaceId: result.id,
    placeName: result.placeName,
    address: result.address,
    typeHint: result.typeHint,
  };
}

export function applySelectedPlaceToPlaceScheduleForm(
  values: PlaceScheduleDetailFormValues,
  selectedPlace: PlaceScheduleSelectedPlace,
): PlaceScheduleDetailFormValues {
  const shouldFillTitle = !values.titleTouched || values.title.trim().length === 0;
  return {
    ...values,
    selectedPlace,
    title: shouldFillTitle ? selectedPlace.placeName : values.title,
  };
}

export function clearSelectedPlaceFromPlaceScheduleForm(
  values: PlaceScheduleDetailFormValues,
): PlaceScheduleDetailFormValues {
  return { ...values, selectedPlace: null };
}

export function parsePlaceScheduleDetailParams(params: PlaceScheduleDetailParams): PlaceScheduleDetailFormValues {
  const googlePlaceId = firstParam(params.googlePlaceId);
  const placeName = firstParam(params.placeName);
  const address = firstParam(params.address);
  const typeHint = firstParam(params.typeHint);
  const selectedPlace =
    googlePlaceId && placeName && address && typeHint ? { googlePlaceId, placeName, address, typeHint } : null;

  const defaults = emptyPlaceScheduleDetailForm();
  const values: PlaceScheduleDetailFormValues = {
    title: firstParam(params.title) ?? '',
    titleTouched: firstParam(params.titleTouched) === 'true',
    startTime: firstParam(params.startTime) ?? '',
    endTime: firstParam(params.endTime) ?? '',
    memo: firstParam(params.memo) ?? '',
    selectedPlace,
    nonPlaceCategory: parseNonPlaceCategory(firstParam(params.nonPlaceCategory)) ?? defaults.nonPlaceCategory,
    nonPlaceLink: firstParam(params.nonPlaceLink) ?? defaults.nonPlaceLink,
    nonPlaceTransportMode:
      parseNonPlaceTransportMode(firstParam(params.nonPlaceTransportMode)) ?? defaults.nonPlaceTransportMode,
    nonPlaceReferenceNumber: firstParam(params.nonPlaceReferenceNumber) ?? defaults.nonPlaceReferenceNumber,
    nonPlaceBookingReference: firstParam(params.nonPlaceBookingReference) ?? defaults.nonPlaceBookingReference,
    nonPlaceOriginText: firstParam(params.nonPlaceOriginText) ?? defaults.nonPlaceOriginText,
    nonPlaceDestinationText: firstParam(params.nonPlaceDestinationText) ?? defaults.nonPlaceDestinationText,
    nonPlaceTerminalText: firstParam(params.nonPlaceTerminalText) ?? defaults.nonPlaceTerminalText,
    nonPlaceGateText: firstParam(params.nonPlaceGateText) ?? defaults.nonPlaceGateText,
  };

  if (selectedPlace && values.title.trim().length === 0) {
    return applySelectedPlaceToPlaceScheduleForm(values, selectedPlace);
  }
  return values;
}

export function validatePlaceScheduleDetailForm(
  values: PlaceScheduleDetailFormValues,
  duplicateConfirmed = false,
): PlaceScheduleDetailValidationResult {
  const title = values.title.trim();
  const startTime = values.startTime.trim();
  const endTime = values.endTime.trim();
  const memo = values.memo.trim();
  const errors: PlaceScheduleDetailFormErrors = {};

  if (title.length === 0) {
    errors.title = '일정 제목을 입력해주세요.';
  } else if ([...title].length > 120) {
    errors.title = '일정 제목은 120자 이하로 입력해주세요.';
  }

  if (!values.selectedPlace) {
    errors.place = '장소를 선택해주세요.';
  }

  if (startTime.length > 0 && !timePattern.test(startTime)) {
    errors.startTime = '시작 시간은 HH:mm 형식으로 입력해주세요.';
  }
  if (endTime.length > 0 && !timePattern.test(endTime)) {
    errors.endTime = '종료 시간은 HH:mm 형식으로 입력해주세요.';
  }
  if (!errors.startTime && !errors.endTime && endTime.length > 0 && startTime.length === 0) {
    errors.endTime = '종료 시간은 시작 시간과 함께 입력해주세요.';
  }
  if (!errors.startTime && !errors.endTime && startTime.length > 0 && endTime.length > 0 && endTime <= startTime) {
    errors.endTime = '종료 시간은 시작 시간보다 늦어야 해요.';
  }

  if ([...memo].length > 1000) {
    errors.memo = '메모는 1000자 이하로 입력해주세요.';
  }

  if (Object.keys(errors).length > 0 || !values.selectedPlace) {
    return { ok: false, errors };
  }

  const request: CreateGooglePlaceScheduleItemRequest = {
    googlePlaceId: values.selectedPlace.googlePlaceId,
    duplicateConfirmed,
    title,
  };
  if (startTime.length > 0) {
    request.startTime = startTime;
  }
  if (endTime.length > 0) {
    request.endTime = endTime;
  }
  if (memo.length > 0) {
    request.memo = memo;
  }
  return { ok: true, request };
}

export function buildPlaceScheduleDetailRoute(
  tripId: string,
  date: string,
  values?: PlaceScheduleDetailFormValues,
): Href {
  return appendPlaceScheduleDetailQuery(`/trips/${tripId}/days/${date}/places/new`, values) as Href;
}

export function buildGooglePlaceSearchSelectorRoute(
  tripId: string,
  date: string,
  values: PlaceScheduleDetailFormValues,
): Href {
  const params = new URLSearchParams();
  params.set('mode', 'select');
  appendPlaceScheduleDetailParams(params, values);
  return `${buildGooglePlaceSearchRoute(tripId, date)}?${params.toString()}` as Href;
}

export function validateUnifiedScheduleDetailForm(
  values: PlaceScheduleDetailFormValues,
  duplicateConfirmed = false,
): UnifiedScheduleDetailValidationResult {
  if (values.selectedPlace) {
    const validation = validatePlaceScheduleDetailForm(values, duplicateConfirmed);
    if (!validation.ok) {
      return validation;
    }
    return { ok: true, kind: 'place', request: validation.request };
  }

  const validation = validateCreateNonPlaceScheduleItemForm(detailValuesToNonPlaceForm(values));
  if (!validation.ok) {
    return { ok: false, errors: mapNonPlaceErrors(validation.errors) };
  }
  return { ok: true, kind: 'nonPlace', request: validation.request as CreateNonPlaceScheduleItemRequest };
}

export function hasRequiredPlaceScheduleDetailFields(values: PlaceScheduleDetailFormValues): boolean {
  return values.title.trim().length > 0 && values.selectedPlace !== null;
}

export function hasRequiredUnifiedScheduleDetailFields(values: PlaceScheduleDetailFormValues): boolean {
  if (values.title.trim().length === 0) {
    return false;
  }
  return (
    values.selectedPlace !== null || values.nonPlaceCategory !== 'transport' || values.nonPlaceTransportMode !== ''
  );
}

export function buildPlaceScheduleDetailSubmitState(
  isSubmitting: boolean,
  hasRequiredFields = true,
): { disabled: boolean; label: string } {
  if (isSubmitting) {
    return { disabled: true, label: '저장 중...' };
  }
  return { disabled: !hasRequiredFields, label: '저장' };
}

export function defaultScheduleTimeFromDate(date = new Date()): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function parseScheduleTimePickerValue(timeText: string): PlaceScheduleTimePickerValue {
  if (!timePattern.test(timeText)) {
    return { period: 'AM', hour: '12', minute: '00' };
  }
  const [hourText, minute] = timeText.split(':');
  const hour24 = Number(hourText);
  const period: PlaceScheduleTimePeriod = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { period, hour: pad2(hour12), minute };
}

export function buildScheduleTimeText(value: PlaceScheduleTimePickerValue): string {
  const hour12 = Number(value.hour);
  const normalizedHour = value.period === 'AM' ? hour12 % 12 : hour12 === 12 ? 12 : hour12 + 12;
  return `${pad2(normalizedHour)}:${value.minute}`;
}

export function defaultEndScheduleTimeFromStart(startTime: string): string {
  if (!timePattern.test(startTime)) {
    return '';
  }
  const [hourText, minuteText] = startTime.split(':');
  const startMinutes = Number(hourText) * 60 + Number(minuteText);
  const lastSameDayMinute = 23 * 60 + 59;
  if (startMinutes >= lastSameDayMinute) {
    return '';
  }
  const endMinutes = Math.min(startMinutes + 60, lastSameDayMinute);
  return `${pad2(Math.floor(endMinutes / 60))}:${pad2(endMinutes % 60)}`;
}

export function placeScheduleFailureMessage(status?: number): { title: string; helper: string } {
  if (status === 403 || status === 404) {
    return { title: '일정을 찾을 수 없어요.', helper: '삭제되었거나 접근할 수 없는 여행 일정이에요.' };
  }
  return { title: '일정을 저장할 수 없어요.', helper: '잠시 후 다시 시도해주세요.' };
}

function appendPlaceScheduleDetailQuery(path: string, values?: PlaceScheduleDetailFormValues): string {
  if (!values) {
    return path;
  }
  const params = new URLSearchParams();
  appendPlaceScheduleDetailParams(params, values);
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function appendPlaceScheduleDetailParams(params: URLSearchParams, values: PlaceScheduleDetailFormValues): void {
  appendString(params, 'title', values.title);
  if (values.titleTouched) {
    params.set('titleTouched', 'true');
  }
  appendString(params, 'startTime', values.startTime);
  appendString(params, 'endTime', values.endTime);
  appendString(params, 'memo', values.memo);
  if (values.selectedPlace) {
    params.set('googlePlaceId', values.selectedPlace.googlePlaceId);
    params.set('placeName', values.selectedPlace.placeName);
    params.set('address', values.selectedPlace.address);
    params.set('typeHint', values.selectedPlace.typeHint);
  }
  if (values.nonPlaceCategory !== 'memo') {
    params.set('nonPlaceCategory', values.nonPlaceCategory);
  }
  appendString(params, 'nonPlaceLink', values.nonPlaceLink);
  if (values.nonPlaceTransportMode !== 'other') {
    appendString(params, 'nonPlaceTransportMode', values.nonPlaceTransportMode);
  }
  appendString(params, 'nonPlaceReferenceNumber', values.nonPlaceReferenceNumber);
  appendString(params, 'nonPlaceBookingReference', values.nonPlaceBookingReference);
  appendString(params, 'nonPlaceOriginText', values.nonPlaceOriginText);
  appendString(params, 'nonPlaceDestinationText', values.nonPlaceDestinationText);
  appendString(params, 'nonPlaceTerminalText', values.nonPlaceTerminalText);
  appendString(params, 'nonPlaceGateText', values.nonPlaceGateText);
}

function detailValuesToNonPlaceForm(values: PlaceScheduleDetailFormValues): NonPlaceScheduleItemFormValues {
  return {
    category: values.nonPlaceCategory,
    title: values.title,
    startTime: values.startTime,
    endTime: values.endTime,
    memo: values.memo,
    link: values.nonPlaceLink,
    transportMode: values.nonPlaceTransportMode,
    referenceNumber: values.nonPlaceReferenceNumber,
    bookingReference: values.nonPlaceBookingReference,
    originText: values.nonPlaceOriginText,
    destinationText: values.nonPlaceDestinationText,
    terminalText: values.nonPlaceTerminalText,
    gateText: values.nonPlaceGateText,
  };
}

function mapNonPlaceErrors(errors: NonPlaceScheduleItemFormErrors): PlaceScheduleDetailFormErrors {
  const mapped: PlaceScheduleDetailFormErrors = {};
  if (errors.category) {
    mapped.nonPlaceCategory = errors.category;
  }
  if (errors.title) {
    mapped.title = errors.title;
  }
  if (errors.startTime) {
    mapped.startTime = errors.startTime;
  }
  if (errors.endTime) {
    mapped.endTime = errors.endTime;
  }
  if (errors.memo) {
    mapped.memo = errors.memo;
  }
  if (errors.link) {
    mapped.nonPlaceLink = errors.link;
  }
  if (errors.transportMode) {
    mapped.nonPlaceTransportMode = errors.transportMode;
  }
  if (errors.referenceNumber) {
    mapped.nonPlaceReferenceNumber = errors.referenceNumber;
  }
  if (errors.bookingReference) {
    mapped.nonPlaceBookingReference = errors.bookingReference;
  }
  if (errors.originText) {
    mapped.nonPlaceOriginText = errors.originText;
  }
  if (errors.destinationText) {
    mapped.nonPlaceDestinationText = errors.destinationText;
  }
  if (errors.terminalText) {
    mapped.nonPlaceTerminalText = errors.terminalText;
  }
  if (errors.gateText) {
    mapped.nonPlaceGateText = errors.gateText;
  }
  if (errors.form) {
    mapped.form = errors.form;
  }
  return mapped;
}

function parseNonPlaceCategory(value: string | undefined): NonPlaceScheduleItemCategory | null {
  if (nonPlaceCategoryOptions.some((option) => option.value === value)) {
    return value as NonPlaceScheduleItemCategory;
  }
  return null;
}

function parseNonPlaceTransportMode(value: string | undefined): NonPlaceTransportMode | '' | null {
  if (value === '') {
    return '';
  }
  if (nonPlaceTransportModeOptions.some((option) => option.value === value)) {
    return value as NonPlaceTransportMode;
  }
  return null;
}

function appendString(params: URLSearchParams, key: string, value: string): void {
  if (value.length > 0) {
    params.set(key, value);
  }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}
