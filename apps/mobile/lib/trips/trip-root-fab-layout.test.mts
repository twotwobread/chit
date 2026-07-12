import assert from 'node:assert/strict';
import test from 'node:test';

import { theme } from '../design/theme';
import { buildTripRootFabLayout, shouldShowTripRootFab } from './trip-root-fab-layout';

test('trip root FAB layout keeps floating actions above safe area and reserves scroll clearance', () => {
  const layout = buildTripRootFabLayout({ bottomInset: 34, rightInset: 2 });

  assert.deepEqual(layout.fab, {
    bottom: 34 + theme.space[5],
    right: 2 + theme.space[5],
  });
  assert.equal(layout.scrollContent.paddingBottom, 34 + theme.layout.controlHLg + theme.space[7] + theme.space[5] * 2);
});

test('trip root FAB layout ignores negative safe-area insets', () => {
  const layout = buildTripRootFabLayout({ bottomInset: -10, rightInset: -6 });

  assert.deepEqual(layout.fab, {
    bottom: theme.space[5],
    right: theme.space[5],
  });
  assert.equal(layout.scrollContent.paddingBottom, theme.layout.controlHLg + theme.space[7] + theme.space[5] * 2);
});

test('trip root FAB is shown only when the route is ready and no blocking panel is active', () => {
  assert.equal(shouldShowTripRootFab({ hasAction: true, isBlocked: false, status: 'ready' }), true);
  assert.equal(shouldShowTripRootFab({ hasAction: false, isBlocked: false, status: 'ready' }), false);
  assert.equal(shouldShowTripRootFab({ hasAction: true, isBlocked: true, status: 'ready' }), false);
  assert.equal(shouldShowTripRootFab({ hasAction: true, isBlocked: false, status: 'loading' }), false);
});
