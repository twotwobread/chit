import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildSwipeActionRowLayout } from './swipe-action-row-layout';

describe('swipe action row layout helpers', () => {
  it('uses a fixed measurable right action width for library swipe rows', () => {
    assert.deepEqual(buildSwipeActionRowLayout(), {
      actionInset: 12,
      actionWidth: 76,
      iconButtonSize: 40,
      rightThreshold: 34,
    });
  });

  it('keeps the right threshold below the action width so a left swipe can open', () => {
    const layout = buildSwipeActionRowLayout(120);

    assert.equal(layout.actionWidth, 120);
    assert.equal(layout.rightThreshold, 54);
    assert.equal(layout.actionInset, 12);
    assert.equal(layout.iconButtonSize, 40);
    assert.ok(layout.rightThreshold > 0);
    assert.ok(layout.rightThreshold < layout.actionWidth);
  });
});
