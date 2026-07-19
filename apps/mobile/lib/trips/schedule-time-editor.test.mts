import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addScheduleEndTime,
  addScheduleStartTime,
  addScheduleEndTimeDuration,
  buildScheduleTimeEditorSummary,
  clearScheduleTimes,
  type ScheduleTimeEditorValues,
} from './schedule-time-editor';

describe('schedule time editor helpers', () => {
  it('adds a fixed midnight start time without requiring text entry', () => {
    const values: ScheduleTimeEditorValues = { startTime: '', endTime: '' };

    assert.deepEqual(addScheduleStartTime(values, new Date('2026-07-10T09:30:00')), {
      startTime: '00:00',
      endTime: '',
    });
  });

  it('uses a valid previous end time as the start time default when provided', () => {
    const values: ScheduleTimeEditorValues = { startTime: '', endTime: '' };

    assert.deepEqual(addScheduleStartTime(values, '10:30'), {
      startTime: '10:30',
      endTime: '',
    });
    assert.deepEqual(addScheduleStartTime(values, '9:30'), {
      startTime: '00:00',
      endTime: '',
    });
  });

  it('starts the default end time at the selected start time', () => {
    assert.deepEqual(addScheduleEndTime({ startTime: '22:45', endTime: '' }), {
      startTime: '22:45',
      endTime: '22:45',
    });
  });

  it('adds quick duration buttons to the current end time when present', () => {
    assert.deepEqual(addScheduleEndTimeDuration({ startTime: '09:30', endTime: '' }, 30), {
      startTime: '09:30',
      endTime: '10:00',
    });
    assert.deepEqual(addScheduleEndTimeDuration({ startTime: '09:30', endTime: '10:00' }, 60), {
      startTime: '09:30',
      endTime: '11:00',
    });
    assert.deepEqual(addScheduleEndTimeDuration({ startTime: '09:30', endTime: '11:00' }, 120), {
      startTime: '09:30',
      endTime: '13:00',
    });
    assert.deepEqual(addScheduleEndTimeDuration({ startTime: '10:00', endTime: '09:00' }, 60), {
      startTime: '10:00',
      endTime: '11:00',
    });
  });

  it('does not set a quick duration end time when start time is invalid or would overflow the same day', () => {
    assert.deepEqual(addScheduleEndTimeDuration({ startTime: '', endTime: '' }, 30), {
      startTime: '',
      endTime: '',
    });
    assert.deepEqual(addScheduleEndTimeDuration({ startTime: '23:45', endTime: '' }, 30), {
      startTime: '23:45',
      endTime: '',
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
      startLabel: '08:12',
      endLabel: '21:12',
      summaryLabel: '08:12 → 21:12',
      hasStartTime: true,
      hasEndTime: true,
    });
  });
});
