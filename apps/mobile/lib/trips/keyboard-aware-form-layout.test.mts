import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KEYBOARD_AWARE_FORM_MIN_CLEARANCE,
  buildKeyboardAwareFormScrollConfig,
} from '../trip-ui/keyboard-aware-form-layout';

test('keyboard-aware form config keeps focused controls above keyboard and safe area', () => {
  const config = buildKeyboardAwareFormScrollConfig({
    bottomSafeArea: 18,
    fixedBottomOffset: 12,
    extraBottomSpacing: 20,
  });

  assert.equal(config.keyboardBottomOffset, 18 + 12 + KEYBOARD_AWARE_FORM_MIN_CLEARANCE);
  assert.equal(config.contentPaddingBottom, 18 + 12 + 20 + KEYBOARD_AWARE_FORM_MIN_CLEARANCE);
});

test('keyboard-aware form config clamps negative inset and offset inputs', () => {
  const config = buildKeyboardAwareFormScrollConfig({
    bottomSafeArea: -18,
    fixedBottomOffset: -12,
    extraBottomSpacing: -20,
    minClearance: -4,
  });

  assert.equal(config.keyboardBottomOffset, KEYBOARD_AWARE_FORM_MIN_CLEARANCE);
  assert.equal(config.contentPaddingBottom, KEYBOARD_AWARE_FORM_MIN_CLEARANCE);
});
