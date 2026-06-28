import type { TripPlaceType, UpdateScheduleItemRequest } from '@i-um/api-contract';

import type { DayItineraryRowViewModel } from './day-itinerary';
import { manualPlaceTypeValues } from './manual-place';

export type DayItineraryEditFormValues = {
  name: string;
  address: string;
  placeType?: TripPlaceType | string;
};

export type DayItineraryEditFormErrors = {
  name?: string;
  address?: string;
  placeType?: string;
  form?: string;
};

export type DayItineraryEditValidationResult =
  | { ok: true; request: UpdateScheduleItemRequest }
  | { ok: false; errors: DayItineraryEditFormErrors };

export type DayItineraryMutationFailureViewModel = {
  status: 'retryableError';
  title: string;
  helper: string;
};

export type DayItineraryDeleteModalStatus = 'idle' | 'confirming' | 'deleting';

export type DayItineraryDeleteConfirmationViewModel = {
  title: string;
  helper: string;
  itemLabel: string;
  contextLabel: string;
};

export type DayItineraryDeleteFocusTarget =
  | { kind: 'placeRow'; itemId: string }
  | { kind: 'emptyState' }
  | { kind: 'dayHeading' };

export function buildDayItineraryEditForm(item: DayItineraryRowViewModel): DayItineraryEditFormValues {
  return {
    name: item.placeName,
    address: item.address,
    placeType: item.placeType,
  };
}

export function validateDayItineraryEditForm(
  original: DayItineraryEditFormValues,
  current: DayItineraryEditFormValues,
): DayItineraryEditValidationResult {
  const name = current.name.trim();
  const address = current.address.trim();
  const placeType = isTripPlaceType(current.placeType) ? current.placeType : undefined;
  const errors: DayItineraryEditFormErrors = {};

  if (name.length === 0) {
    errors.name = '장소명을 입력해주세요.';
  } else if ([...name].length > 120) {
    errors.name = '장소명은 120자 이하로 입력해주세요.';
  }

  if (address.length === 0) {
    errors.address = '주소를 입력해주세요.';
  } else if ([...address].length > 300) {
    errors.address = '주소는 300자 이하로 입력해주세요.';
  }

  if (!placeType) {
    errors.placeType = '장소 타입을 선택해주세요.';
  }

  if (Object.keys(errors).length > 0 || !placeType) {
    return { ok: false, errors };
  }

  const originalName = original.name.trim();
  const originalAddress = original.address.trim();
  const originalPlaceType = isTripPlaceType(original.placeType) ? original.placeType : undefined;
  const request: UpdateScheduleItemRequest = {};

  if (name !== originalName) {
    request.name = name;
  }
  if (address !== originalAddress) {
    request.address = address;
  }
  if (placeType !== originalPlaceType) {
    request.placeType = placeType;
  }

  if (Object.keys(request).length === 0) {
    return { ok: false, errors: { form: '변경할 내용을 입력해주세요.' } };
  }

  return { ok: true, request };
}

export function buildDayItineraryEditSubmitState(isSubmitting: boolean): { disabled: boolean; label: string } {
  return isSubmitting ? { disabled: true, label: '저장 중...' } : { disabled: false, label: '저장' };
}

export function buildDayItineraryDeleteSubmitState(isDeleting: boolean): { disabled: boolean; label: string } {
  return isDeleting ? { disabled: true, label: '삭제 중...' } : { disabled: false, label: '삭제' };
}

export function buildDayItineraryDeleteConfirmation(
  item: DayItineraryRowViewModel,
): DayItineraryDeleteConfirmationViewModel {
  return {
    title: '이 장소를 삭제할까요?',
    helper: '이 Day 일정에서만 삭제돼요.',
    itemLabel: `${item.orderLabel}번째 장소 · ${item.placeName}`,
    contextLabel: `${item.placeTypeLabel} · ${item.address}`,
  };
}

export function canSubmitDayItineraryDelete(status: DayItineraryDeleteModalStatus): status is 'confirming' {
  return status === 'confirming';
}

export function canDismissDayItineraryDeleteModal(status: DayItineraryDeleteModalStatus): status is 'confirming' {
  return status === 'confirming';
}

export function resolveDayItineraryDeleteSuccessFocusTarget(
  items: readonly Pick<DayItineraryRowViewModel, 'id'>[],
  deletedItemId: string,
): DayItineraryDeleteFocusTarget {
  const deletedIndex = items.findIndex((item) => item.id === deletedItemId);

  if (deletedIndex >= 0) {
    const nextItem = items[deletedIndex + 1];
    if (nextItem) {
      return { kind: 'placeRow', itemId: nextItem.id };
    }

    const previousItem = items[deletedIndex - 1];
    if (previousItem) {
      return { kind: 'placeRow', itemId: previousItem.id };
    }

    return { kind: 'emptyState' };
  }

  return items.length === 0 ? { kind: 'emptyState' } : { kind: 'dayHeading' };
}

export function dayItineraryMutationFailureState(action: 'update' | 'delete'): DayItineraryMutationFailureViewModel {
  if (action === 'delete') {
    return {
      status: 'retryableError',
      title: '장소를 삭제할 수 없어요.',
      helper: '잠시 후 다시 시도해주세요.',
    };
  }

  return {
    status: 'retryableError',
    title: '장소 정보를 저장할 수 없어요.',
    helper: '잠시 후 다시 시도해주세요.',
  };
}

function isTripPlaceType(value: DayItineraryEditFormValues['placeType']): value is TripPlaceType {
  return typeof value === 'string' && manualPlaceTypeValues.includes(value as TripPlaceType);
}
