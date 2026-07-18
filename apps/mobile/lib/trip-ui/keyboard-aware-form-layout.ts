import { theme } from '../design/theme';

export const KEYBOARD_AWARE_FORM_MIN_CLEARANCE = theme.space[8];

export type KeyboardAwareFormScrollConfigInput = {
  bottomSafeArea?: number;
  extraBottomSpacing?: number;
  fixedBottomOffset?: number;
  minClearance?: number;
};

export type KeyboardAwareFormScrollConfig = {
  contentPaddingBottom: number;
  keyboardBottomOffset: number;
};

export function buildKeyboardAwareFormScrollConfig({
  bottomSafeArea = 0,
  extraBottomSpacing = 0,
  fixedBottomOffset = 0,
  minClearance = KEYBOARD_AWARE_FORM_MIN_CLEARANCE,
}: KeyboardAwareFormScrollConfigInput): KeyboardAwareFormScrollConfig {
  const safeBottom = clampNonNegative(bottomSafeArea);
  const fixedBottom = clampNonNegative(fixedBottomOffset);
  const extraBottom = clampNonNegative(extraBottomSpacing);
  const clearance = minClearance > 0 ? minClearance : KEYBOARD_AWARE_FORM_MIN_CLEARANCE;
  const keyboardBottomOffset = safeBottom + fixedBottom + clearance;

  return {
    contentPaddingBottom: keyboardBottomOffset + extraBottom,
    keyboardBottomOffset,
  };
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
