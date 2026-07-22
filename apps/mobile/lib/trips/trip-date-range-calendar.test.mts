import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildTripDateRangeCalendarState,
  buildTripDateRangeMarkedDates,
  formatTripDateRangeSummary,
  selectTripDateRangeCalendarDate,
} from './trip-date-range-calendar';

test('date range calendar uses first tap as start and second tap as end with same-day trips allowed', () => {
  const start = selectTripDateRangeCalendarDate({ startDate: '', endDate: '', name: 'draft' }, '2026-08-02');
  assert.deepEqual(start, { startDate: '2026-08-02', endDate: '', name: 'draft' });

  const sameDay = selectTripDateRangeCalendarDate(start, '2026-08-02');
  assert.deepEqual(sameDay, { startDate: '2026-08-02', endDate: '2026-08-02', name: 'draft' });
  assert.equal(formatTripDateRangeSummary(sameDay), '2026-08-02 당일');
});

test('date range calendar restarts from a new start after a completed range or earlier end tap', () => {
  const waitingForEnd = selectTripDateRangeCalendarDate({ startDate: '', endDate: '' }, '2026-08-10');
  assert.deepEqual(selectTripDateRangeCalendarDate(waitingForEnd, '2026-08-08'), {
    startDate: '2026-08-08',
    endDate: '',
  });

  const complete = { startDate: '2026-08-10', endDate: '2026-08-12' };
  assert.deepEqual(selectTripDateRangeCalendarDate(complete, '2026-08-20'), {
    startDate: '2026-08-20',
    endDate: '',
  });
});

test('date range calendar state guides the next direct tap without opening nested date fields', () => {
  assert.deepEqual(buildTripDateRangeCalendarState({ startDate: '', endDate: '' }), {
    endLabel: '종료일 선택 전',
    helperText: '시작일을 먼저 찍어요. 당일치기도 가능해요.',
    nextSelection: 'startDate',
    startLabel: '시작일 선택 전',
  });

  assert.deepEqual(buildTripDateRangeCalendarState({ startDate: '2026-08-02', endDate: '' }), {
    endLabel: '종료일 선택 전',
    helperText: '종료일을 찍으면 기간 선택 끝.',
    nextSelection: 'endDate',
    startLabel: '2026-08-02',
  });
});

test('date range calendar marks single-day and multi-day ranges for period highlighting', () => {
  assert.deepEqual(buildTripDateRangeMarkedDates({ startDate: '2026-08-02', endDate: '2026-08-02' }), {
    '2026-08-02': {
      color: 'range',
      endingDay: true,
      startingDay: true,
      textColor: 'rangeText',
    },
  });

  assert.deepEqual(buildTripDateRangeMarkedDates({ startDate: '2026-08-02', endDate: '2026-08-04' }), {
    '2026-08-02': {
      color: 'range',
      startingDay: true,
      textColor: 'rangeText',
    },
    '2026-08-03': {
      color: 'range',
      textColor: 'rangeText',
    },
    '2026-08-04': {
      color: 'range',
      endingDay: true,
      textColor: 'rangeText',
    },
  });
});
