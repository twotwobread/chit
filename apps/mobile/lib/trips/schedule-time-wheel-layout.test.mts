import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildScheduleTimeWheelOffset } from './schedule-time-wheel-layout';

describe('schedule time wheel layout helpers', () => {
  it('does not scroll short columns so AM and PM remain visible together', () => {
    assert.equal(buildScheduleTimeWheelOffset({ optionCount: 2, selectedIndex: 1 }), 0);
  });

  it('clamps the last hour to the last full visible window instead of using it as the top row', () => {
    assert.equal(buildScheduleTimeWheelOffset({ optionCount: 12, selectedIndex: 11 }), 288);
  });

  it('keeps selected middle values visible without pinning them to the first row', () => {
    assert.equal(buildScheduleTimeWheelOffset({ optionCount: 12, selectedIndex: 5 }), 144);
  });

  it('accepts custom item height and visible item counts', () => {
    assert.equal(
      buildScheduleTimeWheelOffset({ itemHeight: 40, optionCount: 10, selectedIndex: 9, visibleItems: 5 }),
      200,
    );
  });
});
