import assert from 'node:assert/strict';
import { test } from 'node:test';

import { theme } from '../design/theme';
import { SELECTED_NAV_TAB_SURFACE_STYLE } from './tab-selection';

test('selected navigation tabs use a soft paper surface plus a Coral edge', () => {
  assert.deepEqual(SELECTED_NAV_TAB_SURFACE_STYLE, {
    backgroundColor: theme.color.surfaceSoft,
    borderBottomColor: theme.color.brandAccent,
    borderBottomWidth: 3,
  });
});
