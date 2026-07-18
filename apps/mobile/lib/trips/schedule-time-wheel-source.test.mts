import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';

const scheduleTimeWheelSourcePath = path.join(process.cwd(), 'lib/trip-ui/ScheduleTimeWheel.tsx');

describe('schedule time wheel source', () => {
  it('uses only hour and minute columns for 24-hour schedule time selection', async () => {
    const source = await readFile(scheduleTimeWheelSourcePath, 'utf8');

    assert.equal(source.includes('scheduleTimePeriodOptions'), false);
    assert.equal(source.includes('PlaceScheduleTimePeriod'), false);
    assert.equal(source.includes('formatPeriodOption'), false);
    assert.equal(source.includes('오전'), false);
    assert.equal(source.includes('오후'), false);
  });
});
