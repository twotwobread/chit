import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DayItineraryRowViewModel } from './day-itinerary';
import {
  buildDayItineraryDeleteConfirmation,
  buildDayItineraryDeleteSubmitState,
  buildDayItineraryEditForm,
  buildDayItineraryEditSubmitState,
  dayItineraryMutationFailureState,
  hasDayItineraryEditFormChanges,
  validateDayItineraryEditForm,
} from './day-itinerary-edit';

const item: DayItineraryRowViewModel = {
  id: 'item-1',
  version: 2,
  orderLabel: '1',
  itemType: 'place',
  placeName: '우메다 공중정원',
  placeType: 'sights',
  placeTypeLabel: '관광지',
  address: 'Umeda',
  startTime: '09:30',
  endTime: '11:00',
  timeLabel: '09:30–11:00',
  placeMemo: '강가 걷기',
};

describe('day itinerary edit/delete helpers', () => {
  it('initializes an edit form from an itinerary row', () => {
    assert.deepEqual(buildDayItineraryEditForm(item), {
      placeType: 'sights',
      startTime: '09:30',
      endTime: '11:00',
      memo: '강가 걷기',
    });
  });

  it('builds a partial generated PATCH request from editable fields only', () => {
    const original = buildDayItineraryEditForm(item);

    assert.deepEqual(
      validateDayItineraryEditForm(original, {
        ...original,
        placeType: 'food',
        memo: ' 노을 보기 ',
      }),
      {
        ok: true,
        request: {
          placeType: 'food',
          memo: '노을 보기',
        },
      },
    );
  });

  it('builds time set and clear patch fields from changed time values', () => {
    const original = buildDayItineraryEditForm(item);

    assert.deepEqual(
      validateDayItineraryEditForm(original, {
        ...original,
        startTime: '10:00',
        endTime: '',
      }),
      {
        ok: true,
        request: {
          startTime: '10:00',
          endTime: '',
        },
      },
    );
  });

  it('builds memo clear patch field from an empty memo', () => {
    const original = buildDayItineraryEditForm(item);

    assert.deepEqual(
      validateDayItineraryEditForm(original, {
        ...original,
        memo: ' ',
      }),
      {
        ok: true,
        request: {
          memo: '',
        },
      },
    );
  });

  it('requires at least one changed supported field', () => {
    const original = buildDayItineraryEditForm(item);

    assert.deepEqual(validateDayItineraryEditForm(original, original), {
      ok: false,
      errors: { form: '변경할 내용을 입력해주세요.' },
    });
  });

  it('detects editable changes for close confirmation', () => {
    const original = buildDayItineraryEditForm(item);

    assert.equal(hasDayItineraryEditFormChanges(original, { ...original }), false);
    assert.equal(hasDayItineraryEditFormChanges(original, { ...original, memo: '새 메모' }), true);
    assert.equal(hasDayItineraryEditFormChanges(original, { ...original, placeType: 'food' }), true);
  });

  it('validates editable fields before submit', () => {
    const original = buildDayItineraryEditForm(item);

    assert.deepEqual(
      validateDayItineraryEditForm(original, {
        ...original,
        placeType: 'museum',
        startTime: '9:00',
        endTime: '8:00',
        memo: '메'.repeat(1001),
      }),
      {
        ok: false,
        errors: {
          placeType: '장소 타입을 선택해주세요.',
          startTime: '시작 시간은 HH:mm 형식으로 입력해주세요.',
          endTime: '종료 시간은 HH:mm 형식으로 입력해주세요.',
          memo: '메모는 1000자 이하로 입력해주세요.',
        },
      },
    );
  });

  it('rejects end time without start time or before start time', () => {
    const original = buildDayItineraryEditForm({ ...item, startTime: null, endTime: null, timeLabel: undefined });

    assert.deepEqual(validateDayItineraryEditForm(original, { ...original, endTime: '10:00' }), {
      ok: false,
      errors: { endTime: '종료 시간은 시작 시간과 함께 입력해주세요.' },
    });
    assert.deepEqual(validateDayItineraryEditForm(original, { ...original, startTime: '11:00', endTime: '10:00' }), {
      ok: false,
      errors: { endTime: '종료 시간은 시작 시간보다 늦어야 해요.' },
    });
  });

  it('maps saving and deleting labels to disabled submit states', () => {
    assert.deepEqual(buildDayItineraryEditSubmitState(false), { disabled: false, label: '저장' });
    assert.deepEqual(buildDayItineraryEditSubmitState(true), { disabled: true, label: '저장 중...' });
    assert.deepEqual(buildDayItineraryDeleteSubmitState(false), { disabled: false, label: '삭제' });
    assert.deepEqual(buildDayItineraryDeleteSubmitState(true), { disabled: true, label: '삭제 중...' });
  });

  it('builds delete confirmation copy for a selected row', () => {
    assert.deepEqual(buildDayItineraryDeleteConfirmation(item), {
      title: '이 장소를 삭제할까요?',
      helper: '이 일차 일정에서만 삭제돼요.',
      itemLabel: '1번째 장소 · 우메다 공중정원',
      contextLabel: '관광지 · Umeda',
    });
  });

  it('maps mutation failures to retryable copy', () => {
    assert.deepEqual(dayItineraryMutationFailureState('update'), {
      status: 'retryableError',
      title: '장소 정보를 저장할 수 없어요.',
      helper: '잠시 후 다시 시도해주세요.',
    });
    assert.deepEqual(dayItineraryMutationFailureState('delete'), {
      status: 'retryableError',
      title: '장소를 삭제할 수 없어요.',
      helper: '잠시 후 다시 시도해주세요.',
    });
  });
});
