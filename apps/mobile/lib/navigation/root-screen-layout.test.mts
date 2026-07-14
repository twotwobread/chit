import assert from 'node:assert/strict';
import { test } from 'node:test';

import { theme } from '../design/theme';
import { getRootScreenContentTopPadding } from './root-screen-layout';

test('root screen content starts below the iPhone 13 mini camera safe area', () => {
  // Given a headerless root screen after the native root header was removed.
  // When iPhone 13 mini reports a 50pt top safe-area inset.
  // Then the first content keeps the existing root padding below that safe area.
  assert.equal(getRootScreenContentTopPadding(50), 50 + theme.space[7]);
});

test('root screen content keeps the existing top padding on devices without a top safe area', () => {
  assert.equal(getRootScreenContentTopPadding(0), theme.space[7]);
});
