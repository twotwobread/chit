import { theme } from '../design/theme';

export const QUICK_EXPENSE_MEMO_INPUT_MIN_HEIGHT = theme.layout.controlHLg + theme.space[8];
export const QUICK_EXPENSE_MEMO_KEYBOARD_BOTTOM_PADDING = theme.space[10];
export const QUICK_EXPENSE_MEMO_KEYBOARD_MIN_CLEARANCE =
  QUICK_EXPENSE_MEMO_INPUT_MIN_HEIGHT + QUICK_EXPENSE_MEMO_KEYBOARD_BOTTOM_PADDING;

export type FocusedMemoScrollTargetInput = {
  bottomPadding?: number;
  currentScrollY: number;
  fieldHeight: number;
  fieldY: number;
  keyboardHeight: number;
  viewportHeight: number;
};

export type FocusedMemoScrollTarget = {
  deltaY: number;
  targetY: number;
};

export function buildFocusedMemoScrollTarget({
  bottomPadding = QUICK_EXPENSE_MEMO_KEYBOARD_BOTTOM_PADDING,
  currentScrollY,
  fieldHeight,
  fieldY,
  keyboardHeight,
  viewportHeight,
}: FocusedMemoScrollTargetInput): FocusedMemoScrollTarget | null {
  if (
    !isFinitePositive(fieldHeight) ||
    !isFinitePositive(viewportHeight) ||
    !Number.isFinite(currentScrollY) ||
    !Number.isFinite(fieldY) ||
    !Number.isFinite(keyboardHeight)
  ) {
    return null;
  }

  const safeCurrentScrollY = Math.max(0, currentScrollY);
  const safeKeyboardHeight = Math.max(0, keyboardHeight);
  const safeBottomPadding = Math.max(0, bottomPadding);
  const visibleBottomY = safeCurrentScrollY + viewportHeight - safeKeyboardHeight;
  const desiredMemoBottomY = fieldY + fieldHeight + safeBottomPadding;
  const deltaY = Math.max(0, desiredMemoBottomY - visibleBottomY);

  if (deltaY <= 0) {
    return null;
  }

  return {
    deltaY,
    targetY: safeCurrentScrollY + deltaY,
  };
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
