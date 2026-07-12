import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTripDateRangeEditorSegments,
  buildTripDateRangePickerState,
  keepTripDateRangePickerFieldAfterSelect,
  minDateForTripDateRangeField,
  selectTripDateRangeDate,
  type TripDateRangeEditorValues,
} from './trip-date-range-editor';

describe('trip date range editor helpers', () => {
  it('builds compact start date to end date segments with active state', () => {
    const values: TripDateRangeEditorValues = { startDate: '2026-07-12', endDate: '' };

    assert.deepEqual(buildTripDateRangeEditorSegments(values, 'endDate'), [
      {
        accessibilityLabel: '시작 일자 선택',
        active: false,
        field: 'startDate',
        label: '시작',
        valueLabel: '2026-07-12',
      },
      {
        accessibilityLabel: '종료 일자 선택',
        active: true,
        field: 'endDate',
        label: '종료',
        valueLabel: '날짜 선택',
      },
    ]);
  });

  it('describes the active calendar directly below the date range segments', () => {
    const values: TripDateRangeEditorValues = { startDate: '2026-07-12', endDate: '2026-07-15' };

    assert.deepEqual(buildTripDateRangePickerState(values, 'endDate', '2026-07-10'), {
      anchorDate: '2026-07-12',
      helperText: '시작 일자 이전 날짜는 선택할 수 없어요.',
      label: '종료 일자 선택',
      minDate: '2026-07-12',
      placement: 'below-range-segments',
      selectedDate: '2026-07-15',
    });
    assert.equal(buildTripDateRangePickerState(values, null, '2026-07-10'), null);
  });

  it('keeps the date range valid when selecting start or end dates', () => {
    const values: TripDateRangeEditorValues = { startDate: '2026-07-12', endDate: '2026-07-15' };

    assert.deepEqual(selectTripDateRangeDate(values, 'startDate', '2026-07-16'), {
      startDate: '2026-07-16',
      endDate: '',
    });
    assert.deepEqual(selectTripDateRangeDate(values, 'startDate', '2026-07-10'), {
      startDate: '2026-07-10',
      endDate: '2026-07-15',
    });
    assert.deepEqual(selectTripDateRangeDate(values, 'endDate', '2026-07-20'), {
      startDate: '2026-07-12',
      endDate: '2026-07-20',
    });
  });

  it('cancels a selected date when the same date is selected again', () => {
    const values: TripDateRangeEditorValues = { startDate: '2026-07-12', endDate: '2026-07-15' };

    assert.deepEqual(selectTripDateRangeDate(values, 'startDate', '2026-07-12'), {
      startDate: '',
      endDate: '',
    });
    assert.deepEqual(selectTripDateRangeDate(values, 'endDate', '2026-07-15'), {
      startDate: '2026-07-12',
      endDate: '',
    });
  });

  it('keeps the active calendar open after selecting a date so the same date can be canceled', () => {
    assert.equal(keepTripDateRangePickerFieldAfterSelect('startDate'), 'startDate');
    assert.equal(keepTripDateRangePickerFieldAfterSelect('endDate'), 'endDate');
  });

  it('uses the valid future start date as the end date minimum', () => {
    assert.equal(minDateForTripDateRangeField('startDate', '2026-07-12', '2026-07-10'), '2026-07-10');
    assert.equal(minDateForTripDateRangeField('endDate', '2026-07-12', '2026-07-10'), '2026-07-12');
    assert.equal(minDateForTripDateRangeField('endDate', 'bad-date', '2026-07-10'), '2026-07-10');
  });
});
