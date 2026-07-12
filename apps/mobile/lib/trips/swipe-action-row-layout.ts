export const DEFAULT_SWIPE_ACTION_ROW_WIDTH = 76;
const swipeActionOpenThresholdRatio = 0.45;

export type SwipeActionRowLayout = {
  actionWidth: number;
  rightThreshold: number;
};

export function buildSwipeActionRowLayout(actionWidth = DEFAULT_SWIPE_ACTION_ROW_WIDTH): SwipeActionRowLayout {
  const normalizedActionWidth = Math.max(1, Math.round(actionWidth));
  return {
    actionWidth: normalizedActionWidth,
    rightThreshold: Math.max(1, Math.round(normalizedActionWidth * swipeActionOpenThresholdRatio)),
  };
}
