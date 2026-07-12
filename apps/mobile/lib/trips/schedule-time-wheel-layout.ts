export const DEFAULT_SCHEDULE_TIME_WHEEL_ITEM_HEIGHT = 36;
export const DEFAULT_SCHEDULE_TIME_WHEEL_VISIBLE_ITEMS = 4;

export function buildScheduleTimeWheelOffset({
  itemHeight = DEFAULT_SCHEDULE_TIME_WHEEL_ITEM_HEIGHT,
  optionCount,
  selectedIndex,
  visibleItems = DEFAULT_SCHEDULE_TIME_WHEEL_VISIBLE_ITEMS,
}: {
  itemHeight?: number;
  optionCount: number;
  selectedIndex: number;
  visibleItems?: number;
}): number {
  const normalizedItemHeight = Math.max(1, Math.round(itemHeight));
  const normalizedOptionCount = Math.max(0, Math.round(optionCount));
  const normalizedVisibleItems = Math.max(1, Math.round(visibleItems));

  if (normalizedOptionCount <= normalizedVisibleItems) {
    return 0;
  }

  const safeSelectedIndex = Math.max(0, Math.min(normalizedOptionCount - 1, Math.round(selectedIndex)));
  const selectedRowOffset = Math.floor((normalizedVisibleItems - 1) / 2);
  const rawOffset = (safeSelectedIndex - selectedRowOffset) * normalizedItemHeight;
  const maxOffset = (normalizedOptionCount - normalizedVisibleItems) * normalizedItemHeight;

  return Math.max(0, Math.min(maxOffset, rawOffset));
}
