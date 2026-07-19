import assert from 'node:assert/strict';
import { test } from 'node:test';

import { theme } from '../design/theme';
import { SELECTED_NAV_TAB_SURFACE_STYLE } from './tab-selection';

test('selected navigation tabs use Acid fill plus elevation for on-primary active icon and label contrast', () => {
  assert.deepEqual(SELECTED_NAV_TAB_SURFACE_STYLE, {
    backgroundColor: theme.color.primary,
    ...theme.shadow.xs,
  });
});
