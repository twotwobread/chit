import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildScheduleTimeEditorLayout } from './schedule-time-editor-layout';

describe('schedule time editor layout helpers', () => {
  it('uses a full-width segmented capsule while keeping the row shorter than a standard input', () => {
    const layout = buildScheduleTimeEditorLayout();

    assert.equal(layout.segmentedControlFillAvailableWidth, true);
    assert.equal(layout.segmentedControlHasOuterChrome, true);
    assert.equal(layout.segmentContentDirection, 'row');
    assert.ok(layout.segmentMinHeight < layout.standardControlHeight);
    assert.ok(layout.containerPadding < layout.standardContainerPadding);
  });
});
