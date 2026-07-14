import assert from 'node:assert/strict';
import { test } from 'node:test';

import { theme } from '../design/theme';
import { SELECTED_NAV_TAB_SURFACE_STYLE } from './tab-selection';

test('selected navigation tabs use the light green surface in addition to active green text and icon color', () => {
  assert.deepEqual(SELECTED_NAV_TAB_SURFACE_STYLE, {
    backgroundColor: theme.color.primarySoft,
  });
});
