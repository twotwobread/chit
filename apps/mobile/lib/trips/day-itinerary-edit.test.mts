import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DayItineraryRowViewModel } from './day-itinerary';
import {
  buildDayItineraryDeleteConfirmation,
  buildDayItineraryDeleteSubmitState,
  buildDayItineraryEditForm,
  buildDayItineraryEditSubmitState,
  dayItineraryMutationFailureState,
  validateDayItineraryEditForm,
} from './day-itinerary-edit';

const item: DayItineraryRowViewModel = {
  id: 'item-1',
  version: 2,
  orderLabel: '1',
  placeName: '우메다 공중정원',
  placeType: 'sights',
  placeTypeLabel: '관광지',
  address: 'Umeda',
  startTime: '09:30',
  endTime: '11:00',
  timeLabel: '09:30–11:00',
};

describe('day itinerary edit/delete helpers', () => {
  it('initializes an edit form from an itinerary row', () => {
    assert.deepEqual(buildDayItineraryEditForm(item), {
      name: '우메다 공중정원',
      address: 'Umeda',
      placeType: 'sights',
      startTime: '09:30',
      endTime: '11:00',
    });
  });

  it('builds a partial generated PATCH request from changed fields only', () => {
    const original = buildDayItineraryEditForm(item);

    assert.deepEqual(
      validateDayItineraryEditForm(original, {
        name: ' 우메다 스카이빌딩 ',
        address: 'Umeda',
        placeType: 'food',
        startTime: '09:30',
        endTime: '11:00',
      }),
      {
        ok: true,
        request: {
          name: '우메다 스카이빌딩',
          placeType: 'food',
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

  it('requires at least one changed supported field', () => {
    const original = buildDayItineraryEditForm(item);

    assert.deepEqual(validateDayItineraryEditForm(original, original), {
      ok: false,
      errors: { form: '변경할 내용을 입력해주세요.' },
    });
  });

  it('validates editable fields before submit', () => {
    const original = buildDayItineraryEditForm(item);

    assert.deepEqual(
      validateDayItineraryEditForm(original, {
        name: ' ',
        address: '나'.repeat(301),
        placeType: 'museum',
        startTime: '9:00',
        endTime: '8:00',
      }),
      {
        ok: false,
        errors: {
          name: '장소명을 입력해주세요.',
          address: '주소는 300자 이하로 입력해주세요.',
          placeType: '장소 타입을 선택해주세요.',
          startTime: '시작 시간은 HH:mm 형식으로 입력해주세요.',
          endTime: '종료 시간은 HH:mm 형식으로 입력해주세요.',
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
      helper: '이 Day 일정에서만 삭제돼요.',
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
