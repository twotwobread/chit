import assert from 'node:assert/strict';
import { test } from 'node:test';

import { theme } from '../design/theme';
import { SELECTED_NAV_TAB_SURFACE_STYLE } from './tab-selection';

test('selected navigation tabs use dark graphite surface plus a sparse Acid Lime edge', () => {
  assert.deepEqual(SELECTED_NAV_TAB_SURFACE_STYLE, {
    backgroundColor: theme.color.surfaceSoft,
    borderBottomColor: theme.color.uiAccent,
    borderBottomWidth: 3,
  });
});
