import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applySelectedPlaceToPlaceScheduleForm,
  buildGooglePlaceSearchSelectorRoute,
  buildPlaceScheduleDetailRoute,
  buildPlaceScheduleDetailSubmitState,
  buildScheduleTimeText,
  clearSelectedPlaceFromPlaceScheduleForm,
  defaultEndScheduleTimeFromStart,
  defaultScheduleTimeFromDate,
  emptyPlaceScheduleDetailForm,
  hasRequiredPlaceScheduleDetailFields,
  hasRequiredUnifiedScheduleDetailFields,
  parseScheduleTimePickerValue,
  validatePlaceScheduleDetailForm,
  validateUnifiedScheduleDetailForm,
  type PlaceScheduleDetailFormValues,
  type PlaceScheduleSelectedPlace,
} from './place-schedule-detail';

const selectedPlace: PlaceScheduleSelectedPlace = {
  googlePlaceId: 'google-1',
  placeName: '도톤보리',
  address: 'Osaka',
  typeHint: '관광지',
};

const emptyNonPlaceFields = {
  nonPlaceCategory: 'memo',
  nonPlaceLink: '',
  nonPlaceTransportMode: 'other',
  nonPlaceReferenceNumber: '',
  nonPlaceBookingReference: '',
  nonPlaceOriginText: '',
  nonPlaceDestinationText: '',
  nonPlaceTerminalText: '',
  nonPlaceGateText: '',
} satisfies Pick<
  PlaceScheduleDetailFormValues,
  | 'nonPlaceCategory'
  | 'nonPlaceLink'
  | 'nonPlaceTransportMode'
  | 'nonPlaceReferenceNumber'
  | 'nonPlaceBookingReference'
  | 'nonPlaceOriginText'
  | 'nonPlaceDestinationText'
  | 'nonPlaceTerminalText'
  | 'nonPlaceGateText'
>;

describe('place schedule detail helpers', () => {
  it('defaults to a non-place memo schedule until a place is selected', () => {
    assert.deepEqual(emptyPlaceScheduleDetailForm(), {
      title: '',
      startTime: '',
      endTime: '',
      memo: '',
      titleTouched: false,
      selectedPlace: null,
      ...emptyNonPlaceFields,
    });
  });

  it('defaults the required schedule title from the selected place unless the user edited it', () => {
    assert.deepEqual(applySelectedPlaceToPlaceScheduleForm(emptyPlaceScheduleDetailForm(), selectedPlace), {
      title: '도톤보리',
      startTime: '',
      endTime: '',
      memo: '',
      titleTouched: false,
      selectedPlace,
      ...emptyNonPlaceFields,
    });

    assert.deepEqual(
      applySelectedPlaceToPlaceScheduleForm(
        { ...emptyPlaceScheduleDetailForm(), title: '내 일정 제목', titleTouched: true },
        selectedPlace,
      ),
      {
        title: '내 일정 제목',
        startTime: '',
        endTime: '',
        memo: '',
        titleTouched: true,
        selectedPlace,
        ...emptyNonPlaceFields,
      },
    );
  });

  it('clears the selected place while preserving common schedule fields', () => {
    assert.deepEqual(
      clearSelectedPlaceFromPlaceScheduleForm({
        ...emptyPlaceScheduleDetailForm(),
        title: '아침 이동',
        titleTouched: true,
        startTime: '09:30',
        endTime: '10:30',
        memo: '짐 챙기기',
        selectedPlace,
        nonPlaceCategory: 'transport',
        nonPlaceLink: 'https://example.com/ticket',
      }),
      {
        ...emptyPlaceScheduleDetailForm(),
        title: '아침 이동',
        titleTouched: true,
        startTime: '09:30',
        endTime: '10:30',
        memo: '짐 챙기기',
        selectedPlace: null,
        nonPlaceCategory: 'transport',
        nonPlaceLink: 'https://example.com/ticket',
      },
    );
  });

  it('validates required title/place and builds an untimed create request', () => {
    assert.deepEqual(validatePlaceScheduleDetailForm(emptyPlaceScheduleDetailForm()), {
      ok: false,
      errors: {
        title: '일정 제목을 입력해주세요.',
        place: '장소를 선택해주세요.',
      },
    });

    assert.deepEqual(
      validatePlaceScheduleDetailForm({
        ...emptyPlaceScheduleDetailForm(),
        title: '  도톤보리 산책  ',
        selectedPlace,
      }),
      {
        ok: true,
        request: {
          googlePlaceId: 'google-1',
          duplicateConfirmed: false,
          title: '도톤보리 산책',
        },
      },
    );
  });

  it('validates time pair and includes optional memo in the create request', () => {
    assert.deepEqual(
      validatePlaceScheduleDetailForm({
        ...emptyPlaceScheduleDetailForm(),
        title: '도톤보리 산책',
        selectedPlace,
        endTime: '11:00',
      }),
      { ok: false, errors: { endTime: '종료 시간은 시작 시간과 함께 입력해주세요.' } },
    );

    assert.deepEqual(
      validatePlaceScheduleDetailForm({
        ...emptyPlaceScheduleDetailForm(),
        title: '도톤보리 산책',
        selectedPlace,
        startTime: '09:30',
        endTime: '11:00',
        memo: '  강가 산책하기  ',
      }),
      {
        ok: true,
        request: {
          googlePlaceId: 'google-1',
          duplicateConfirmed: false,
          title: '도톤보리 산책',
          startTime: '09:30',
          endTime: '11:00',
          memo: '강가 산책하기',
        },
      },
    );
  });

  it('disables place-only submit until required title and selected place exist', () => {
    const empty = emptyPlaceScheduleDetailForm();
    assert.equal(hasRequiredPlaceScheduleDetailFields(empty), false);
    assert.deepEqual(buildPlaceScheduleDetailSubmitState(false, false), { disabled: true, label: '저장' });
    assert.deepEqual(buildPlaceScheduleDetailSubmitState(true, true), { disabled: true, label: '저장 중...' });
    assert.equal(hasRequiredPlaceScheduleDetailFields({ ...empty, title: '도톤보리 산책', selectedPlace }), true);
    assert.deepEqual(buildPlaceScheduleDetailSubmitState(false, true), { disabled: false, label: '저장' });
  });

  it('validates unified non-place and place save requests from selected-place state', () => {
    const empty = emptyPlaceScheduleDetailForm();
    assert.equal(hasRequiredUnifiedScheduleDetailFields(empty), false);
    assert.deepEqual(validateUnifiedScheduleDetailForm(empty), {
      ok: false,
      errors: { title: '일정 제목을 입력해주세요.' },
    });

    assert.equal(hasRequiredUnifiedScheduleDetailFields({ ...empty, title: '체크아웃' }), true);
    assert.deepEqual(
      validateUnifiedScheduleDetailForm({
        ...empty,
        title: '  체크아웃  ',
        startTime: '09:00',
        memo: '  프런트에 키 반납  ',
        nonPlaceCategory: 'reminder',
      }),
      {
        ok: true,
        kind: 'nonPlace',
        request: {
          category: 'reminder',
          title: '체크아웃',
          startTime: '09:00',
          memo: '프런트에 키 반납',
        },
      },
    );

    assert.deepEqual(
      validateUnifiedScheduleDetailForm({
        ...empty,
        title: '공항 이동',
        nonPlaceCategory: 'transport',
        nonPlaceTransportMode: '',
      }),
      { ok: false, errors: { nonPlaceTransportMode: '이동 수단을 선택해주세요.' } },
    );

    assert.deepEqual(
      validateUnifiedScheduleDetailForm({
        ...empty,
        title: '도톤보리 산책',
        selectedPlace,
      }),
      {
        ok: true,
        kind: 'place',
        request: {
          googlePlaceId: 'google-1',
          duplicateConfirmed: false,
          title: '도톤보리 산책',
        },
      },
    );
  });

  it('builds AM/PM wheel picker values from schedule time text and current time defaults', () => {
    assert.equal(defaultScheduleTimeFromDate(new Date('2026-07-10T14:07:00')), '14:07');
    assert.deepEqual(parseScheduleTimePickerValue('00:05'), { period: 'AM', hour: '12', minute: '05' });
    assert.deepEqual(parseScheduleTimePickerValue('12:30'), { period: 'PM', hour: '12', minute: '30' });
    assert.deepEqual(parseScheduleTimePickerValue('23:59'), { period: 'PM', hour: '11', minute: '59' });
    assert.equal(buildScheduleTimeText({ period: 'AM', hour: '12', minute: '05' }), '00:05');
    assert.equal(buildScheduleTimeText({ period: 'PM', hour: '01', minute: '05' }), '13:05');
  });

  it('defaults optional end time after start time without crossing the same-day boundary', () => {
    assert.equal(defaultEndScheduleTimeFromStart('09:30'), '10:30');
    assert.equal(defaultEndScheduleTimeFromStart('23:30'), '23:59');
    assert.equal(defaultEndScheduleTimeFromStart('23:59'), '');
  });

  it('builds detail and selector routes while preserving unsaved form values', () => {
    const values = {
      ...emptyPlaceScheduleDetailForm(),
      title: '도톤보리 산책',
      titleTouched: true,
      startTime: '09:30',
      memo: '강가 산책하기',
      selectedPlace,
    };

    assert.equal(
      buildPlaceScheduleDetailRoute('trip-1', '2026-07-10', values),
      '/trips/trip-1/days/2026-07-10/places/new?title=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC+%EC%82%B0%EC%B1%85&titleTouched=true&startTime=09%3A30&memo=%EA%B0%95%EA%B0%80+%EC%82%B0%EC%B1%85%ED%95%98%EA%B8%B0&googlePlaceId=google-1&placeName=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC&address=Osaka&typeHint=%EA%B4%80%EA%B4%91%EC%A7%80',
    );
    assert.equal(
      buildGooglePlaceSearchSelectorRoute('trip-1', '2026-07-10', values),
      '/trips/trip-1/days/2026-07-10/place-search?mode=select&title=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC+%EC%82%B0%EC%B1%85&titleTouched=true&startTime=09%3A30&memo=%EA%B0%95%EA%B0%80+%EC%82%B0%EC%B1%85%ED%95%98%EA%B8%B0&googlePlaceId=google-1&placeName=%EB%8F%84%ED%86%A4%EB%B3%B4%EB%A6%AC&address=Osaka&typeHint=%EA%B4%80%EA%B4%91%EC%A7%80',
    );
  });
});
