import type { CreateManualDayItineraryItemRequest, TripPlaceType } from '@i-um/api-contract';

import { getPlaceTypeLabel } from './day-itinerary';

export type ManualPlaceFormValues = {
  name: string;
  address: string;
  placeType?: TripPlaceType | string;
};

export type ManualPlaceFormErrors = {
  name?: string;
  address?: string;
  placeType?: string;
};

export type ManualPlaceValidationResult =
  | { ok: true; request: CreateManualDayItineraryItemRequest }
  | { ok: false; errors: ManualPlaceFormErrors };

export type ManualPlaceFailureViewModel =
  | {
      status: 'notFound';
      title: string;
      helper: string;
    }
  | {
      status: 'retryableError';
      title: string;
      helper: string;
    };

export const manualPlaceTypeValues: TripPlaceType[] = ['sights', 'food', 'lodging', 'cafe', 'shopping', 'etc'];

export const manualPlaceTypeOptions = manualPlaceTypeValues.map((value) => ({
  value,
  label: getPlaceTypeLabel(value),
}));

export function buildManualPlaceRoute(tripId: string, date: string): string {
  return `/trips/${tripId}/days/${date}/places/new`;
}

export function validateManualPlaceForm(values: ManualPlaceFormValues): ManualPlaceValidationResult {
  const name = values.name.trim();
  const address = values.address.trim();
  const placeType = isTripPlaceType(values.placeType) ? values.placeType : undefined;
  const errors: ManualPlaceFormErrors = {};

  if (name.length === 0) {
    errors.name = '장소명을 입력해주세요.';
  } else if ([...name].length > 120) {
    errors.name = '장소명은 120자 이하로 입력해주세요.';
  }

  if (address.length === 0) {
    errors.address = '주소를 입력해주세요.';
  } else if ([...address].length > 240) {
    errors.address = '주소는 240자 이하로 입력해주세요.';
  }

  if (!placeType) {
    errors.placeType = '장소 타입을 선택해주세요.';
  }

  if (Object.keys(errors).length > 0 || !placeType) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    request: {
      name,
      address,
      placeType,
    },
  };
}

export function buildManualPlaceSubmitState(isSubmitting: boolean): { disabled: boolean; label: string } {
  return isSubmitting ? { disabled: true, label: '저장 중...' } : { disabled: false, label: '저장' };
}

export function manualPlaceFailureState(status?: number): ManualPlaceFailureViewModel {
  if (status === 403 || status === 404) {
    return {
      status: 'notFound',
      title: '일정을 찾을 수 없어요.',
      helper: '삭제되었거나 접근할 수 없는 여행 일정이에요.',
    };
  }

  return {
    status: 'retryableError',
    title: '장소를 저장할 수 없어요.',
    helper: '잠시 후 다시 시도해주세요.',
  };
}

function isTripPlaceType(value: ManualPlaceFormValues['placeType']): value is TripPlaceType {
  return typeof value === 'string' && manualPlaceTypeValues.includes(value as TripPlaceType);
}
