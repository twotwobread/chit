import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildScheduleTimeEditorLayout } from './schedule-time-editor-layout';

describe('schedule time editor layout helpers', () => {
  it('uses a full-width segmented capsule while keeping the regular row shorter than a standard input', () => {
    const layout = buildScheduleTimeEditorLayout({ width: 390, fontScale: 1 });

    assert.equal(layout.profile.name, 'regular');
    assert.equal(layout.segmentedControlFillAvailableWidth, true);
    assert.equal(layout.segmentedControlHasOuterChrome, true);
    assert.equal(layout.segmentContentDirection, 'row');
    assert.ok(layout.segmentMinHeight < layout.standardControlHeight);
    assert.ok(layout.containerPadding < layout.standardContainerPadding);
  });

  it('switches time segment labels to a two-line compact layout before truncating on larger fonts', () => {
    const layout = buildScheduleTimeEditorLayout({ width: 320, fontScale: 1.3 });

    assert.equal(layout.profile.name, 'compactLargerText');
    assert.equal(layout.segmentContentDirection, 'column');
    assert.ok(layout.segmentMinHeight >= layout.standardControlHeight);
    assert.ok(
      layout.segmentMinHeight >=
        layout.segmentLabelLineHeight +
          layout.segmentTextLineHeight +
          layout.segmentGap +
          layout.segmentVerticalPadding * 2,
    );
  });

  it('keeps critical time labels touch-safe in compact stress mode', () => {
    const layout = buildScheduleTimeEditorLayout({ width: 320, fontScale: 1.5 });

    assert.equal(layout.profile.name, 'compactStress');
    assert.equal(layout.segmentContentDirection, 'column');
    assert.ok(layout.segmentMinHeight >= 44);
    assert.ok(layout.segmentTextLineHeight > layout.segmentLabelLineHeight);
  });
});
