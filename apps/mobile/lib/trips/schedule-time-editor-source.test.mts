import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const scheduleTimeEditorSourcePath = path.join(process.cwd(), 'lib/trip-ui/ScheduleTimeEditor.tsx');

describe('schedule time editor source', () => {
  it('wires previous-end start defaults and quick end-time duration buttons', async () => {
    const source = await readFile(scheduleTimeEditorSourcePath, 'utf8');

    assert.equal(source.includes('defaultStartTime'), true);
    assert.equal(source.includes('addScheduleEndTimeDuration'), true);
    assert.equal(source.includes('+30분'), true);
    assert.equal(source.includes('+1시간'), true);
    assert.equal(source.includes('+2시간'), true);
  });
});
