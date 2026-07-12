import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addScheduleEndTime,
  addScheduleStartTime,
  buildScheduleTimeEditorSummary,
  clearScheduleTimes,
  type ScheduleTimeEditorValues,
} from './schedule-time-editor';

describe('schedule time editor helpers', () => {
  it('adds a start time from the provided current time without requiring text entry', () => {
    const values: ScheduleTimeEditorValues = { startTime: '', endTime: '' };

    assert.deepEqual(addScheduleStartTime(values, new Date('2026-07-10T09:30:00')), {
      startTime: '09:30',
      endTime: '',
    });
  });

  it('adds a default same-day end time from a selected start time', () => {
    assert.deepEqual(addScheduleEndTime({ startTime: '22:45', endTime: '' }), {
      startTime: '22:45',
      endTime: '23:45',
    });
  });

  it('clears start and end time together for time-unspecified mode', () => {
    assert.deepEqual(clearScheduleTimes({ startTime: '09:30', endTime: '10:30' }), {
      startTime: '',
      endTime: '',
    });
  });

  it('summarizes unspecified and ranged times for compact editor rows', () => {
    assert.deepEqual(buildScheduleTimeEditorSummary({ startTime: '', endTime: '' }), {
      startLabel: '--:--',
      endLabel: '--:--',
      summaryLabel: '--:-- → --:--',
      hasStartTime: false,
      hasEndTime: false,
    });
    assert.deepEqual(buildScheduleTimeEditorSummary({ startTime: '08:12', endTime: '21:12' }), {
      startLabel: '오전 8:12',
      endLabel: '오후 9:12',
      summaryLabel: '오전 8:12 → 오후 9:12',
      hasStartTime: true,
      hasEndTime: true,
    });
  });
});
