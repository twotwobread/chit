export const DEFAULT_SWIPE_ACTION_ROW_WIDTH = 76;
export const DEFAULT_SWIPE_ACTION_ROW_INSET = 12;
export const DEFAULT_SWIPE_ACTION_ICON_BUTTON_SIZE = 40;

const swipeActionOpenThresholdRatio = 0.45;

export type SwipeActionRowLayout = {
  actionInset: number;
  actionWidth: number;
  iconButtonSize: number;
  rightThreshold: number;
};

export function buildSwipeActionRowLayout(actionWidth = DEFAULT_SWIPE_ACTION_ROW_WIDTH): SwipeActionRowLayout {
  const normalizedActionWidth = Math.max(1, Math.round(actionWidth));
  return {
    actionInset: DEFAULT_SWIPE_ACTION_ROW_INSET,
    actionWidth: normalizedActionWidth,
    iconButtonSize: DEFAULT_SWIPE_ACTION_ICON_BUTTON_SIZE,
    rightThreshold: Math.max(1, Math.round(normalizedActionWidth * swipeActionOpenThresholdRatio)),
  };
}
