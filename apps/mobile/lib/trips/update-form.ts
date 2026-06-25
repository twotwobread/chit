import type { SupportedCurrency, Trip, UpdateTripRequest } from '@i-um/api-contract';

import { isValidDate } from './date';

export type TripBasicInfoForm = {
  name: string;
  startDate: string;
  endDate: string;
  defaultCurrency: SupportedCurrency;
};

export const supportedCurrencies: SupportedCurrency[] = ['KRW', 'JPY', 'USD', 'EUR'];

export function tripToBasicInfoForm(trip: Trip): TripBasicInfoForm {
  return {
    name: trip.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
    defaultCurrency: trip.defaultCurrency,
  };
}

export function validateTripBasicInfoForm(form: TripBasicInfoForm): string | null {
  const name = form.name.trim();
  if (name.length < 1) {
    return '여행 이름을 입력해주세요.';
  }
  if ([...name].length > 80) {
    return '여행 이름은 80자 이내로 입력해주세요.';
  }
  if (!form.startDate || !form.endDate) {
    return '날짜를 선택해주세요.';
  }
  if (!isValidDate(form.startDate) || !isValidDate(form.endDate)) {
    return '날짜는 YYYY-MM-DD 형식으로 입력해주세요.';
  }
  if (form.startDate > form.endDate) {
    return '종료일은 시작일보다 빠를 수 없어요.';
  }
  if (!supportedCurrencies.includes(form.defaultCurrency)) {
    return '지원하는 통화를 선택해주세요.';
  }
  return null;
}

export function buildUpdateTripRequest(original: TripBasicInfoForm, current: TripBasicInfoForm): UpdateTripRequest {
  const request: UpdateTripRequest = {};
  const trimmedName = current.name.trim();

  if (trimmedName !== original.name.trim()) {
    request.name = trimmedName;
  }
  if (current.startDate !== original.startDate) {
    request.startDate = current.startDate;
  }
  if (current.endDate !== original.endDate) {
    request.endDate = current.endDate;
  }
  if (current.defaultCurrency !== original.defaultCurrency) {
    request.defaultCurrency = current.defaultCurrency;
  }

  return request;
}

export function hasTripBasicInfoChanges(original: TripBasicInfoForm, current: TripBasicInfoForm): boolean {
  return Object.keys(buildUpdateTripRequest(original, current)).length > 0;
}

export function canSubmitTripBasicInfoUpdate({
  current,
  original,
  submitting,
}: {
  current: TripBasicInfoForm;
  original: TripBasicInfoForm | null;
  submitting: boolean;
}): boolean {
  if (submitting || !original) {
    return false;
  }
  return validateTripBasicInfoForm(current) === null && hasTripBasicInfoChanges(original, current);
}
