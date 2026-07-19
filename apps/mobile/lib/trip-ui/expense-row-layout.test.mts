import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildExpenseRowLayout } from './expense-row-layout';

describe('expense row responsive layout', () => {
  it('keeps amount trailing and dense metadata inline on regular phones', () => {
    const layout = buildExpenseRowLayout({ width: 390, fontScale: 1 });

    assert.equal(layout.profile.name, 'regular');
    assert.equal(layout.amountPlacement, 'trailing');
    assert.equal(layout.metaDirection, 'row');
    assert.equal(layout.titleNumberOfLines, 1);
    assert.equal(layout.metaNumberOfLines, 1);
    assert.equal(layout.rowAlignItems, 'center');
  });

  it('stacks critical amount and grows text lines on compact larger-font phones', () => {
    const layout = buildExpenseRowLayout({ width: 320, fontScale: 1.3 });

    assert.equal(layout.profile.name, 'compactLargerText');
    assert.equal(layout.amountPlacement, 'stacked');
    assert.equal(layout.metaDirection, 'column');
    assert.equal(layout.titleNumberOfLines, 2);
    assert.equal(layout.metaNumberOfLines, 2);
    assert.equal(layout.rowAlignItems, 'flex-start');
  });

  it('preserves at least the 44pt touch target in compact stress mode', () => {
    const layout = buildExpenseRowLayout({ width: 320, fontScale: 1.5 });

    assert.equal(layout.profile.name, 'compactStress');
    assert.equal(layout.amountPlacement, 'stacked');
    assert.ok(layout.minRowHeight >= 44);
    assert.ok(layout.titleLineHeight > 0);
    assert.ok(layout.metaLineHeight > 0);
  });
});
