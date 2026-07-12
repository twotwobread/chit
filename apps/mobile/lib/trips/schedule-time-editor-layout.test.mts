import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildScheduleTimeEditorLayout } from './schedule-time-editor-layout';

describe('schedule time editor layout helpers', () => {
  it('keeps start and end time controls compact instead of stretching full width', () => {
    const layout = buildScheduleTimeEditorLayout();

    assert.equal(layout.containerHasOuterChrome, false);
    assert.equal(layout.pillFillAvailableWidth, false);
    assert.equal(layout.pillContentDirection, 'row');
    assert.ok(layout.pillMinHeight < layout.standardControlHeight);
    assert.ok(layout.containerPadding < layout.standardContainerPadding);
  });
});
