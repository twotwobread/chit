import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupportedCurrency, Trip, TripDefaultTravelMode } from '@i-um/api-contract';

import {
  buildUpdateTripRequest,
  canSubmitTripBasicInfoUpdate,
  hasTripBasicInfoChanges,
  tripToBasicInfoForm,
  validateTripBasicInfoForm,
  type TripBasicInfoForm,
} from './update-form.ts';

const original: TripBasicInfoForm = {
  name: '오사카 3박 4일',
  startDate: '2026-07-10',
  endDate: '2026-07-13',
  defaultCurrency: 'JPY',
  defaultTravelMode: 'transit',
};

function form(overrides: Partial<TripBasicInfoForm>): TripBasicInfoForm {
  return { ...original, ...overrides };
}

test('maps trip detail into an editable basic-info form', () => {
  const trip: Trip = {
    id: 'trip-1',
    name: '오사카 3박 4일',
    startDate: '2026-07-10',
    endDate: '2026-07-13',
    defaultCurrency: 'JPY',
    defaultTravelMode: 'transit',
    createdBy: 'user-1',
    createdAt: '2026-06-21T00:00:00Z',
    updatedAt: '2026-06-21T00:00:00Z',
  };

  assert.deepEqual(tripToBasicInfoForm(trip), original);
});

test('builds changed-field-only update payload and trims changed name', () => {
  assert.deepEqual(buildUpdateTripRequest(original, form({ name: '  오사카 4박 5일  ' })), {
    name: '오사카 4박 5일',
  });

  assert.deepEqual(
    buildUpdateTripRequest(
      original,
      form({ startDate: '2026-06-01', endDate: '2026-06-03', defaultCurrency: 'USD', defaultTravelMode: 'driving' }),
    ),
    {
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      defaultCurrency: 'USD',
      defaultTravelMode: 'driving',
    },
  );

  assert.deepEqual(buildUpdateTripRequest(original, form({ name: '  오사카 3박 4일  ' })), {});
});

test('validates required fields, date format, date range, currency, and travel mode', () => {
  assert.equal(validateTripBasicInfoForm(form({ name: ' ' })), '여행 이름을 입력해주세요.');
  assert.equal(validateTripBasicInfoForm(form({ name: '가'.repeat(81) })), '여행 이름은 80자 이내로 입력해주세요.');
  assert.equal(validateTripBasicInfoForm(form({ startDate: '' })), '날짜를 선택해주세요.');
  assert.equal(
    validateTripBasicInfoForm(form({ startDate: '2026/07/10' })),
    '날짜는 YYYY-MM-DD 형식으로 입력해주세요.',
  );
  assert.equal(validateTripBasicInfoForm(form({ startDate: '2026-07-14' })), '종료일은 시작일보다 빠를 수 없어요.');
  assert.equal(
    validateTripBasicInfoForm(form({ defaultCurrency: 'GBP' as SupportedCurrency })),
    '지원하는 통화를 선택해주세요.',
  );
  assert.equal(
    validateTripBasicInfoForm(form({ defaultTravelMode: 'walking' as TripDefaultTravelMode })),
    '지원하는 이동 방식을 선택해주세요.',
  );
});

test('allows past dates for trip update when date range is valid', () => {
  assert.equal(validateTripBasicInfoForm(form({ startDate: '2026-06-01', endDate: '2026-06-03' })), null);
});

test('submit is disabled for unchanged, invalid, missing original, or submitting state', () => {
  assert.equal(hasTripBasicInfoChanges(original, form({ name: '도쿄 2박 3일' })), true);
  assert.equal(hasTripBasicInfoChanges(original, form({ defaultTravelMode: 'driving' })), true);
  assert.equal(hasTripBasicInfoChanges(original, original), false);

  assert.equal(
    canSubmitTripBasicInfoUpdate({ original, current: form({ name: '도쿄 2박 3일' }), submitting: false }),
    true,
  );
  assert.equal(canSubmitTripBasicInfoUpdate({ original, current: original, submitting: false }), false);
  assert.equal(canSubmitTripBasicInfoUpdate({ original, current: form({ name: ' ' }), submitting: false }), false);
  assert.equal(
    canSubmitTripBasicInfoUpdate({ original, current: form({ name: '도쿄 2박 3일' }), submitting: true }),
    false,
  );
  assert.equal(
    canSubmitTripBasicInfoUpdate({ original: null, current: form({ name: '도쿄 2박 3일' }), submitting: false }),
    false,
  );
});
