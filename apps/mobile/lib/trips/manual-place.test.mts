import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildManualPlaceRoute,
  buildManualPlaceSubmitState,
  manualPlaceFailureState,
  manualPlaceTypeOptions,
  validateManualPlaceForm,
} from './manual-place';

describe('manual place helpers', () => {
  it('builds the manual place add route from trip id and date', () => {
    assert.equal(
      buildManualPlaceRoute('00000000-0000-0000-0000-000000000001', '2026-07-10'),
      '/trips/00000000-0000-0000-0000-000000000001/days/2026-07-10/places/new',
    );
  });

  it('uses the closed F-025 place type options with Korean labels', () => {
    assert.deepEqual(manualPlaceTypeOptions, [
      { value: 'sights', label: '관광지' },
      { value: 'food', label: '식당' },
      { value: 'lodging', label: '숙소' },
      { value: 'cafe', label: '카페' },
      { value: 'shopping', label: '쇼핑' },
      { value: 'transport', label: '이동수단' },
      { value: 'etc', label: '기타' },
    ]);
  });

  it('trims valid form values into the generated request shape', () => {
    assert.deepEqual(
      validateManualPlaceForm({ name: '  우메다 공중정원  ', address: '  Umeda  ', placeType: 'sights' }),
      {
        ok: true,
        request: {
          name: '우메다 공중정원',
          address: 'Umeda',
          placeType: 'sights',
        },
      },
    );
  });

  it('returns field validation errors for incomplete values', () => {
    assert.deepEqual(validateManualPlaceForm({ name: ' ', address: ' ', placeType: undefined }), {
      ok: false,
      errors: {
        name: '장소명을 입력해주세요.',
        address: '주소를 입력해주세요.',
        placeType: '장소 타입을 선택해주세요.',
      },
    });
  });

  it('returns field validation errors for length and enum constraints', () => {
    assert.deepEqual(
      validateManualPlaceForm({ name: '가'.repeat(121), address: '나'.repeat(241), placeType: 'museum' }),
      {
        ok: false,
        errors: {
          name: '장소명은 120자 이하로 입력해주세요.',
          address: '주소는 240자 이하로 입력해주세요.',
          placeType: '장소 타입을 선택해주세요.',
        },
      },
    );
  });

  it('disables duplicate submit while saving', () => {
    assert.deepEqual(buildManualPlaceSubmitState(false), { disabled: false, label: '저장' });
    assert.deepEqual(buildManualPlaceSubmitState(true), { disabled: true, label: '저장 중...' });
  });

  it('maps failures to not-found or retryable states while preserving retry intent', () => {
    assert.deepEqual(manualPlaceFailureState(403), {
      status: 'notFound',
      title: '일정을 찾을 수 없어요.',
      helper: '삭제되었거나 접근할 수 없는 여행 일정이에요.',
    });
    assert.deepEqual(manualPlaceFailureState(404), {
      status: 'notFound',
      title: '일정을 찾을 수 없어요.',
      helper: '삭제되었거나 접근할 수 없는 여행 일정이에요.',
    });
    assert.deepEqual(manualPlaceFailureState(409), {
      status: 'retryableError',
      title: '장소를 저장할 수 없어요.',
      helper: '잠시 후 다시 시도해주세요.',
    });
    assert.deepEqual(manualPlaceFailureState(), {
      status: 'retryableError',
      title: '장소를 저장할 수 없어요.',
      helper: '잠시 후 다시 시도해주세요.',
    });
  });
});
