import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_SCHEDULE_TIME_WHEEL_VISIBLE_ITEMS,
  buildScheduleTimeWheelOffset,
  buildScheduleTimeWheelSelectedIndex,
} from './schedule-time-wheel-layout';

describe('schedule time wheel layout helpers', () => {
  it('uses five visible rows so the selected time has one clear center row', () => {
    assert.equal(DEFAULT_SCHEDULE_TIME_WHEEL_VISIBLE_ITEMS, 5);
  });

  it('centers short columns instead of leaving the selected value on an edge row', () => {
    assert.equal(buildScheduleTimeWheelOffset({ optionCount: 2, selectedIndex: 1 }), 36);
  });

  it('centers the last hour with trailing padding instead of clamping it above the selector', () => {
    assert.equal(buildScheduleTimeWheelOffset({ optionCount: 12, selectedIndex: 11 }), 396);
  });

  it('keeps a middle selected value stable when momentum ends at the centered offset', () => {
    const offset = buildScheduleTimeWheelOffset({ optionCount: 12, selectedIndex: 5 });

    assert.equal(offset, 180);
    assert.equal(buildScheduleTimeWheelSelectedIndex({ optionCount: 12, contentOffsetY: offset }), 5);
  });

  it('rounds scroll offsets to the nearest centered option and clamps overscroll', () => {
    assert.equal(buildScheduleTimeWheelSelectedIndex({ optionCount: 12, contentOffsetY: 5 * 36 + 17 }), 5);
    assert.equal(buildScheduleTimeWheelSelectedIndex({ optionCount: 12, contentOffsetY: 5 * 36 + 19 }), 6);
    assert.equal(buildScheduleTimeWheelSelectedIndex({ optionCount: 12, contentOffsetY: -20 }), 0);
    assert.equal(buildScheduleTimeWheelSelectedIndex({ optionCount: 12, contentOffsetY: 9999 }), 11);
  });

  it('accepts custom item height and visible item counts', () => {
    assert.equal(
      buildScheduleTimeWheelOffset({ itemHeight: 40, optionCount: 10, selectedIndex: 9, visibleItems: 5 }),
      360,
    );
    assert.equal(buildScheduleTimeWheelSelectedIndex({ itemHeight: 40, optionCount: 10, contentOffsetY: 360 }), 9);
  });
});
