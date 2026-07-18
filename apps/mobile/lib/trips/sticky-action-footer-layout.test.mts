import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STICKY_ACTION_FOOTER_MIN_CLEARANCE,
  buildStickyActionFooterLayout,
} from '../trip-ui/sticky-action-footer-layout';

test('sticky action footer reserves stacked actions plus safe area for scroll and keyboard clearance', () => {
  const layout = buildStickyActionFooterLayout({ bottomSafeArea: 18, actionCount: 2 });

  assert.equal(layout.footerPaddingBottom, 18);
  assert.equal(layout.footerActionCount, 2);
  assert.equal(layout.keyboardFixedBottomOffset, layout.footerReservedHeight - 18);
  assert.equal(layout.scrollPaddingBottom, layout.footerReservedHeight + STICKY_ACTION_FOOTER_MIN_CLEARANCE);
});

test('sticky action footer clamps negative safe area and invalid action counts', () => {
  const layout = buildStickyActionFooterLayout({ bottomSafeArea: -12, actionCount: -4, minClearance: -8 });

  assert.equal(layout.footerActionCount, 1);
  assert.equal(layout.footerPaddingBottom > 0, true);
  assert.equal(layout.keyboardFixedBottomOffset, layout.footerReservedHeight);
  assert.equal(layout.scrollPaddingBottom, layout.footerReservedHeight + STICKY_ACTION_FOOTER_MIN_CLEARANCE);
});

test('sticky action footer reserves more height for stacked actions than a single action', () => {
  const single = buildStickyActionFooterLayout({ bottomSafeArea: 12, actionCount: 1 });
  const stacked = buildStickyActionFooterLayout({ bottomSafeArea: 12, actionCount: 2 });

  assert.equal(stacked.footerReservedHeight > single.footerReservedHeight, true);
  assert.equal(stacked.keyboardFixedBottomOffset > single.keyboardFixedBottomOffset, true);
});
