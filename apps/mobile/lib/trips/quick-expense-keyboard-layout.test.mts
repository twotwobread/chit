import assert from 'node:assert/strict';
import test from 'node:test';

import { theme } from '../design/theme';
import {
  QUICK_EXPENSE_MEMO_INPUT_MIN_HEIGHT,
  QUICK_EXPENSE_MEMO_KEYBOARD_BOTTOM_PADDING,
  QUICK_EXPENSE_MEMO_KEYBOARD_MIN_CLEARANCE,
  buildFocusedMemoScrollTarget,
} from './quick-expense-keyboard-layout';

test('quick expense memo focus reserves the full memo textarea plus generous bottom padding', () => {
  assert.equal(QUICK_EXPENSE_MEMO_INPUT_MIN_HEIGHT, theme.layout.controlHLg + theme.space[8]);
  assert.equal(QUICK_EXPENSE_MEMO_KEYBOARD_BOTTOM_PADDING, theme.space[10]);
  assert.equal(
    QUICK_EXPENSE_MEMO_KEYBOARD_MIN_CLEARANCE,
    QUICK_EXPENSE_MEMO_INPUT_MIN_HEIGHT + QUICK_EXPENSE_MEMO_KEYBOARD_BOTTOM_PADDING,
  );
});

test('focused memo scroll target moves only the hidden delta instead of launching to the end', () => {
  assert.deepEqual(
    buildFocusedMemoScrollTarget({
      currentScrollY: 120,
      fieldHeight: 88,
      fieldY: 660,
      keyboardHeight: 340,
      viewportHeight: 812,
    }),
    { targetY: 324, deltaY: 204 },
  );
});

test('focused memo scroll target does nothing when the full textarea already has bottom padding', () => {
  assert.equal(
    buildFocusedMemoScrollTarget({
      currentScrollY: 360,
      fieldHeight: 88,
      fieldY: 660,
      keyboardHeight: 260,
      viewportHeight: 812,
    }),
    null,
  );
});
