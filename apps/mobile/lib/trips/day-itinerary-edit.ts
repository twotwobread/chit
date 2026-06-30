import type { TripPlaceType, UpdateScheduleItemRequest } from '@i-um/api-contract';

import type { DayItineraryRowViewModel } from './day-itinerary';
import { manualPlaceTypeValues } from './manual-place';

export type DayItineraryEditFormValues = {
  name: string;
  address: string;
  placeType?: TripPlaceType | string;
  startTime: string;
  endTime: string;
};

export type DayItineraryEditFormErrors = {
  name?: string;
  address?: string;
  placeType?: string;
  startTime?: string;
  endTime?: string;
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
    startTime: item.startTime ?? '',
    endTime: item.endTime ?? '',
  };
}

export function validateDayItineraryEditForm(
  original: DayItineraryEditFormValues,
  current: DayItineraryEditFormValues,
): DayItineraryEditValidationResult {
  const name = current.name.trim();
  const address = current.address.trim();
  const placeType = isTripPlaceType(current.placeType) ? current.placeType : undefined;
  const startTime = current.startTime.trim();
  const endTime = current.endTime.trim();
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

  if (startTime.length > 0 && !isScheduleItemTimeText(startTime)) {
    errors.startTime = '시작 시간은 HH:mm 형식으로 입력해주세요.';
  }
  if (endTime.length > 0 && !isScheduleItemTimeText(endTime)) {
    errors.endTime = '종료 시간은 HH:mm 형식으로 입력해주세요.';
  }
  if (!errors.startTime && !errors.endTime && endTime.length > 0 && startTime.length === 0) {
    errors.endTime = '종료 시간은 시작 시간과 함께 입력해주세요.';
  }
  if (!errors.startTime && !errors.endTime && startTime.length > 0 && endTime.length > 0 && endTime <= startTime) {
    errors.endTime = '종료 시간은 시작 시간보다 늦어야 해요.';
  }

  if (Object.keys(errors).length > 0 || !placeType) {
    return { ok: false, errors };
  }

  const originalName = original.name.trim();
  const originalAddress = original.address.trim();
  const originalPlaceType = isTripPlaceType(original.placeType) ? original.placeType : undefined;
  const originalStartTime = original.startTime.trim();
  const originalEndTime = original.endTime.trim();
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
  if (startTime !== originalStartTime) {
    request.startTime = startTime;
  }
  if (endTime !== originalEndTime) {
    request.endTime = endTime;
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
  if (item.itemType === 'non_place') {
    return {
      title: '이 일정을 삭제할까요?',
      helper: '이 Day 일정에서만 삭제돼요.',
      itemLabel: `${item.orderLabel}번째 일정 · ${item.placeName}`,
      contextLabel: [item.placeTypeLabel, item.nonPlaceDetailLabel].filter(Boolean).join(' · '),
    };
  }

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

function isScheduleItemTimeText(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
